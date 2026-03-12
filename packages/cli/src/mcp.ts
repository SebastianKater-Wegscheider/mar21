import Ajv2020Import from "ajv/dist/2020.js";
import addFormatsImport from "ajv-formats";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import YAML from "yaml";
import { callMcpTool, listMcpTools, loadMcpServersFile, loadWorkspaceSecretsIntoEnv } from "@mar21/mcp";
import { requireWorkspaceRoot, resolveWorkspaceId } from "./workspace.js";

type Ajv2020Class = typeof import("ajv/dist/2020.js").default;
type Ajv2020Instance = InstanceType<Ajv2020Class>;

const Ajv2020 = Ajv2020Import as unknown as Ajv2020Class;
const addFormats = ((addFormatsImport as unknown as { default?: unknown }).default ??
  addFormatsImport) as unknown as (ajv: Ajv2020Instance) => void;

function repoRootFromCwd(): string {
  return process.cwd();
}

function loadJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function buildAjv(schemaDir: string): Ajv2020Instance {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  for (const entry of fs.readdirSync(schemaDir)) {
    if (!entry.endsWith(".json")) continue;
    const schemaPath = path.join(schemaDir, entry);
    ajv.addSchema(loadJsonFile(schemaPath) as any);
  }
  return ajv;
}

function validateWithSchema(ajv: Ajv2020Instance, schemaId: string, instance: unknown): string[] {
  const validate = ajv.getSchema(schemaId);
  if (!validate) return [`schema not found: ${schemaId}`];
  const ok = validate(instance);
  if (ok) return [];
  return validate.errors?.map((e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`) ?? ["invalid"];
}

function readYamlFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, "utf-8");
  try {
    return YAML.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const err = new Error(`invalid YAML: ${filePath}: ${msg}`) as Error & { exitCode?: number };
    err.exitCode = 11;
    throw err;
  }
}

export async function mcpDoctor(opts: { workspace?: string; json?: boolean }): Promise<void> {
  const repoRoot = repoRootFromCwd();
  const workspaceId = resolveWorkspaceId(opts.workspace);
  if (!workspaceId) {
    const err = new Error("missing --workspace (or MAR21_WORKSPACE)");
    (err as Error & { exitCode?: number }).exitCode = 2;
    throw err;
  }

  const wsRoot = requireWorkspaceRoot(repoRoot, workspaceId);
  loadWorkspaceSecretsIntoEnv(wsRoot);

  const cfgPath = path.join(wsRoot, "_cfg", "mcp-servers.yaml");
  if (!fs.existsSync(cfgPath)) {
    const err = new Error(`missing MCP servers config: ${cfgPath}`);
    (err as Error & { exitCode?: number }).exitCode = 10;
    throw err;
  }

  const instance = readYamlFile(cfgPath);
  const schemaDir = path.join(repoRoot, "schemas");
  const ajv = buildAjv(schemaDir);
  const errors = validateWithSchema(ajv, "urn:mar21:schema:mcp-servers:v1", instance);
  if (errors.length > 0) {
    const err = new Error(`mcp-servers.yaml schema validation failed:\n- ${errors.join("\n- ")}`) as Error & {
      exitCode?: number;
    };
    err.exitCode = 11;
    throw err;
  }

  const doc = instance as any;
  const servers = Array.isArray(doc.servers) ? doc.servers : [];

  const summary = {
    workspace: workspaceId,
    config: path.relative(repoRoot, cfgPath),
    serverCount: servers.length,
    servers: servers.map((s: any) => ({
      id: s.id,
      transport: s.transport,
      command: s.command ?? null,
      url: s.url ?? null
    }))
  };

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    return;
  }

  console.log(`✓ MCP config valid: ${summary.config}`);
  console.log(`- servers: ${summary.serverCount}`);
  for (const s of summary.servers) {
    console.log(`  - ${s.id} (${s.transport})`);
  }
}

export async function mcpTools(opts: { workspace?: string; serverId: string; json?: boolean }): Promise<void> {
  const repoRoot = repoRootFromCwd();
  const workspaceId = resolveWorkspaceId(opts.workspace);
  if (!workspaceId) {
    const err = new Error("missing --workspace (or MAR21_WORKSPACE)");
    (err as Error & { exitCode?: number }).exitCode = 2;
    throw err;
  }

  const wsRoot = requireWorkspaceRoot(repoRoot, workspaceId);
  loadWorkspaceSecretsIntoEnv(wsRoot);
  const cfg = loadMcpServersFile(wsRoot);
  if (!cfg) {
    const err = new Error(`missing MCP servers config: ${path.join(wsRoot, "_cfg", "mcp-servers.yaml")}`);
    (err as Error & { exitCode?: number }).exitCode = 10;
    throw err;
  }

  const server = cfg.servers.find((s) => s.id === opts.serverId);
  if (!server) {
    const err = new Error(`mcp server not found: ${opts.serverId}`) as Error & { exitCode?: number };
    err.exitCode = 2;
    throw err;
  }

  const tools = await listMcpTools(server as any);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ tools })}\n`);
    return;
  }
  for (const t of tools) console.log(`- ${t.name}${t.description ? ` — ${t.description}` : ""}`);
}

export async function mcpCall(opts: {
  workspace?: string;
  serverId: string;
  tool: string;
  input: string;
  json?: boolean;
}): Promise<void> {
  const repoRoot = repoRootFromCwd();
  const workspaceId = resolveWorkspaceId(opts.workspace);
  if (!workspaceId) {
    const err = new Error("missing --workspace (or MAR21_WORKSPACE)");
    (err as Error & { exitCode?: number }).exitCode = 2;
    throw err;
  }

  const wsRoot = requireWorkspaceRoot(repoRoot, workspaceId);
  loadWorkspaceSecretsIntoEnv(wsRoot);
  const cfg = loadMcpServersFile(wsRoot);
  if (!cfg) {
    const err = new Error(`missing MCP servers config: ${path.join(wsRoot, "_cfg", "mcp-servers.yaml")}`);
    (err as Error & { exitCode?: number }).exitCode = 10;
    throw err;
  }

  const server = cfg.servers.find((s) => s.id === opts.serverId);
  if (!server) {
    const err = new Error(`mcp server not found: ${opts.serverId}`) as Error & { exitCode?: number };
    err.exitCode = 2;
    throw err;
  }

  let input: unknown;
  try {
    input = opts.input.trim().length > 0 ? JSON.parse(opts.input) : {};
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const err = new Error(`invalid JSON for --input: ${msg}`) as Error & { exitCode?: number };
    err.exitCode = 2;
    throw err;
  }

  const out = await callMcpTool(server as any, opts.tool, input);
  const raw = JSON.stringify(out, null, opts.json ? 0 : 2);
  process.stdout.write(`${raw}\n`);
}
