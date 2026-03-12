import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import YAML from "yaml";
import { executeSkillPipeline, type SkillExecutionResult, type SkillStep } from "@mar21/core";
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
  requestPath?: string;
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
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function writeText(filePath: string, data: string): void {
  ensureDir(path.dirname(filePath));
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

async function promptYesNo(prompt: string, promptTo: NodeJS.WritableStream): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: promptTo
  });
  try {
    const answer = (await rl.question(prompt)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

function safeJoin(baseDir: string, relativePath: string): string {
  const resolved = path.resolve(baseDir, relativePath);
  const baseResolved = path.resolve(baseDir);
  if (!resolved.startsWith(`${baseResolved}${path.sep}`) && resolved !== baseResolved) {
    throw new Error(`refusing to access path outside base: ${relativePath}`);
  }
  return resolved;
}

function skillOutputsPath(skillId: string): string {
  const safe = skillId.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
  return `outputs/skill_outputs/${safe}.json`;
}

function writeRequestYaml(args: {
  inputsDir: string;
  workflowId: string;
  workspaceId: string;
  mode: Mode;
  since: string;
  params?: Record<string, unknown>;
}): void {
  const req = {
    apiVersion: "mar21/request-v1",
    workflowId: args.workflowId,
    workspace: args.workspaceId,
    mode: args.mode,
    since: args.since,
    params: args.params ?? {}
  };
  writeText(path.join(args.inputsDir, "request.yaml"), YAML.stringify(req));
}

function deepMerge(a: unknown, b: unknown): unknown {
  if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
  if (a && typeof a === "object" && b && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
    for (const [k, v] of Object.entries(b as Record<string, unknown>)) {
      out[k] = k in out ? deepMerge(out[k], v) : v;
    }
    return out;
  }
  return b;
}

function loadRequestPatch(filePath: string): { params?: Record<string, unknown> } {
  let doc: unknown;
  try {
    doc = readYamlFile(filePath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const exitCode = (e as any)?.exitCode;
    const err = new Error(`failed to read request patch: ${filePath}\n${msg}`) as Error & { exitCode?: number };
    err.exitCode = typeof exitCode === "number" ? exitCode : 2;
    throw err;
  }
  const o = doc as any;
  if (!o || typeof o !== "object") return {};
  const params = o.params;
  if (params && typeof params === "object" && !Array.isArray(params)) return { params: params as Record<string, unknown> };
  return {};
}

/*
function runPlanSyncDeprecated(workflowIdRaw: string, opts: PlanCommandOptions): RunSummary {
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

  const patchedParams = (() => {
    const base = opts.params ?? {};
    if (!opts.requestPath) return base;
    const p = path.resolve(process.cwd(), opts.requestPath);
    const patch = loadRequestPatch(p);
    if (!patch.params) return base;
    return deepMerge(base, patch.params) as Record<string, unknown>;
  })();

  fs.copyFileSync(contextPath, path.join(inputsDir, "context.snapshot.yaml"));
  writeRequestYaml({ inputsDir, workflowId, workspaceId, mode, since, params: patchedParams });

  writeText(path.join(outputsDir, "plan.md"), planTemplate(workflowId));
  writeText(path.join(outputsDir, "report.md"), reportTemplate(workflowId));

  const logsPath = path.join(runDir, "logs.jsonl");
  writeText(logsPath, logsLine({ event: "run.started", runId, workflowId, workspace: workspaceId }));

  const request = {
    apiVersion: "mar21/request-v1",
    workflowId,
    workspace: workspaceId,
    mode,
    since,
    params: patchedParams
  };

  const ctx = {
    repoRoot,
    workspaceId,
    workspaceRoot: wsRoot,
    runId,
    runDir,
    inputsDir,
    outputsDir,
    evidenceDir,
    mode,
    since,
    dryRun: Boolean(opts.dryRun),
    context,
    request,
    writeText: (relativePath: string, content: string) =>
      writeText(safeJoin(runDir, relativePath), content),
    writeJson: (relativePath: string, data: unknown) => writeJson(safeJoin(runDir, relativePath), data),
    writeYaml: (relativePath: string, data: unknown) =>
      writeText(safeJoin(runDir, relativePath), YAML.stringify(data)),
    exists: (relativePath: string) => fs.existsSync(safeJoin(runDir, relativePath)),
    log: (event: Record<string, unknown>) => fs.appendFileSync(logsPath, logsLine(event), "utf-8"),
    confirmSensitiveRead: async (args: {
      kind: "gdrive_download" | "gdrive_export";
      count: number;
      approxMB: number;
      reason: string;
    }): Promise<boolean> => {
      const canPrompt = Boolean(process.stdin.isTTY);
      const promptTo = opts.json ? process.stderr : process.stdout;

      fs.appendFileSync(
        logsPath,
        logsLine({
          event: "sensitive_read.prompt",
          kind: args.kind,
          count: args.count,
          approxMB: args.approxMB,
          reason: args.reason,
          interactive: canPrompt
        }),
        "utf-8"
      );

      if (!canPrompt) {
        fs.appendFileSync(
          logsPath,
          logsLine({ event: "sensitive_read.decision", kind: args.kind, decision: "rejected", note: "non_interactive" }),
          "utf-8"
        );
        return false;
      }

      const ok = await promptYesNo(
        `This run will ${args.kind === "gdrive_export" ? "export" : "download"} ${args.count} Drive file(s) (~${args.approxMB.toFixed(
          1
        )} MB). Continue? (y/n) `,
        promptTo
      );
      fs.appendFileSync(
        logsPath,
        logsLine({ event: "sensitive_read.decision", kind: args.kind, decision: ok ? "approved" : "rejected" }),
        "utf-8"
      );
      return ok;
    }
  } as const;

  const changeset: Record<string, unknown> = {
    apiVersion: "mar21/changeset-v1",
    runId,
    workspace: workspaceId,
    mode,
    ops: []
  };

  const ops: Array<Record<string, unknown>> = [];
  const skillsExecuted: SkillExecutionResult[] = [];

  const pipelineForWorkflow = (slugId: string): SkillStep[] => {
    if (slugId === "deep_research_sparring") {
      const drive = (request as any)?.params?.research?.sources?.drive ?? null;
      const hasSelectors =
        Boolean(drive?.query) ||
        (Array.isArray(drive?.fileIds) && drive.fileIds.length > 0) ||
        (Array.isArray(drive?.folderIds) && drive.folderIds.length > 0);
      if (hasSelectors) {
        return [
          {
            skillId: "research.gdrive_ingest",
            inputs: {
              fileIds: Array.isArray(drive?.fileIds) ? drive.fileIds : undefined,
              folderIds: Array.isArray(drive?.folderIds) ? drive.folderIds : undefined,
              query: drive?.query ?? null,
              limits: drive?.limits ?? undefined
            }
          }
        ];
      }
      return [];
    }
    if (slugId === "weekly_review" || slugId === "report_weekly" || slugId === "report_weekly_review") {
      return [{ skillId: "analytics.weekly_review_evidence", inputs: {} }];
    }
    if (slugId === "content_brief") {
      return [{ skillId: "content.brief_generate", inputs: { assetType: "landing_page" } }];
    }
    if (slugId === "landing_page_iteration") {
      return [
        { skillId: "content.brief_generate", inputs: { assetType: "landing_page" } },
        { skillId: "content.wordpress_draft_create", inputs: {} },
        { skillId: "ads.meta_creative_refresh_plan", inputs: {} }
      ];
    }
    return [];
  };

  const pipeline = pipelineForWorkflow(slug);
  if (pipeline.length > 0) {
    try {
      const res = executeSkillPipeline({ ctx: ctx as any, steps: pipeline });
      for (const r of res) {
        skillsExecuted.push(r);
        ctx.writeJson(skillOutputsPath(r.skillId), r.outputs);
        for (const op of r.ops) ops.push(op);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      ctx.log({ event: "run.failed", runId, error: msg });
      throw e;
    }
  }

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

    for (const op of deepResearchSparringOps()) ops.push(op);
  }

  (changeset as any).ops = ops;
  writeText(path.join(runDir, "changeset.yaml"), YAML.stringify(changeset));

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
    skillsExecuted: skillsExecuted.map((s) => s.skillId),
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
*/
export async function runPlan(workflowIdRaw: string, opts: PlanCommandOptions): Promise<RunSummary> {
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

  const patchedParams = (() => {
    const base = (opts.params ?? {}) as Record<string, unknown>;
    if (!opts.requestPath) return base;
    const p = path.resolve(process.cwd(), opts.requestPath);
    const patch = loadRequestPatch(p);
    if (!patch.params) return base;
    return deepMerge(base, patch.params) as Record<string, unknown>;
  })();

  fs.copyFileSync(contextPath, path.join(inputsDir, "context.snapshot.yaml"));
  writeRequestYaml({ inputsDir, workflowId, workspaceId, mode, since, params: patchedParams });

  writeText(path.join(outputsDir, "plan.md"), planTemplate(workflowId));
  writeText(path.join(outputsDir, "report.md"), reportTemplate(workflowId));

  const logsPath = path.join(runDir, "logs.jsonl");
  writeText(logsPath, logsLine({ event: "run.started", runId, workflowId, workspace: workspaceId }));
  if (opts.requestPath) {
    fs.appendFileSync(
      logsPath,
      logsLine({ event: "request.patch.applied", requestPatch: path.basename(opts.requestPath) }),
      "utf-8"
    );
  }

  const request = {
    apiVersion: "mar21/request-v1",
    workflowId,
    workspace: workspaceId,
    mode,
    since,
    params: patchedParams
  };

  const ctx = {
    repoRoot,
    workspaceId,
    workspaceRoot: wsRoot,
    runId,
    runDir,
    inputsDir,
    outputsDir,
    evidenceDir,
    mode,
    since,
    dryRun: Boolean(opts.dryRun),
    context,
    request,
    writeText: (relativePath: string, content: string) => writeText(safeJoin(runDir, relativePath), content),
    writeJson: (relativePath: string, data: unknown) => writeJson(safeJoin(runDir, relativePath), data),
    writeYaml: (relativePath: string, data: unknown) =>
      writeText(safeJoin(runDir, relativePath), YAML.stringify(data)),
    exists: (relativePath: string) => fs.existsSync(safeJoin(runDir, relativePath)),
    log: (event: Record<string, unknown>) => fs.appendFileSync(logsPath, logsLine(event), "utf-8"),
    confirmSensitiveRead: async (args: {
      kind: "gdrive_download" | "gdrive_export";
      count: number;
      approxMB: number;
      reason: string;
    }): Promise<boolean> => {
      const canPrompt = Boolean(process.stdin.isTTY);
      const promptTo = opts.json ? process.stderr : process.stdout;

      fs.appendFileSync(
        logsPath,
        logsLine({
          event: "sensitive_read.prompt",
          kind: args.kind,
          count: args.count,
          approxMB: args.approxMB,
          reason: args.reason,
          interactive: canPrompt
        }),
        "utf-8"
      );

      if (!canPrompt) {
        fs.appendFileSync(
          logsPath,
          logsLine({ event: "sensitive_read.decision", kind: args.kind, decision: "rejected", note: "non_interactive" }),
          "utf-8"
        );
        return false;
      }

      const ok = await promptYesNo(
        `This run will ${args.kind === "gdrive_export" ? "export" : "download"} ${args.count} Drive file(s) (~${args.approxMB.toFixed(
          1
        )} MB). Continue? (y/n) `,
        promptTo
      );
      fs.appendFileSync(
        logsPath,
        logsLine({ event: "sensitive_read.decision", kind: args.kind, decision: ok ? "approved" : "rejected" }),
        "utf-8"
      );
      return ok;
    }
  } as const;

  const changeset: Record<string, unknown> = {
    apiVersion: "mar21/changeset-v1",
    runId,
    workspace: workspaceId,
    mode,
    ops: []
  };

  const ops: Array<Record<string, unknown>> = [];
  const skillsExecuted: SkillExecutionResult[] = [];

  const pipelineForWorkflow = (slugId: string): SkillStep[] => {
    if (slugId === "weekly_review" || slugId === "report_weekly" || slugId === "report_weekly_review") {
      return [{ skillId: "analytics.weekly_review_evidence", inputs: {} }];
    }
    if (slugId === "content_brief") {
      return [{ skillId: "content.brief_generate", inputs: { assetType: "landing_page" } }];
    }
    if (slugId === "landing_page_iteration") {
      return [
        { skillId: "content.brief_generate", inputs: { assetType: "landing_page" } },
        { skillId: "content.wordpress_draft_create", inputs: {} },
        { skillId: "ads.meta_creative_refresh_plan", inputs: {} }
      ];
    }
    return [];
  };

  const pipeline = pipelineForWorkflow(slug);
  if (pipeline.length > 0) {
    try {
      const res = await executeSkillPipeline({ ctx: ctx as any, steps: pipeline });
      for (const r of res) {
        skillsExecuted.push(r);
        ctx.writeJson(skillOutputsPath(r.skillId), r.outputs);
        for (const op of r.ops) ops.push(op);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      ctx.log({ event: "run.failed", runId, error: msg });
      throw e;
    }
  }

  if (slug === "deep_research_sparring") {
    const accessedAt = nowIso();

    const driveSel = (() => {
      const p = (request.params ?? {}) as any;
      const d = p?.research?.sources?.drive;
      if (!d || typeof d !== "object") return null;
      const fileIds = Array.isArray(d.fileIds) ? d.fileIds.map(String) : [];
      const folderIds = Array.isArray(d.folderIds) ? d.folderIds.map(String) : [];
      const query = d.query === null ? null : typeof d.query === "string" ? d.query : d.query ? String(d.query) : null;
      const limits = d.limits && typeof d.limits === "object" ? d.limits : undefined;
      const enabled = fileIds.length > 0 || folderIds.length > 0 || (query && query.trim().length > 0);
      if (!enabled) return null;
      return { fileIds, folderIds, query, limits };
    })();

    if (driveSel) {
      const res = await executeSkillPipeline({
        ctx: ctx as any,
        steps: [{ skillId: "research.gdrive_ingest", inputs: driveSel }]
      });
      for (const r of res) {
        skillsExecuted.push(r);
        ctx.writeJson(skillOutputsPath(r.skillId), r.outputs);
        for (const op of r.ops) ops.push(op);
      }
    }

    const sourcesPath = path.join(evidenceDir, "gdrive_sources.json");
    const sourcesData = (() => {
      if (!fs.existsSync(sourcesPath)) return null;
      const parsed = JSON.parse(fs.readFileSync(sourcesPath, "utf-8")) as any;
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.sources) ? parsed.sources : null;
      if (!Array.isArray(arr)) return null;
      return {
        meta: {
          plannedCount: typeof parsed?.plannedCount === "number" ? parsed.plannedCount : null,
          appliedCount: typeof parsed?.appliedCount === "number" ? parsed.appliedCount : null,
          maxDownloads: typeof parsed?.maxDownloads === "number" ? parsed.maxDownloads : null,
          maxFileSizeMB: typeof parsed?.maxFileSizeMB === "number" ? parsed.maxFileSizeMB : null,
          skippedItemsCount: Array.isArray(parsed?.skippedItems) ? parsed.skippedItems.length : null
        },
        sources: arr as Array<{
          sourceId?: string;
          sourceRef?: string;
          name?: string | null;
          accessedDate?: string;
          excerptRef?: string;
        }>
      };
    })();

    const accessed = accessedAt.slice(0, 10);
    const lines: string[] = [];
    lines.push("# Research Pack — deep_research_sparring");
    lines.push("");
    lines.push("This is a **v0.1** research pack scaffold:");
    lines.push("- claims should be tied to sources via `[S#]`");
    lines.push("- sources can be **public** and **private** (e.g. Drive refs)");
    lines.push("");
    lines.push("## Findings (stub)");
    lines.push(
      "- Evidence-based loops beat ad-hoc tactics: map recommendations to KPI nodes and measurable next actions. [S1]"
    );
    if (sourcesData && sourcesData.sources.length > 0) {
      const firstSid = sourcesData.sources[0]?.sourceId ?? "S2";
      const extra =
        sourcesData.meta.skippedItemsCount && sourcesData.meta.skippedItemsCount > 0
          ? ` (${sourcesData.meta.skippedItemsCount} skipped due to caps)`
          : "";
      lines.push(
        `- Private sources ingested from Drive (${sourcesData.sources.length})${extra}. See excerpts. [${firstSid}]`
      );
    } else {
      lines.push("- No private sources ingested in this run (provide request params to enable Drive).");
    }
    lines.push("");
    lines.push("## Sources");
    lines.push(
      `- [S1] (public_url) mar21 Best Practices — mar21 repo — https://github.com/SebastianKater-Wegscheider/mar21/blob/main/docs/BEST_PRACTICES.md — accessed ${accessed}`
    );
    if (sourcesData && sourcesData.sources.length > 0) {
      for (const s of sourcesData.sources) {
        const sid = s.sourceId ?? "S?";
        const ref = s.sourceRef ?? "drive:fileId:unknown";
        const name = s.name ? String(s.name) : "(unnamed)";
        const ad = s.accessedDate ?? accessed;
        lines.push(`- [${sid}] (private_doc) ${name} — ${ref} — accessed ${ad}`);
      }
    }
    lines.push("");
    if (sourcesData && sourcesData.sources.length > 0) {
      lines.push("## Private excerpts");
      for (const s of sourcesData.sources) {
        if (!s.excerptRef) continue;
        const sid = s.sourceId ?? "S?";
        lines.push(`- [${sid}] ${s.excerptRef}`);
      }
      lines.push("");
    }

    writeText(path.join(outputsDir, "research_pack.md"), `${lines.join("\n")}\n`);
    writeText(path.join(outputsDir, "decision_log.md"), deepDecisionLogTemplate(accessedAt));

    const evidenceJsonPath = path.join(evidenceDir, "evidence.json");
    if (!fs.existsSync(evidenceJsonPath)) writeJson(evidenceJsonPath, []);

    for (const op of deepResearchSparringOps()) ops.push(op);
  }

  (changeset as any).ops = ops;
  writeText(path.join(runDir, "changeset.yaml"), YAML.stringify(changeset));

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
    skillsExecuted: skillsExecuted.map((s) => s.skillId),
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

export async function runAnalyze(scopeRaw: string, opts: PlanCommandOptions): Promise<RunSummary> {
  const scope = scopeRaw.trim();
  const workflowId = `analyze_${slugifyWorkflowId(scope)}`;
  return runPlan(workflowId, {
    ...opts,
    params: { ...(opts.params ?? {}), scope }
  });
}

export async function runReport(argRaw: string, opts: PlanCommandOptions): Promise<RunSummary> {
  const arg = argRaw.trim();
  const workflowId = `report_${slugifyWorkflowId(arg)}`;
  return runPlan(workflowId, {
    ...opts,
    params: { ...(opts.params ?? {}), cadenceOrWorkflowId: arg }
  });
}
