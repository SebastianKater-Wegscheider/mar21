import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { loadProfile, profilePathFor } from "./profile.js";
import { runPlan, RunSummary } from "./run-engine.js";
import { Mode, resolveWorkspaceId, workspaceRoot } from "./workspace.js";
import { resolveRepoRoot } from "./repo-root.js";

export type RunCadenceOptions = {
  cadence: "daily" | "weekly" | "monthly";
  workspace?: string;
  profile?: string;
  mode?: Mode;
  since?: string;
  dryRun?: boolean;
};

export type RunCadenceSummary = {
  cadence: "daily" | "weekly" | "monthly";
  workspace: string;
  profileId: string;
  runs: RunSummary[];
};

function repoRootFromCwd(): string {
  return resolveRepoRoot(process.cwd());
}

export async function runCadence(opts: RunCadenceOptions): Promise<RunCadenceSummary> {
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

  const profileId = (opts.profile ?? opts.cadence).trim();
  const profile = loadProfile(profilePathFor(wsRoot, profileId));

  const runs: RunSummary[] = [];
  for (const step of profile.steps) {
    runs.push(
      await runPlan(step.workflowId, {
        workspace: workspaceId,
        mode: opts.mode ?? step.mode,
        since: opts.since ?? step.since,
        dryRun: Boolean(opts.dryRun)
      })
    );
  }

  return { cadence: opts.cadence, workspace: workspaceId, profileId: profile.id || profileId, runs };
}
