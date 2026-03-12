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
  params?: Record<string, unknown>;
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

function deepResearchPackTemplate(args: {
  workspaceId: string;
  runId: string;
  accessedDate: string;
}): string {
  const accessed = args.accessedDate.slice(0, 10);
  return `# Research Pack — deep_research_sparring

This is a **stub research pack** (v0.1) intended to prove the artifact contract:
- claims are tied to sources via \`[S#]\`
- sources can be **public** and **private** (e.g. Drive refs)

## Research questions
- What is the highest-leverage positioning wedge for the next 30 days?
- Which channels are most likely to drive the primary KPI with lowest execution risk?
- What creative system (brief → variants → distribution) should we stand up first?

## Findings
- “Evidence-based loops” beat ad-hoc tactics: every recommendation must map to a KPI node and a measurable next action. [S1]
- For this workspace, “auditability / control” is a plausible differentiation angle worth testing in messaging and creative. [S2]
- Autonomy defaults to supervised; we should express execution as tasks + drafts until measurement is stable. [S3]

## Implications for strategy
- Positioning: test an “auditability/control” narrative in 2–3 variants (short, medium, proof-led).
- Channel mix: start with one capture channel + one nurture channel; keep everything traceable via UTMs.
- Creative system: produce a reusable brief + asset naming rules so learnings compound.

## Gaps / unknowns
- We have no real category/competitor scrape in v0.1; add public sources and competitor URLs in a later iteration.
- Private-doc ingestion is represented as evidence stubs only; real Drive pulls come later.

## Sources
- [S1] (public_url) mar21 Best Practices — mar21 repo — https://github.com/SebastianKater-Wegscheider/mar21/blob/main/docs/BEST_PRACTICES.md — accessed ${accessed}
- [S2] (private_doc) ICP interviews memo (fixture) — Internal — drive:fileId:pdf987 — accessed ${accessed}
- [S3] (internal_snapshot) Context snapshot — ${args.workspaceId} — inputs/context.snapshot.yaml — accessed ${accessed}
`;
}

function deepDecisionLogTemplate(accessedDate: string): string {
  const accessed = accessedDate.slice(0, 10);
  return `# Decision Log — deep_research_sparring

## Date
- ${accessed}

## Decisions
- Keep default mode \`supervised\` until KPI definitions + tracking are stable.
- Express execution as \`mar21.todo.*\` tasks and drafts first; only then allow tool writes.

## Assumptions
- The workspace’s primary KPI is correctly defined in \`marketing-context.yaml\`.
- A “control/auditability” angle resonates with the target segment (to be validated).

## Tradeoffs
- We prefer auditability and repeatability over speed of fully-automated changes.
`;
}

function deepResearchSparringOps(): Array<Record<string, unknown>> {
  return [
    {
      id: "todo_define_message_variants",
      tool: "mar21",
      operation: "mar21.todo.create",
      risk: "low",
      requiresApproval: true,
      params: {
        task: {
          title: "Draft 3 messaging variants (auditability/control angle)",
          description:
            "Create short/medium/proof-led versions. Use Research Pack findings and ensure claims are supportable.",
          owner: "operator",
          priority: "p1",
          tags: ["copy", "positioning"],
          evidenceRef: ["outputs/research_pack.md"]
        }
      }
    },
    {
      id: "todo_create_creative_brief_v1",
      tool: "mar21",
      operation: "mar21.todo.create",
      risk: "low",
      requiresApproval: true,
      params: {
        task: {
          title: "Create Creative Brief v1 + variation system",
          description: "One brief that can feed ads + landing page + lifecycle email. Define naming/versioning.",
          owner: "operator",
          priority: "p1",
          tags: ["creative", "system"],
          evidenceRef: ["outputs/research_pack.md"]
        }
      }
    },
    {
      id: "todo_distribution_plan_v1",
      tool: "mar21",
      operation: "mar21.todo.create",
      risk: "low",
      requiresApproval: true,
      params: {
        task: {
          title: "Create Distribution Plan v1 (repurpose + syndicate)",
          description: "Define the first repurpose map and where each asset gets distributed.",
          owner: "operator",
          priority: "p2",
          tags: ["distribution"],
          evidenceRef: ["outputs/research_pack.md"]
        }
      }
    }
  ];
}

function logsLine(event: Record<string, unknown>): string {
  return `${JSON.stringify({ ts: nowIso(), level: "info", ...event })}\n`;
}

function writeRequestYaml(args: {
  inputsDir: string;
  workflowId: string;
  workspaceId: string;
  mode: Mode;
  since: string;
  params?: Record<string, unknown>;
}): void {
  writeText(
    path.join(args.inputsDir, "request.yaml"),
    YAML.stringify({
      apiVersion: "mar21/request-v1",
      workflowId: args.workflowId,
      workspace: args.workspaceId,
      mode: args.mode,
      since: args.since,
      params: args.params ?? {}
    })
  );
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
  writeRequestYaml({ inputsDir, workflowId, workspaceId, mode, since, params: opts.params });

  writeText(path.join(outputsDir, "plan.md"), planTemplate(workflowId));
  writeText(path.join(outputsDir, "report.md"), reportTemplate(workflowId));

  const changeset: Record<string, unknown> = {
    apiVersion: "mar21/changeset-v1",
    runId,
    workspace: workspaceId,
    mode,
    ops: []
  };

  if (slug === "deep_research_sparring") {
    const accessedAt = nowIso();

    writeText(path.join(outputsDir, "research_pack.md"), deepResearchPackTemplate({ workspaceId, runId, accessedDate: accessedAt }));
    writeText(path.join(outputsDir, "decision_log.md"), deepDecisionLogTemplate(accessedAt));

    // Optional fixture evidence (no real APIs yet): emulate a redacted Drive extract.
    writeText(
      path.join(evidenceDir, "gdrive_pdf987.md"),
      `# Redacted extract (fixture)\n\n- Objection: “We need control / audit trails.”\n- Implication: messaging + proof should address auditability.\n`
    );
    writeJson(
      path.join(evidenceDir, "evidence.json"),
      [
        {
          id: "E1",
          sourceRef: "drive:fileId:pdf987",
          derivedFrom: "private_doc",
          path: "outputs/evidence/gdrive_pdf987.md",
          contentType: "text/markdown",
          redacted: true,
          sha256: "00000000000000000000000000000000",
          notes: "Fixture evidence for v0.1; redacted."
        }
      ]
    );

    changeset.ops = deepResearchSparringOps();
  }

  writeText(path.join(runDir, "changeset.yaml"), YAML.stringify(changeset));

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

export function runAnalyze(scopeRaw: string, opts: PlanCommandOptions): RunSummary {
  const scope = scopeRaw.trim();
  const workflowId = `analyze_${slugifyWorkflowId(scope)}`;
  return runPlan(workflowId, {
    ...opts,
    params: { ...(opts.params ?? {}), scope }
  });
}

export function runReport(argRaw: string, opts: PlanCommandOptions): RunSummary {
  const arg = argRaw.trim();
  const workflowId = `report_${slugifyWorkflowId(arg)}`;
  return runPlan(workflowId, {
    ...opts,
    params: { ...(opts.params ?? {}), cadenceOrWorkflowId: arg }
  });
}
