import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import YAML from "yaml";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export type McpServerConfig = {
  id: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  capabilities?: Array<{ capabilityId: string; toolName: string }>;
  url?: string;
  notes?: string;
};

export type McpServersFile = {
  apiVersion: "mar21/mcp-servers-v1";
  servers: McpServerConfig[];
};

export function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!key) continue;
    out[key] = val;
  }
  return out;
}

export function loadWorkspaceSecretsIntoEnv(workspaceRoot: string): void {
  const p = path.join(workspaceRoot, "secrets", ".env");
  if (!fs.existsSync(p)) return;
  const parsed = parseDotEnv(fs.readFileSync(p, "utf-8"));
  for (const [k, v] of Object.entries(parsed)) {
    if (!process.env[k] || process.env[k]?.trim().length === 0) process.env[k] = v;
  }
}

export function loadMcpServersFile(workspaceRoot: string): McpServersFile | null {
  const p = path.join(workspaceRoot, "_cfg", "mcp-servers.yaml");
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf-8");
  const doc = YAML.parse(raw) as any;
  if (!doc || typeof doc !== "object") return null;
  if (doc.apiVersion !== "mar21/mcp-servers-v1") return null;
  if (!Array.isArray(doc.servers)) return null;
  return { apiVersion: "mar21/mcp-servers-v1", servers: doc.servers as McpServerConfig[] };
}

export function resolveToolForCapability(args: {
  servers: McpServerConfig[];
  capabilityId: string;
  preferredServerId?: string;
}): { server: McpServerConfig; toolName: string } | null {
  const cap = args.capabilityId.trim();
  if (!cap) return null;

  const ordered = (() => {
    if (!args.preferredServerId) return args.servers;
    const preferred = args.servers.filter((s) => s.id === args.preferredServerId);
    const rest = args.servers.filter((s) => s.id !== args.preferredServerId);
    return [...preferred, ...rest];
  })();

  for (const s of ordered) {
    const map = Array.isArray(s.capabilities) ? s.capabilities : [];
    const hit = map.find((m) => m && typeof m === "object" && m.capabilityId === cap && typeof m.toolName === "string");
    if (hit) return { server: s, toolName: hit.toolName };
  }

  // Fallback convention: if a server exposes tool names equal to mar21 capability ids,
  // operators can omit explicit mappings and call by capabilityId directly.
  if (args.preferredServerId) {
    const direct = ordered.find((s) => s.id === args.preferredServerId);
    if (direct) return { server: direct, toolName: cap };
  }
  if (ordered.length === 1) return { server: ordered[0]!, toolName: cap };
  return null;
}

function expandEnvValue(template: string): string {
  return template.replace(/\$\{([A-Z0-9_]+)\}/g, (_m, name) => process.env[String(name)] ?? "");
}

function resolvedServerEnv(env?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env ?? {})) out[k] = expandEnvValue(String(v));
  return out;
}

function processEnvStrings(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: NodeJS.Timeout | null = null;
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      (t as any)?.unref?.();
    });
    return (await Promise.race([p, timeout])) as T;
  } finally {
    if (t) clearTimeout(t);
  }
}

async function safeClose(client: Client, transport: StdioClientTransport, label: string): Promise<void> {
  try {
    await withTimeout(client.close(), 2000, `${label} close(client)`);
  } catch {
    // ignore
  }
  try {
    // Transport close already includes its own bounded waits + SIGTERM/SIGKILL escalation.
    await withTimeout(transport.close(), 8000, `${label} close(transport)`);
  } catch {
    // ignore
  }
}

export async function withMcpClient<T>(
  server: McpServerConfig,
  fn: (client: Client) => Promise<T>,
  opts?: { connectTimeoutMs?: number; callTimeoutMs?: number }
): Promise<T> {
  if (server.transport !== "stdio") {
    const err = new Error(`unsupported MCP transport in v0.1: ${server.transport}`) as Error & { exitCode?: number };
    err.exitCode = 2;
    throw err;
  }
  if (!server.command) {
    const err = new Error(`mcp server missing command: ${server.id}`) as Error & { exitCode?: number };
    err.exitCode = 2;
    throw err;
  }

  const env = { ...processEnvStrings(), ...resolvedServerEnv(server.env) };

  const transport = new StdioClientTransport({
    command: server.command,
    args: server.args ?? [],
    env,
    cwd: server.cwd
  });

  const client = new Client(
    { name: "mar21", version: "0.1.0" },
    { capabilities: {} }
  );

  const connectTimeoutMs = opts?.connectTimeoutMs ?? 15_000;
  const callTimeoutMs = opts?.callTimeoutMs ?? 30_000;

  try {
    await withTimeout(client.connect(transport), connectTimeoutMs, `mcp connect (${server.id})`);
  } catch (e) {
    try {
      await withTimeout(transport.close(), 8000, `mcp connect (${server.id}) close(transport)`);
    } catch {
      // ignore
    }
    throw e;
  }
  try {
    return await withTimeout(fn(client), callTimeoutMs, `mcp call (${server.id})`);
  } finally {
    await safeClose(client, transport, `mcp (${server.id})`);
  }
}

