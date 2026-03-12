import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { initWorkspace } from "./init.js";
import { applyRunChangeset } from "./apply-engine.js";
import { runPlan } from "./run-engine.js";
import { resolveRepoRoot } from "./repo-root.js";
import { defaultModeFromContext, readYamlFile, resolveWorkspaceId, workspaceRoot, writeYamlFile, type Mode } from "./workspace.js";

type SessionOptions = {
  workspace?: string;
  since?: string;
  mode?: Mode;
};

function validateWorkspaceId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,31}$/.test(id);
}

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

function readTextIfExists(p: string): string | null {
  try {
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

function summarizeResearchPack(markdown: string, maxLines = 12): string[] {
  const lines = markdown.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => l.trim().toLowerCase() === "## findings (stub)" || l.trim().toLowerCase() === "## findings");
  const from = startIdx === -1 ? 0 : startIdx + 1;
  const out: string[] = [];
  for (let i = from; i < lines.length && out.length < maxLines; i += 1) {
    const l = lines[i] ?? "";
    if (l.trim().toLowerCase().startsWith("## sources")) break;
    if (l.trim().length === 0) continue;
    out.push(l);
  }
  return out;
}

function listNextActionsFromChangeset(wsRoot: string, runId: string): string[] {
  const p = path.join(wsRoot, "runs", runId, "changeset.yaml");
  const doc = fs.existsSync(p) ? (readYamlFile(p) as any) : null;
  const ops = Array.isArray(doc?.ops) ? (doc.ops as any[]) : [];
  const titles: string[] = [];
  for (const op of ops) {
    const operation = typeof op?.operation === "string" ? op.operation : "";
    if (!operation.endsWith("todo.create") && operation !== "mar21.todo.create") continue;
    const title = String(op?.params?.task?.title ?? "").trim();
    if (title) titles.push(title);
  }
  return titles;
}

function extractDriveId(raw: string): { kind: "file" | "folder"; id: string } | null {
  const s = raw.trim();
  if (!s) return null;

  const urlMatch = (() => {
    const m1 = /\/drive\/folders\/([a-zA-Z0-9_-]{10,})/.exec(s);
    if (m1) return { kind: "folder" as const, id: m1[1] };
    const m2 = /\/file\/d\/([a-zA-Z0-9_-]{10,})/.exec(s);
    if (m2) return { kind: "file" as const, id: m2[1] };
    const m3 = /\/document\/d\/([a-zA-Z0-9_-]{10,})/.exec(s);
    if (m3) return { kind: "file" as const, id: m3[1] };
    const m4 = /\/spreadsheets\/d\/([a-zA-Z0-9_-]{10,})/.exec(s);
    if (m4) return { kind: "file" as const, id: m4[1] };
    const m5 = /\/presentation\/d\/([a-zA-Z0-9_-]{10,})/.exec(s);
    if (m5) return { kind: "file" as const, id: m5[1] };
    const m6 = /[?&]id=([a-zA-Z0-9_-]{10,})/.exec(s);
    if (m6) return { kind: "file" as const, id: m6[1] };
    return null;
  })();
  if (urlMatch) return urlMatch;

  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return { kind: "file", id: s };
  return null;
}

function readContextSafe(contextPath: string): any {
  if (!fs.existsSync(contextPath)) return null;
  try {
    return readYamlFile(contextPath) as any;
  } catch {
    return null;
  }
}

export async function runSession(opts: SessionOptions): Promise<void> {
  const canPrompt = Boolean(process.stdin.isTTY);
  const repoRoot = resolveRepoRoot(process.cwd());

  let workspaceId = resolveWorkspaceId(opts.workspace) ?? null;
  if (!workspaceId) {
    if (!canPrompt) {
      const err = new Error("missing --workspace (or MAR21_WORKSPACE)") as Error & { exitCode?: number };
      err.exitCode = 2;
      throw err;
    }
    workspaceId = await promptText("Workspace name", "default");
  }
  workspaceId = workspaceId.trim();
  if (!validateWorkspaceId(workspaceId)) {
    const err = new Error(
      `invalid workspace id: ${workspaceId} (expected letters/numbers/dashes, 2–32 chars)`
    ) as Error & { exitCode?: number };
    err.exitCode = 2;
    throw err;
  }

  const wsRoot = workspaceRoot(repoRoot, workspaceId);
  if (!fs.existsSync(wsRoot)) {
    if (!canPrompt) {
      const err = new Error(`workspace not found: ${workspaceId} (${wsRoot})`) as Error & { exitCode?: number };
      err.exitCode = 10;
      throw err;
    }
    const create = await promptYesNo(`No workspace '${workspaceId}' found. Create it now?`, true);
    if (!create) {
      const err = new Error("session canceled") as Error & { exitCode?: number };
      err.exitCode = 10;
      throw err;
    }
    const stack = await promptText("Which stack preset? (default/content_engine/paid_growth/lifecycle)", "default");
    initWorkspace({ workspace: workspaceId, stack, force: false });
  }

  const contextPath = path.join(wsRoot, "marketing-context.yaml");
  const existingContext = readContextSafe(contextPath);
  const mode = (opts.mode ?? defaultModeFromContext(existingContext)) as Mode;
  const since = opts.since ?? "P28D";

  process.stdout.write("\nmar21 session — marketer mode (v0.1)\n");
  process.stdout.write("You answer a few questions; mar21 generates evidence-backed artifacts + a task backlog.\n\n");

  const companyNameDefault =
    typeof existingContext?.company?.name === "string" && existingContext.company.name.trim()
      ? existingContext.company.name.trim()
      : workspaceId;
  const companyName = canPrompt ? await promptText("What are we working on? (company/product name)", companyNameDefault) : companyNameDefault;

  const primaryKpiDefault =
    typeof existingContext?.goals?.primaryKpi === "string" && existingContext.goals.primaryKpi.trim()
      ? existingContext.goals.primaryKpi.trim()
      : "leads";
  const primaryKpi = canPrompt ? await promptText("Primary KPI (leads/pipeline/revenue/traffic)", primaryKpiDefault) : primaryKpiDefault;

  const objective = canPrompt
    ? await promptText("What outcome do you want from this session? (1 sentence)", "Tighten positioning + ship next-week plan")
    : "Tighten positioning + ship next-week plan";

  const updateContext = canPrompt ? await promptYesNo("Update your workspace context with these answers?", true) : true;
  if (updateContext) {
    const next = (existingContext && typeof existingContext === "object" ? { ...(existingContext as any) } : {}) as any;
    next.apiVersion = next.apiVersion ?? "mar21/v1";
    next.workspace = next.workspace ?? workspaceId;
    next.company = { ...(next.company ?? {}), name: companyName };
    next.goals = { ...(next.goals ?? {}), primaryKpi };
    writeYamlFile(contextPath, next);
  }

  const includeDrive = canPrompt ? await promptYesNo("Include private docs from Google Drive as sources?", false) : false;
  const driveSel = (() => {
    if (!includeDrive) return null;
    return { fileIds: [] as string[], folderIds: [] as string[], query: null as string | null, limits: { maxDownloads: 5, maxFileSizeMB: 25 } };
  })();

  if (driveSel && canPrompt) {
    const raw = await promptText("Paste a Drive link (file or folder) or an id (you can paste multiple, comma-separated)", "");
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    for (const p of parts) {
      const hit = extractDriveId(p);
      if (!hit) continue;
      if (hit.kind === "folder") driveSel.folderIds.push(hit.id);
      else driveSel.fileIds.push(hit.id);
    }

    if (driveSel.fileIds.length === 0 && driveSel.folderIds.length === 0) {
      const addQuery = await promptYesNo("No Drive ids detected. Use a Drive search query instead?", false);
      if (addQuery) {
        driveSel.query = await promptText("Drive query (example: name contains 'positioning')", "name contains 'positioning'");
      }
    }

    const maxDownloadsRaw = await promptText("Safety cap: max downloads", String(driveSel.limits.maxDownloads));
    const maxDownloads = Number(maxDownloadsRaw);
    if (Number.isFinite(maxDownloads) && maxDownloads >= 0) driveSel.limits.maxDownloads = maxDownloads;
  }

  process.stdout.write("\nRunning: Deep Research + Sparring…\n");
  const researchRun = await runPlan("deep_research_sparring", {
    workspace: workspaceId,
    mode,
    since,
    params: {
      research: {
        objective,
        sources: {
          drive: driveSel ? { ...driveSel } : undefined
        }
      }
    }
  });

  process.stdout.write(`✓ Research run created: ${researchRun.runId}\n`);
  process.stdout.write(`  Read it: pnpm mar21 show ${researchRun.runId} research_pack --workspace ${workspaceId}\n`);

  const rpPath = path.join(wsRoot, "runs", researchRun.runId, "outputs", "research_pack.md");
  const rp = readTextIfExists(rpPath);
  if (rp) {
    const summary = summarizeResearchPack(rp, 10);
    if (summary.length > 0) {
      process.stdout.write("\nTop findings (excerpt)\n");
      for (const l of summary) process.stdout.write(`  ${l}\n`);
    }
  }

  const nextActions = listNextActionsFromChangeset(wsRoot, researchRun.runId);
  if (nextActions.length > 0) {
    process.stdout.write("\nSuggested next actions\n");
    for (const t of nextActions.slice(0, 8)) process.stdout.write(`  - ${t}\n`);
    if (nextActions.length > 8) process.stdout.write(`  (+${nextActions.length - 8} more)\n`);
  }

  const applyNow = canPrompt ? await promptYesNo("Add suggested tasks to your backlog now?", true) : false;
  if (applyNow) {
    const applied = await applyRunChangeset({ workspace: workspaceId, runId: researchRun.runId, yes: true });
    if (applied.exitCode !== 0) {
      const err = new Error("apply had failures (see logs in the run folder)") as Error & { exitCode?: number };
      err.exitCode = applied.exitCode;
      throw err;
    }
    const appliedCount = applied.summary.results.filter((r) => r.status === "applied").length;
    process.stdout.write(`✓ Backlog updated (${appliedCount} item(s) applied)\n`);
  } else {
    process.stdout.write(`(Skipped) Apply later: pnpm mar21 apply ${researchRun.runId} --workspace ${workspaceId}\n`);
  }

  const doBrief = canPrompt ? await promptYesNo("Generate a landing page creative brief now?", true) : false;
  if (doBrief) {
    const briefRun = await runPlan("content_brief", { workspace: workspaceId, mode, since: "P0D" });
    process.stdout.write(`✓ Creative brief generated: ${briefRun.runId}\n`);
    process.stdout.write(`  Show it: pnpm mar21 show ${briefRun.runId} creative_brief --workspace ${workspaceId}\n`);
  }

  process.stdout.write("\nDone.\n");
  process.stdout.write(`Next: pnpm mar21 show latest todos --workspace ${workspaceId}\n`);
}
