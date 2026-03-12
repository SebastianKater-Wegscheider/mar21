import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import YAML from "yaml";
import { ensureDir } from "./workspace.js";

export type InitOptions = {
  workspace?: string;
  force?: boolean;
};

function repoRootFromCwd(): string {
  return process.cwd();
}

function validateWorkspaceId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,31}$/.test(id);
}

export function initWorkspace(opts: InitOptions): { workspace: string; root: string } {
  const workspaceId = opts.workspace?.trim();
  if (!workspaceId) {
    const err = new Error("missing --workspace");
    (err as Error & { exitCode?: number }).exitCode = 2;
    throw err;
  }
  if (!validateWorkspaceId(workspaceId)) {
    const err = new Error(
      `invalid workspace id: ${workspaceId} (expected /^[a-z0-9][a-z0-9-]{1,31}$/)`
    );
    (err as Error & { exitCode?: number }).exitCode = 10;
    throw err;
  }

  const repoRoot = repoRootFromCwd();
  const wsRoot = path.join(repoRoot, "workspaces", workspaceId);

  if (fs.existsSync(wsRoot)) {
    if (!opts.force) {
      const err = new Error(`workspace already exists: ${wsRoot} (use --force to overwrite)`);
      (err as Error & { exitCode?: number }).exitCode = 10;
      throw err;
    }
  }

  ensureDir(path.join(wsRoot, "secrets"));
  ensureDir(path.join(wsRoot, "_cfg"));
  ensureDir(path.join(wsRoot, "profiles"));
  ensureDir(path.join(wsRoot, "memory"));
  ensureDir(path.join(wsRoot, "cache", "snapshots"));
  ensureDir(path.join(wsRoot, "runs"));

  const contextPath = path.join(wsRoot, "marketing-context.yaml");
  if (!fs.existsSync(contextPath) || opts.force) {
    fs.writeFileSync(
      contextPath,
      YAML.stringify({
        apiVersion: "mar21/v1",
        workspace: workspaceId,
        company: {
          name: "Your Company",
          industry: "B2B SaaS",
          region: "EU",
          languages: ["en", "de"]
        },
        businessModel: {
          segment: "b2b_saas",
          monetization: "subscription",
          pricing: { avgOrderValue: null, avgContractValue: 1200, currency: "EUR" }
        },
        goToMarket: {
          stage: "validation",
          channels: {
            seo: { enabled: true, primary: true },
            paid_social: { enabled: true, primary: false },
            lifecycle_email: { enabled: true, primary: false }
          }
        },
        goals: {
          primaryKpi: "pipeline",
          secondaryKpis: ["traffic", "leads"],
          kpiTree: {
            pipeline: { leading: ["mqls", "sqls"], lagging: ["closed_won"] }
          }
        },
        constraints: {
          compliance: { gdpr: true, sensitiveData: false },
          brandVoice: { tone: "professional", doNotSay: ["guaranteed", "best in class"] },
          autonomy: { defaultMode: "supervised", allowlist: [] },
          budgets: { monthly: { total: 0, breakdown: {} } }
        }
      })
    );
  }

  const todosPath = path.join(wsRoot, "todos.yaml");
  if (!fs.existsSync(todosPath) || opts.force) {
    fs.writeFileSync(
      todosPath,
      YAML.stringify({ apiVersion: "mar21/todos-v1", workspace: workspaceId, tasks: [] })
    );
  }

  const secretsEnvPath = path.join(wsRoot, "secrets", ".env");
  if (!fs.existsSync(secretsEnvPath)) {
    fs.writeFileSync(
      secretsEnvPath,
      `# mar21 workspace secrets (never commit)\n# Example:\n# GSC_CLIENT_ID=\n# GSC_CLIENT_SECRET=\n`,
      "utf-8"
    );
  }

  for (const name of ["learnings.yaml", "winners.yaml", "losers.yaml", "exclusions.yaml"] as const) {
    const p = path.join(wsRoot, "memory", name);
    if (!fs.existsSync(p) || opts.force) fs.writeFileSync(p, "# mar21 memory (v1)\n", "utf-8");
  }

  return { workspace: workspaceId, root: path.relative(repoRoot, wsRoot) };
}

