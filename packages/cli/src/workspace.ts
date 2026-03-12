import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

export type Mode = "advisory" | "supervised" | "autonomous";

export function slugifyWorkflowId(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return slug.length > 0 ? slug : "workflow";
}

export function utcTimestampForRunId(date: Date): string {
  const iso = date.toISOString(); // 2026-03-12T12:34:56.789Z
  const noMs = iso.slice(0, 19); // 2026-03-12T12:34:56
  return `${noMs.replace(/:/g, "")}Z`; // 2026-03-12T123456Z
}

export function resolveWorkspaceId(workspaceFlag?: string): string | null {
  if (workspaceFlag && workspaceFlag.trim().length > 0) return workspaceFlag.trim();
  const fromEnv = process.env.MAR21_WORKSPACE;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
  return null;
}

export function workspaceRoot(repoRoot: string, workspaceId: string): string {
  return path.join(repoRoot, "workspaces", workspaceId);
}

export function requireWorkspaceRoot(repoRoot: string, workspaceId: string): string {
  const wsRoot = workspaceRoot(repoRoot, workspaceId);
  if (!fs.existsSync(wsRoot) || !fs.statSync(wsRoot).isDirectory()) {
    const err = new Error(`workspace not found: ${workspaceId} (${wsRoot})`) as Error & {
      code?: string;
    };
    err.code = "MAR21_WORKSPACE_NOT_FOUND";
    throw err;
  }
  return wsRoot;
}

export function readYamlFile(filePath: string): unknown {
  return YAML.parse(fs.readFileSync(filePath, "utf-8"));
}

export function writeYamlFile(filePath: string, data: unknown): void {
  const raw = YAML.stringify(data, { indent: 2 });
  fs.writeFileSync(filePath, raw, "utf-8");
}

export function defaultModeFromContext(context: unknown): Mode {
  if (!context || typeof context !== "object") return "supervised";

  const autonomy = (context as { constraints?: { autonomy?: { defaultMode?: unknown } } })?.constraints
    ?.autonomy;
  const mode = autonomy?.defaultMode;
  if (mode === "advisory" || mode === "supervised" || mode === "autonomous") return mode;
  return "supervised";
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}
