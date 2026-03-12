import process from "node:process";
import { loadProfile, profilePathFor } from "./profile.js";
import { runPlan, RunSummary } from "./run-engine.js";
import { Mode, resolveWorkspaceId, workspaceRoot } from "./workspace.js";
import fs from "node:fs";

export type AutopilotOptions = {
  workspace?: string;
  profileId: string;
  mode?: Mode;
  dryRun?: boolean;
  foreground?: boolean;
};

function repoRootFromCwd(): string {
  return process.cwd();
}

function intervalMsForProfile(profileId: string): number {
  const override = process.env.MAR21_AUTOPILOT_INTERVAL_MS;
  if (override) {
    const n = Number(override);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const id = profileId.toLowerCase();
  if (id === "daily") return 24 * 60 * 60 * 1000;
  if (id === "weekly") return 7 * 24 * 60 * 60 * 1000;
  if (id === "monthly") return 30 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function autopilotStart(opts: AutopilotOptions): Promise<void> {
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

  if (!opts.foreground) {
    const err = new Error("background mode not implemented (use --foreground)");
    (err as Error & { exitCode?: number }).exitCode = 2;
    throw err;
  }

  const profileId = opts.profileId.trim();
  const profile = loadProfile(profilePathFor(wsRoot, profileId));
  const intervalMs = intervalMsForProfile(profileId);

  process.stdout.write(`autopilot: started (workspace=${workspaceId}, profile=${profileId})\n`);
  process.stdout.write(`autopilot: interval=${Math.round(intervalMs / 1000)}s (v0.1 heuristic)\n`);

  let shouldStop = false;
  process.on("SIGINT", () => {
    shouldStop = true;
  });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (shouldStop) {
      process.stdout.write("autopilot: stopped\n");
      return;
    }
    const startedAt = new Date().toISOString();
    process.stdout.write(`\nautopilot: tick ${startedAt}\n`);

    const runs: RunSummary[] = [];
    for (const step of profile.steps) {
      runs.push(
        runPlan(step.workflowId, {
          workspace: workspaceId,
          mode: opts.mode ?? step.mode,
          since: step.since,
          dryRun: Boolean(opts.dryRun)
        })
      );
    }

    for (const r of runs) process.stdout.write(`- ${r.runId}\n`);
    process.stdout.write(`autopilot: sleep\n`);
    await sleep(intervalMs);
  }
}
