import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import YAML from "yaml";
import { resolveRepoRoot } from "./repo-root.js";
import { ensureDir, resolveWorkspaceId, workspaceRoot } from "./workspace.js";

type McpServersFile = {
  apiVersion: "mar21/mcp-servers-v1";
  servers: Array<{
    id: string;
    transport: "stdio" | "http";
    command?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    capabilities?: Array<{ capabilityId: string; toolName: string }>;
    url?: string;
    notes?: string;
  }>;
};

async function promptText(prompt: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const suffix = defaultValue ? ` (${defaultValue})` : "";
    const answer = (await rl.question(`${prompt}${suffix}: `)).trim();
    return answer.length > 0 ? answer : defaultValue ?? "";
  } finally {
    rl.close();
  }
}

async function promptYesNo(prompt: string, defaultYes = true): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const hint = defaultYes ? "Y/n" : "y/N";
    const answer = (await rl.question(`${prompt} (${hint}) `)).trim().toLowerCase();
    if (!answer) return defaultYes;
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

function parseCommandLine(cmdline: string): { command: string; args: string[] } {
  const s = cmdline.trim();
  if (!s) {
    const err = new Error("missing command line") as Error & { exitCode?: number };
    err.exitCode = 2;
    throw err;
  }

  const args: string[] = [];
  let cur = "";
  let quote: "'" | "\"" | null = null;
  let escaped = false;

  const push = () => {
    const t = cur.trim();
    if (t.length > 0) args.push(t);
    cur = "";
  };

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]!;
    if (escaped) {
      cur += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === "'" || ch === "\"") {
      quote = ch as any;
      continue;
    }
    if (/\s/.test(ch)) {
      push();
      continue;
    }
    cur += ch;
  }
  push();

  const command = args.shift();
  if (!command) {
    const err = new Error("invalid command line") as Error & { exitCode?: number };
    err.exitCode = 2;
    throw err;
  }
  return { command, args };
}

function readMcpServersFile(filePath: string): McpServersFile {
  if (!fs.existsSync(filePath)) return { apiVersion: "mar21/mcp-servers-v1", servers: [] };
  const doc = YAML.parse(fs.readFileSync(filePath, "utf-8")) as any;
  if (doc && typeof doc === "object" && doc.apiVersion === "mar21/mcp-servers-v1" && Array.isArray(doc.servers)) {
    return { apiVersion: "mar21/mcp-servers-v1", servers: doc.servers as any[] };
  }
  const err = new Error(`unsupported mcp-servers.yaml format: ${filePath}`) as Error & { exitCode?: number };
  err.exitCode = 10;
  throw err;
}

function validServerId(id: string): boolean {
  return /^[a-z0-9][a-z0-9_.-]{0,63}$/.test(id);
}

function parseEnvPairs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split(",").map((p) => p.trim()).filter(Boolean)) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    out[k] = v;
  }
  return out;
}

export async function mcpAddServer(opts: { workspace?: string }): Promise<void> {
  if (!process.stdin.isTTY) {
    const err = new Error("mcp add requires an interactive terminal (TTY)") as Error & { exitCode?: number };
    err.exitCode = 2;
    throw err;
  }

  const repoRoot = resolveRepoRoot(process.cwd());
  const workspaceId = resolveWorkspaceId(opts.workspace);
  if (!workspaceId) {
    const err = new Error("missing --workspace (or MAR21_WORKSPACE)") as Error & { exitCode?: number };
    err.exitCode = 2;
    throw err;
  }

  const wsRoot = workspaceRoot(repoRoot, workspaceId);
  if (!fs.existsSync(wsRoot) || !fs.statSync(wsRoot).isDirectory()) {
    const err = new Error(`workspace not found: ${workspaceId}`) as Error & { exitCode?: number };
    err.exitCode = 10;
    throw err;
  }

  ensureDir(path.join(wsRoot, "_cfg"));
  const cfgPath = path.join(wsRoot, "_cfg", "mcp-servers.yaml");
  const cfg = readMcpServersFile(cfgPath);

  const serverId = (await promptText("Server id (lowercase, e.g. 'gdrive' or 'ahrefs')", "custom")).trim();
  if (!validServerId(serverId)) {
    const err = new Error(
      `invalid server id: ${serverId} (expected /^[a-z0-9][a-z0-9_.-]{0,63}$/)`
    ) as Error & { exitCode?: number };
    err.exitCode = 2;
    throw err;
  }
  if (cfg.servers.some((s) => s.id === serverId)) {
    const overwrite = await promptYesNo(`Server '${serverId}' already exists. Overwrite it?`, false);
    if (!overwrite) return;
  }

  const cmdline = await promptText("Paste stdio command (example: npx -y @modelcontextprotocol/server-gdrive)", "");
  const parsed = parseCommandLine(cmdline);

  const envRaw = await promptText("Optional env (comma-separated KEY=value, leave blank for none)", "");
  const env = envRaw.trim().length > 0 ? parseEnvPairs(envRaw) : {};
  const notes = await promptText("Optional notes (what is this server for?)", "");

  const nextServer = {
    id: serverId,
    transport: "stdio" as const,
    command: parsed.command,
    args: parsed.args,
    env: Object.keys(env).length ? env : undefined,
    notes: notes.trim().length ? notes.trim() : undefined,
    capabilities: []
  };

  const nextServers = cfg.servers.filter((s) => s.id !== serverId);
  nextServers.push(nextServer);
  nextServers.sort((a, b) => a.id.localeCompare(b.id));

  const nextDoc: McpServersFile = { apiVersion: "mar21/mcp-servers-v1", servers: nextServers };
  fs.writeFileSync(cfgPath, `${YAML.stringify(nextDoc)}\n`, "utf-8");

  process.stdout.write(`✓ added MCP server: ${serverId}\n`);
  process.stdout.write(`  file: workspaces/${workspaceId}/_cfg/mcp-servers.yaml\n`);
  process.stdout.write(`  next: pnpm mar21 mcp doctor --workspace ${workspaceId}\n`);
  process.stdout.write(`  next: pnpm mar21 mcp tools --workspace ${workspaceId} --server ${serverId}\n`);
}

