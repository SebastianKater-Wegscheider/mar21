import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import YAML from "yaml";
import {
  defaultModeFromContext,
  ensureDir,
  Mode,
  readYamlFile,
  resolveWorkspaceId,
  slugifyWorkflowId,
  utcTimestampForRunId,
  workspaceRoot
} from "./workspace.js";

export type RunSummary = {
  runId: string;
  workspace: string;
  workflowId: string;
  mode: Mode;
  paths: { runDir: string; changeset: string };
};

export type PlanCommandOptions = {
  workspace?: string;
  mode?: Mode;
  since?: string;
  dryRun?: boolean;
  json?: boolean;
};

function repoRootFromCwd(): string {
  return process.cwd();
}

function pickRunId(runsDir: string, baseRunId: string): string {
  const candidate = (n?: number) => (n ? `${baseRunId}_${n}` : baseRunId);
  if (!fs.existsSync(path.join(runsDir, candidate()))) return candidate();

  for (let n = 2; n < 10_000; n += 1) {
    const c = candidate(n);
    if (!fs.existsSync(path.join(runsDir, c))) return c;
  }
  throw new Error(`could not allocate runId after many collisions: ${baseRunId}`);
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function writeText(filePath: string, data: string): void {
  fs.writeFileSync(filePath, data.endsWith("\n") ? data : `${data}\n`, "utf-8");
}

function nowIso(): string {
  return new Date().toISOString();
}

function planTemplate(workflowId: string): string {
  return `# Plan — ${workflowId}

## Goal
- (Single sentence) What outcome do we want?

## KPI Tree
- Primary KPI:
- Leading indicators:
- Lagging indicators:

## Hypotheses (ranked)
1) …
2) …
3) …

## Tasks (owners, ETA, measurement)
- [ ] Task — owner — ETA — measurement

## Assumptions & open questions
- Assumption:
- Open question:

## Guardrails (what we won’t do)
- …
`;
}

function reportTemplate(workflowId: string): string {
  return `# Report — ${workflowId}

## What changed (deltas + evidence refs)
- …

## Why (most likely causes)
- …

## What we did / will do (linked to ChangeSet ops)
- …

## Risks & unknowns
- …

## Next checkpoint
- …
`;
}

function logsLine(event: Record<string, unknown>): string {
  return `${JSON.stringify({ ts: nowIso(), level: "info", ...event })}\n`;
}

export function runPlan(workflowIdRaw: string, opts: PlanCommandOptions): RunSummary {
  const repoRoot = repoRootFromCwd();
  const workspaceId = resolveWorkspaceId(opts.workspace);
  if (!workspaceId) {
    const err = new Error("missing --workspace (or MAR21_WORKSPACE)");
    (err as Error & { exitCode?: number }).exitCode = 2;
    throw err;
  }

  const wsRoot = workspaceRoot(repoRoot, workspaceId);
  if (!fs.existsSync(wsRoot) || !fs.statSync(wsRoot).isDirectory()) {
    const err = new Error(`workspace not found: ${workspaceId} (${wsRoot})`);
    (err as Error & { exitCode?: number }).exitCode = 10;
    throw err;
  }

  const contextPath = path.join(wsRoot, "marketing-context.yaml");
  if (!fs.existsSync(contextPath)) {
    const err = new Error(`missing marketing context: ${contextPath}`);
    (err as Error & { exitCode?: number }).exitCode = 10;
    throw err;
  }

  const workflowId = workflowIdRaw.trim();
  const slug = slugifyWorkflowId(workflowId);
  const startedAt = nowIso();

  const runsDir = path.join(wsRoot, "runs");
  ensureDir(runsDir);
  const baseRunId = `${utcTimestampForRunId(new Date())}_${slug}`;
  const runId = pickRunId(runsDir, baseRunId);
  const runDir = path.join(runsDir, runId);

  const inputsDir = path.join(runDir, "inputs");
  const outputsDir = path.join(runDir, "outputs");
  const evidenceDir = path.join(outputsDir, "evidence");
  ensureDir(inputsDir);
  ensureDir(evidenceDir);

  const context = readYamlFile(contextPath);
  const mode: Mode = opts.mode ?? defaultModeFromContext(context);
  const since = opts.since ?? "P28D";

  fs.copyFileSync(contextPath, path.join(inputsDir, "context.snapshot.yaml"));
  writeText(
    path.join(inputsDir, "request.yaml"),
    YAML.stringify({
      apiVersion: "mar21/request-v1",
      workflowId,
      workspace: workspaceId,
      mode,
      since,
      params: {}
    })
  );

  writeText(path.join(outputsDir, "plan.md"), planTemplate(workflowId));
  writeText(path.join(outputsDir, "report.md"), reportTemplate(workflowId));

  writeText(
    path.join(runDir, "changeset.yaml"),
    YAML.stringify({
      apiVersion: "mar21/changeset-v1",
      runId,
      workspace: workspaceId,
      mode,
      ops: []
    })
  );

  const logsPath = path.join(runDir, "logs.jsonl");
  writeText(logsPath, logsLine({ event: "run.started", runId, workflowId, workspace: workspaceId }));
  fs.appendFileSync(logsPath, logsLine({ event: "run.outputs", outputsDir: "outputs/" }), "utf-8");

  writeJson(path.join(runDir, "approvals.json"), []);

  const finishedAt = nowIso();
  writeJson(path.join(runDir, "run.json"), {
    apiVersion: "mar21/run-v1",
    runId,
    workspace: workspaceId,
    workflowId,
    mode,
    since,
    startedAt,
    finishedAt,
    connectorsUsed: [],
    writesAttempted: false
  });

  fs.appendFileSync(logsPath, logsLine({ event: "run.finished", runId, finishedAt }), "utf-8");

  return {
    runId,
    workspace: workspaceId,
    workflowId,
    mode,
    paths: {
      runDir: path.relative(repoRoot, runDir),
      changeset: path.relative(repoRoot, path.join(runDir, "changeset.yaml"))
    }
  };
}

