import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { ensureDir, readYamlFile, resolveWorkspaceId, writeYamlFile } from "./workspace.js";

type ChangeSetOp = {
  id: string;
  tool: string;
  operation: string;
  risk: "low" | "medium" | "high";
  requiresApproval: boolean;
  idempotencyKey?: string;
  params: Record<string, unknown>;
  rollbackHint?: string;
  evidenceRef?: string[];
  expectedImpact?: Record<string, unknown>;
};

type ChangeSet = {
  apiVersion: string;
  runId: string;
  workspace: string;
  mode: string;
  ops: ChangeSetOp[];
};

type ApprovalRecord = {
  opId: string;
  decision: "approved" | "rejected";
  decidedAt: string;
  by: "operator" | "cli";
  note?: string;
};

type ApplyResult = {
  opId: string;
  status: "applied" | "skipped" | "rejected" | "failed";
  message?: string;
};

export type ApplyOptions = {
  workspace?: string;
  runId: string;
  yes?: boolean;
  json?: boolean;
  failOnReject?: boolean;
};

export type ApplySummary = {
  runId: string;
  workspace: string;
  results: ApplyResult[];
};

type ApplyState = {
  apiVersion: "mar21/apply-v1";
  runId: string;
  ops: Array<{
    opId: string;
    idempotencyKey?: string;
    status: "applied" | "failed" | "rejected";
    at: string;
    message?: string;
  }>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function repoRootFromCwd(): string {
  return process.cwd();
}

function safeJoin(baseDir: string, relativePath: string): string {
  const resolved = path.resolve(baseDir, relativePath);
  const baseResolved = path.resolve(baseDir);
  if (!resolved.startsWith(`${baseResolved}${path.sep}`) && resolved !== baseResolved) {
    throw new Error(`refusing to access path outside base: ${relativePath}`);
  }
  return resolved;
}

function normalizePathRef(ref: string): string {
  return ref.replace(/\\/g, "/");
}

function appendLogLine(runDir: string, event: Record<string, unknown>): void {
  const logsPath = path.join(runDir, "logs.jsonl");
  const line = JSON.stringify({ ts: nowIso(), level: "info", ...event });
  fs.appendFileSync(logsPath, `${line}\n`, "utf-8");
}

function readApprovals(runDir: string): ApprovalRecord[] {
  const approvalsPath = path.join(runDir, "approvals.json");
  if (!fs.existsSync(approvalsPath)) return [];
  const raw = fs.readFileSync(approvalsPath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) ? (parsed as ApprovalRecord[]) : [];
}

function writeApprovals(runDir: string, approvals: ApprovalRecord[]): void {
  const approvalsPath = path.join(runDir, "approvals.json");
  fs.writeFileSync(approvalsPath, `${JSON.stringify(approvals, null, 2)}\n`, "utf-8");
}

function readApplyState(runDir: string, runId: string): ApplyState {
  const p = path.join(runDir, "apply.json");
  if (!fs.existsSync(p)) return { apiVersion: "mar21/apply-v1", runId, ops: [] };
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as any).apiVersion === "mar21/apply-v1" &&
      Array.isArray((parsed as any).ops)
    ) {
      return parsed as ApplyState;
    }
  } catch {
    // ignore and start fresh
  }
  return { apiVersion: "mar21/apply-v1", runId, ops: [] };
}

