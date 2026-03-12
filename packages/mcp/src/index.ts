import fs from "node:fs";
import path from "node:path";
import process from "node:process";
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

export async function withMcpClient<T>(
  server: McpServerConfig,
  fn: (client: Client) => Promise<T>
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

  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
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