export async function listMcpTools(server: McpServerConfig): Promise<{ name: string; description?: string }[]> {
  return withMcpClient(server, async (client) => {
    const res = await client.listTools();
    const tools = (res as any)?.tools;
    if (!Array.isArray(tools)) return [];
    return tools.map((t: any) => ({ name: String(t.name), description: t.description ? String(t.description) : undefined }));
  });
}

export async function callMcpTool(server: McpServerConfig, tool: string, input: unknown): Promise<unknown> {
  return withMcpClient(server, async (client) => {
    const res = await client.callTool({ name: tool, arguments: input as any });
    return res as unknown;
  });
}

type IsolatedResult =
  | { ok: true; result: unknown }
  | { ok: false; error: { message: string } };

function spawnNodeIsolated(payload: unknown, timeoutMs: number): Promise<IsolatedResult> {
  const script = `
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const b64 = process.env.MAR21_MCP_PAYLOAD || "";
const raw = Buffer.from(b64, "base64").toString("utf-8");
const payload = JSON.parse(raw);

const client = new Client({ name: "mar21", version: "0.1.0" }, { capabilities: {} });
const transport = new StdioClientTransport({
  command: payload.command,
  args: payload.args || [],
  env: payload.env || {},
  cwd: payload.cwd || undefined
});

async function main() {
  try {
    await client.connect(transport);
    const mode = payload.mode;
    if (mode === "tools") {
      const res = await client.listTools();
      process.stdout.write(JSON.stringify({ ok: true, result: res }));
      return;
    }
    if (mode === "call") {
      const res = await client.callTool({ name: payload.tool, arguments: payload.input || {} });
      process.stdout.write(JSON.stringify({ ok: true, result: res }));
      return;
    }
    process.stdout.write(JSON.stringify({ ok: false, error: { message: "unsupported mode" } }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stdout.write(JSON.stringify({ ok: false, error: { message: msg } }));
  } finally {
    try { await client.close(); } catch {}
    try { await transport.close(); } catch {}
    process.exit(0);
  }
}

await main();
`;

  const b64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
  const child = spawn(process.execPath, ["--input-type=module", "-e", script], {
    env: { ...processEnvStrings(), MAR21_MCP_PAYLOAD: b64 },
    stdio: ["ignore", "pipe", "pipe"]
  });

  return new Promise<IsolatedResult>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const t = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      resolve({ ok: false, error: { message: `isolated MCP timed out after ${timeoutMs}ms` } });
    }, timeoutMs);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (t as any)?.unref?.();

    child.stdout?.on("data", (d) => (stdout += d.toString("utf-8")));
    child.stderr?.on("data", (d) => (stderr += d.toString("utf-8")));
    child.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
    child.on("close", () => {
      clearTimeout(t);
      try {
        const parsed = JSON.parse(stdout.trim() || "{}") as IsolatedResult;
        if (parsed && typeof parsed === "object" && "ok" in parsed) {
          resolve(parsed);
          return;
        }
        resolve({ ok: false, error: { message: stderr.trim() || "invalid isolated MCP output" } });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        resolve({ ok: false, error: { message: `${msg}${stderr.trim() ? `: ${stderr.trim()}` : ""}` } });
      }
    });
  });
}

function serverSpawnParams(server: McpServerConfig): { command: string; args: string[]; cwd?: string; env: Record<string, string> } {
  if (server.transport !== "stdio" || !server.command) {
    throw new Error(`unsupported MCP transport/server for isolated mode: ${server.id}`);
  }
  return {
    command: server.command,
    args: server.args ?? [],
    cwd: server.cwd,
    env: { ...resolvedServerEnv(server.env) }
  };
}

export async function listMcpToolsIsolated(
  server: McpServerConfig,
  opts?: { timeoutMs?: number }
): Promise<{ name: string; description?: string }[]> {
  const params = serverSpawnParams(server);
  const res = await spawnNodeIsolated({ ...params, mode: "tools" }, opts?.timeoutMs ?? 20_000);
  if (!res.ok) throw new Error(res.error.message);
  const tools = (res.result as any)?.tools;
  if (!Array.isArray(tools)) return [];
  return tools.map((t: any) => ({ name: String(t.name), description: t.description ? String(t.description) : undefined }));
}

export async function callMcpToolIsolated(
  server: McpServerConfig,
  tool: string,
  input: unknown,
  opts?: { timeoutMs?: number }
): Promise<unknown> {
  const params = serverSpawnParams(server);
  const res = await spawnNodeIsolated({ ...params, mode: "call", tool, input }, opts?.timeoutMs ?? 30_000);
  if (!res.ok) throw new Error(res.error.message);
  return res.result;
}