function writeApplyState(runDir: string, state: ApplyState): void {
  const p = path.join(runDir, "apply.json");
  fs.writeFileSync(p, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

function alreadyApplied(state: ApplyState, op: ChangeSetOp): boolean {
  if (state.ops.some((r) => r.opId === op.id && r.status === "applied")) return true;
  if (!op.idempotencyKey) return false;
  return state.ops.some((r) => r.idempotencyKey === op.idempotencyKey && r.status === "applied");
}

function recordApplyState(state: ApplyState, op: ChangeSetOp, status: ApplyState["ops"][number]["status"], message?: string): void {
  const existingIdx = state.ops.findIndex((r) => r.opId === op.id);
  const rec = {
    opId: op.id,
    idempotencyKey: op.idempotencyKey,
    status,
    at: nowIso(),
    message
  };
  if (existingIdx === -1) state.ops.push(rec);
  else state.ops[existingIdx] = rec;
}

async function promptApprove(op: ChangeSetOp, promptTo: NodeJS.WritableStream): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: promptTo
  });
  try {
    promptTo.write(`\nOperation: ${op.id}\n`);
    promptTo.write(`- tool: ${op.tool}\n`);
    promptTo.write(`- operation: ${op.operation}\n`);
    promptTo.write(`- risk: ${op.risk}\n`);
    if (op.evidenceRef?.length) promptTo.write(`- evidence: ${op.evidenceRef.join(", ")}\n`);
    if (op.rollbackHint) promptTo.write(`- rollback: ${op.rollbackHint}\n`);

    const answer = (await rl.question("Approve this operation? (y/n) ")).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

function normalizeOpName(op: string): string {
  const s = op.trim();
  if (s.startsWith("mar21.")) return s.slice("mar21.".length);
  return s;
}

function utcDateYYYYMMDD(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function nextTaskId(tasks: Array<{ taskId: string }>, date = new Date()): string {
  const ymd = utcDateYYYYMMDD(date);
  const prefix = `T-${ymd}-`;
  let max = 0;
  for (const t of tasks) {
    if (!t.taskId?.startsWith(prefix)) continue;
    const m = /^T-\d{8}-(\d{3})/.exec(t.taskId);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  for (let i = max + 1; i < 10_000; i += 1) {
    const candidate = `${prefix}${String(i).padStart(3, "0")}`;
    if (!tasks.some((t) => t.taskId === candidate)) return candidate;
  }
  throw new Error("could not allocate task id");
}

function applyTodoCreate(
  wsRoot: string,
  runId: string,
  op: ChangeSetOp
): { taskId: string; title: string } {
  const todosPath = path.join(wsRoot, "todos.yaml");
  const doc = (fs.existsSync(todosPath) ? readYamlFile(todosPath) : null) as any;
  const tasks = Array.isArray(doc?.tasks) ? (doc.tasks as any[]) : [];

  const taskParam = (op.params?.task ?? {}) as any;
  const title = String(taskParam.title ?? "").trim();
  if (!title) throw new Error("todo.create missing params.task.title");

  const taskId = String(taskParam.taskId ?? nextTaskId(tasks));
  const existing = tasks.find((t) => t.taskId === taskId);
  if (existing) {
    const createdBy = existing?.createdBy;
    if (createdBy?.runId === runId && createdBy?.opId === op.id) {
      return { taskId, title: String(existing.title ?? title) };
    }
    throw new Error(`task already exists: ${taskId}`);
  }

  const createdAt = nowIso();
  const task = {
    taskId,
    title,
    description: taskParam.description ? String(taskParam.description) : undefined,
    status: (taskParam.status as string) ?? "open",
    owner: taskParam.owner ? String(taskParam.owner) : "operator",
    dueDate: taskParam.dueDate ? String(taskParam.dueDate) : undefined,
    priority: (taskParam.priority as string) ?? "p2",
    tags: Array.isArray(taskParam.tags) ? taskParam.tags.map(String) : undefined,
    createdAt,
    updatedAt: undefined,
    createdBy: { runId, opId: op.id },
    evidenceRef: Array.isArray(taskParam.evidenceRef) ? taskParam.evidenceRef.map(String) : undefined,
    outcome: undefined
  };

  tasks.push(task);

  const nextDoc = {
    apiVersion: doc?.apiVersion ?? "mar21/todos-v1",
    workspace: doc?.workspace ?? path.basename(wsRoot),
    tasks
  };
  writeYamlFile(todosPath, nextDoc);

  return { taskId, title };
}

function applyTodoUpdate(wsRoot: string, op: ChangeSetOp): { taskId: string } {
  const todosPath = path.join(wsRoot, "todos.yaml");
  if (!fs.existsSync(todosPath)) throw new Error("todos.yaml missing");

  const doc = readYamlFile(todosPath) as any;
  const tasks = Array.isArray(doc?.tasks) ? (doc.tasks as any[]) : [];
  const taskId = String(op.params?.taskId ?? "").trim();
  if (!taskId) throw new Error("todo.update missing params.taskId");

  const patch = (op.params?.patch ?? {}) as any;
  const idx = tasks.findIndex((t) => t.taskId === taskId);
  if (idx === -1) throw new Error(`task not found: ${taskId}`);

  const task = { ...tasks[idx] };
  for (const [k, v] of Object.entries(patch)) {
    if (k === "taskId" || k === "createdAt" || k === "createdBy") continue;
    (task as any)[k] = v;
  }
  task.updatedAt = nowIso();
  tasks[idx] = task;

  writeYamlFile(todosPath, { ...doc, tasks });
  return { taskId };
}

function applyTodoClose(wsRoot: string, op: ChangeSetOp): { taskId: string; status: string } {
  const status = String(op.params?.status ?? "").trim();
  if (status !== "done" && status !== "canceled") {
    throw new Error("todo.close requires params.status of done|canceled");
  }

  const patch = {
    status,
    outcome: op.params?.outcome ?? undefined,
    evidenceRef: op.params?.evidenceRef ?? undefined
  };
  const taskId = String(op.params?.taskId ?? "").trim();
  if (!taskId) throw new Error("todo.close missing params.taskId");

  applyTodoUpdate(wsRoot, { ...op, params: { taskId, patch } });
  return { taskId, status };
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

function applyMemoryUpdate(wsRoot: string, runDir: string, op: ChangeSetOp): { file: string } {
  const file = normalizePathRef(String(op.params?.file ?? "").trim());
  const patchRef = normalizePathRef(String(op.params?.patchRef ?? "").trim());
  if (!file) throw new Error("memory.update missing params.file");
  if (!patchRef) throw new Error("memory.update missing params.patchRef");

  const targetPath = safeJoin(wsRoot, file);
  const patchPath = safeJoin(runDir, patchRef);
  if (!fs.existsSync(patchPath)) throw new Error(`patchRef not found: ${patchRef}`);

  const existing = fs.existsSync(targetPath) ? readYamlFile(targetPath) : null;
  const patch = readYamlFile(patchPath);

  let next: unknown;
  if (Array.isArray(patch)) {
    next = Array.isArray(existing) ? [...existing, ...patch] : patch;
  } else if (patch && typeof patch === "object" && "append" in (patch as any)) {
    const append = (patch as any).append;
    if (!Array.isArray(append)) throw new Error("memory patch append must be an array");
    next = Array.isArray(existing) ? [...existing, ...append] : append;
  } else {
    next = deepMerge(existing, patch);
  }

  ensureDir(path.dirname(targetPath));
  writeYamlFile(targetPath, next);
  return { file };
}

function applyMar21Op(wsRoot: string, runDir: string, runId: string, op: ChangeSetOp): string {
  const operation = normalizeOpName(op.operation);
  if (operation === "todo.create") {
    const res = applyTodoCreate(wsRoot, runId, op);
    return `created task ${res.taskId}`;
  }
  if (operation === "todo.update") {
    const res = applyTodoUpdate(wsRoot, op);
    return `updated task ${res.taskId}`;
  }
  if (operation === "todo.close") {
    const res = applyTodoClose(wsRoot, op);
    return `closed task ${res.taskId} (${res.status})`;
  }
  if (operation === "memory.update") {
    const res = applyMemoryUpdate(wsRoot, runDir, op);
    return `updated memory ${res.file}`;
  }
  throw new Error(`unsupported mar21 op: ${op.operation}`);
}

function readChangeSet(runDir: string): ChangeSet {
  const changesetPath = path.join(runDir, "changeset.yaml");
  if (!fs.existsSync(changesetPath)) throw new Error(`changeset not found: ${changesetPath}`);
  const cs = readYamlFile(changesetPath) as any;
  return cs as ChangeSet;
}

export async function applyRunChangeset(opts: ApplyOptions): Promise<{ summary: ApplySummary; exitCode: number }> {
  const repoRoot = repoRootFromCwd();
  const workspaceId = resolveWorkspaceId(opts.workspace);
  if (!workspaceId) {
    const err = new Error("missing --workspace (or MAR21_WORKSPACE)");
    (err as Error & { exitCode?: number }).exitCode = 2;
    throw err;
  }

  const wsRoot = path.join(repoRoot, "workspaces", workspaceId);
  if (!fs.existsSync(wsRoot)) {
    const err = new Error(`workspace not found: ${workspaceId}`);
    (err as Error & { exitCode?: number }).exitCode = 10;
    throw err;
  }

  const runDir = path.join(wsRoot, "runs", opts.runId);
  if (!fs.existsSync(runDir)) {
    const err = new Error(`run not found: ${opts.runId}`);
    (err as Error & { exitCode?: number }).exitCode = 10;
    throw err;
  }

  const cs = readChangeSet(runDir);
  appendLogLine(runDir, { event: "apply.started", runId: opts.runId });

  const approvals = readApprovals(runDir);
  const applyState = readApplyState(runDir, opts.runId);
  const results: ApplyResult[] = [];

  const promptTo = opts.json ? process.stderr : process.stdout;
  const canPrompt = Boolean(process.stdin.isTTY);

  for (const op of cs.ops ?? []) {
    if (alreadyApplied(applyState, op)) {
      appendLogLine(runDir, { event: "apply.op.skipped", opId: op.id, reason: "already_applied" });
      results.push({ opId: op.id, status: "skipped" });
      continue;
    }

    try {
      let approved = true;
      if (op.requiresApproval) {
        if (opts.yes) {
          approved = true;
        } else if (!canPrompt) {
          approved = false;
        } else {
          approved = await promptApprove(op, promptTo);
        }

        approvals.push({
          opId: op.id,
          decision: approved ? "approved" : "rejected",
          decidedAt: nowIso(),
          by: opts.yes ? "cli" : canPrompt ? "operator" : "cli",
          note: !opts.yes && !canPrompt ? "non_interactive: auto-rejected (use --yes for CI)" : undefined
        });
        writeApprovals(runDir, approvals);
        appendLogLine(runDir, {
          event: approved ? "apply.op.approved" : "apply.op.rejected",
          opId: op.id,
          tool: op.tool,
          operation: op.operation
        });

        if (!approved) {
          recordApplyState(applyState, op, "rejected");
          writeApplyState(runDir, applyState);
          results.push({ opId: op.id, status: "rejected" });
          continue;
        }
      }

      if (op.tool !== "mar21") throw new Error(`tool not implemented in v0.1: ${op.tool}`);

      const msg = applyMar21Op(wsRoot, runDir, opts.runId, op);
      appendLogLine(runDir, { event: "apply.op.applied", opId: op.id, message: msg });
      recordApplyState(applyState, op, "applied", msg);
      writeApplyState(runDir, applyState);
      results.push({ opId: op.id, status: "applied", message: msg });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendLogLine(runDir, { event: "apply.op.failed", opId: op.id, error: msg });
      recordApplyState(applyState, op, "failed", msg);
      writeApplyState(runDir, applyState);
      results.push({ opId: op.id, status: "failed", message: msg });
    }
  }

  appendLogLine(runDir, { event: "apply.finished", runId: opts.runId });

  const hadFailures = results.some((r) => r.status === "failed");
  const hadRejections = results.some((r) => r.status === "rejected");
  const summary: ApplySummary = { runId: opts.runId, workspace: workspaceId, results };
  if (hadFailures) return { summary, exitCode: 30 };
  if (opts.failOnReject && hadRejections) return { summary, exitCode: 30 };
  return { summary, exitCode: 0 };
}
