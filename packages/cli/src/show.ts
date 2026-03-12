import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { resolveRepoRoot } from "./repo-root.js";
import { resolveWorkspaceId, workspaceRoot } from "./workspace.js";

type ShowOptions = {
  workspace?: string;
  runId: string;
  artifact: string;
};

function latestRunId(runsDir: string): string | null {
  if (!fs.existsSync(runsDir)) return null;
  const entries = fs
    .readdirSync(runsDir)
    .filter((e) => !e.startsWith("."))
    .sort();
  return entries.length ? entries[entries.length - 1] : null;
}

function runsNewestFirst(runsDir: string): string[] {
  if (!fs.existsSync(runsDir)) return [];
  return fs
    .readdirSync(runsDir)
    .filter((e) => !e.startsWith("."))
    .sort()
    .reverse();
}

function artifactPath(opts: { wsRoot: string; runId: string; artifact: string }): string {
  const a = opts.artifact.trim().toLowerCase();
  if (a === "todos" || a === "todo" || a === "tasks") return path.join(opts.wsRoot, "todos.yaml");
  if (a === "context" || a === "marketing-context") return path.join(opts.wsRoot, "marketing-context.yaml");
  if (a === "changeset") return path.join(opts.wsRoot, "runs", opts.runId, "changeset.yaml");
  if (a === "plan") return path.join(opts.wsRoot, "runs", opts.runId, "outputs", "plan.md");
  if (a === "report") return path.join(opts.wsRoot, "runs", opts.runId, "outputs", "report.md");
  if (a === "research_pack" || a === "research" || a === "research-pack")
    return path.join(opts.wsRoot, "runs", opts.runId, "outputs", "research_pack.md");
  if (a === "decision_log" || a === "decisions" || a === "decision-log")
    return path.join(opts.wsRoot, "runs", opts.runId, "outputs", "decision_log.md");
  if (a === "creative_brief" || a === "brief" || a === "creative-brief")
    return path.join(opts.wsRoot, "runs", opts.runId, "outputs", "creative_brief.yaml");
  const err = new Error(
    `unknown artifact: ${opts.artifact} (try: research_pack, report, plan, decision_log, changeset, todos, context, creative_brief)`
  ) as Error & { exitCode?: number };
  err.exitCode = 2;
  throw err;
}

export function showArtifact(opts: ShowOptions): number {
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

  const runId = (() => {
    const raw = opts.runId.trim();
    if (raw === "latest" || raw === "last") {
      const runsDir = path.join(wsRoot, "runs");
      const candidates = runsNewestFirst(runsDir);
      if (candidates.length === 0) {
        const err = new Error(`no runs found for workspace: ${workspaceId}`) as Error & { exitCode?: number };
        err.exitCode = 10;
        throw err;
      }

      // Prefer the newest run that actually contains the requested artifact.
      for (const id of candidates) {
        try {
          const p = artifactPath({ wsRoot, runId: id, artifact: opts.artifact });
          if (fs.existsSync(p)) return id;
        } catch {
          // ignore; handled later
        }
      }

      // Fall back to newest run (gives a good error message with the exact path).
      return candidates[0];
    }
    return raw;
  })();

  const p = artifactPath({ wsRoot, runId, artifact: opts.artifact });
  if (!fs.existsSync(p)) {
    const err = new Error(`artifact not found: ${opts.artifact} (${p})`) as Error & { exitCode?: number };
    err.exitCode = 10;
    throw err;
  }

  process.stdout.write(fs.readFileSync(p, "utf-8"));
  if (!process.stdout.write("")) return 0;
  return 0;
}
