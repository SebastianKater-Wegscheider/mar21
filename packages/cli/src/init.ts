import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import YAML from "yaml";
import { ensureDir } from "./workspace.js";

export type InitOptions = {
  workspace?: string;
  stack?: string;
  connectors?: string;
  force?: boolean;
};

function findRepoRootFromCwd(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 25; i += 1) {
    const packagesDir = path.join(dir, "packages");
    const schemasDir = path.join(dir, "schemas");
    const docsDir = path.join(dir, "docs");
    if (fs.existsSync(packagesDir) && fs.existsSync(schemasDir) && fs.existsSync(docsDir)) return dir;

    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function validateWorkspaceId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,31}$/.test(id);
}

type ConnectorId =
  | "gsc"
  | "ga4"
  | "meta_ads"
  | "hubspot"
  | "shopify"
  | "wordpress"
  | "slack"
  | "klaviyo"
  | "gdrive"
  | "ahrefs";

const CONNECTOR_ORDER: ConnectorId[] = [
  "gsc",
  "ga4",
  "meta_ads",
  "hubspot",
  "shopify",
  "wordpress",
  "slack",
  "klaviyo",
  "gdrive",
  "ahrefs"
];

const STACK_PRESETS: Record<string, ConnectorId[]> = {
  default: ["gsc", "ga4", "meta_ads", "hubspot", "shopify", "wordpress", "slack", "klaviyo", "gdrive"],
  content_engine: ["gsc", "ga4", "wordpress", "slack", "gdrive", "ahrefs"],
  paid_growth: ["ga4", "meta_ads", "slack"],
  lifecycle: ["ga4", "shopify", "klaviyo", "slack"]
};

function parseConnectors(raw: string): ConnectorId[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const unknown: string[] = [];
  const selected = new Set<ConnectorId>();
  for (const p of parts) {
    if (!/^[a-z0-9_]+$/.test(p)) {
      unknown.push(p);
      continue;
    }
    if (!CONNECTOR_ORDER.includes(p as ConnectorId)) unknown.push(p);
    else selected.add(p as ConnectorId);
  }

  if (unknown.length > 0) {
    const err = new Error(
      `unknown connector id(s): ${unknown.join(", ")} (supported: ${CONNECTOR_ORDER.join(", ")})`
    );
    (err as Error & { exitCode?: number }).exitCode = 2;
    throw err;
  }

  return CONNECTOR_ORDER.filter((c) => selected.has(c));
}

function resolveConnectorSelection(opts: InitOptions): ConnectorId[] {
  if (opts.connectors && opts.connectors.trim().length > 0) return parseConnectors(opts.connectors);

  const preset = (opts.stack?.trim() || "default").toLowerCase();
  const selected = STACK_PRESETS[preset];
  if (!selected) {
    const err = new Error(
      `unknown stack preset: ${preset} (supported: ${Object.keys(STACK_PRESETS).join(", ")})`
    );
    (err as Error & { exitCode?: number }).exitCode = 2;
    throw err;
  }
  return CONNECTOR_ORDER.filter((c) => selected.includes(c));
}

function envTemplateForConnectors(workspaceId: string, connectors: ConnectorId[]): string {
  const lines: string[] = [];
  lines.push("# mar21 workspace secrets (never commit)");
  lines.push("# Put secrets here and load them into your shell before running mar21.");
  lines.push("# Example:");
  lines.push("#   set -a; source secrets/.env; set +a");
  lines.push("");
  lines.push("# Workspace (optional convenience)");
  lines.push(`# MAR21_WORKSPACE=${workspaceId}`);
  lines.push("");

  const has = (id: ConnectorId) => connectors.includes(id);

  if (has("gsc")) {
    lines.push("## Google Search Console (gsc)");
    lines.push("# OAuth app: Google Cloud Console -> APIs & Services -> Credentials");
    lines.push("MAR21_GSC_CLIENT_ID=");
    lines.push("MAR21_GSC_CLIENT_SECRET=");
    lines.push("MAR21_GSC_REFRESH_TOKEN=");
    lines.push("# Optional convenience:");
    lines.push("# MAR21_GSC_SITE_URL=https://example.com/");
    lines.push("");
  }

  if (has("ga4")) {
    lines.push("## Google Analytics 4 (ga4)");
    lines.push("# OAuth app: Google Cloud Console -> APIs & Services -> Credentials");
    lines.push("MAR21_GA4_CLIENT_ID=");
    lines.push("MAR21_GA4_CLIENT_SECRET=");
    lines.push("MAR21_GA4_REFRESH_TOKEN=");
    lines.push("# Optional convenience:");
    lines.push("# MAR21_GA4_PROPERTY_ID=123456789");
    lines.push("");
  }

  if (has("meta_ads")) {
    lines.push("## Meta Ads (meta_ads)");
    lines.push("# Create a long-lived access token with the required permissions (Meta for Developers).");
    lines.push("MAR21_META_ADS_ACCESS_TOKEN=");
    lines.push("MAR21_META_ADS_ACCOUNT_ID=");
    lines.push("");
  }

  if (has("hubspot")) {
    lines.push("## HubSpot (hubspot)");
    lines.push("# Create a Private App token in HubSpot.");
    lines.push("MAR21_HUBSPOT_PRIVATE_APP_TOKEN=");
    lines.push("");
  }

  if (has("shopify")) {
    lines.push("## Shopify (shopify)");
    lines.push("# Create an Admin API access token for your app in Shopify.");
    lines.push("MAR21_SHOPIFY_ACCESS_TOKEN=");
    lines.push("# Example: your-store.myshopify.com");
    lines.push("MAR21_SHOPIFY_STORE_DOMAIN=");
    lines.push("");
  }

  if (has("wordpress")) {
    lines.push("## WordPress (wordpress)");
    lines.push("# Create an application password for a WordPress user account.");
    lines.push("# Example: https://www.example.com");
    lines.push("MAR21_WORDPRESS_BASE_URL=");
    lines.push("# Format: username:application_password (draft-only writes in v0.1)");
    lines.push("MAR21_WORDPRESS_APP_PASSWORD=");
    lines.push("");
  }

  if (has("slack")) {
    lines.push("## Slack (slack)");
    lines.push("# Create a Slack app and install it to your workspace; copy the Bot User OAuth token.");
    lines.push("MAR21_SLACK_BOT_TOKEN=");
    lines.push("# Optional convenience:");
    lines.push("# MAR21_SLACK_DEFAULT_CHANNEL=#marketing");
    lines.push("");
  }

  if (has("klaviyo")) {
    lines.push("## Klaviyo (klaviyo)");
    lines.push("# Create a Private API key in Klaviyo.");
    lines.push("MAR21_KLAVIYO_PRIVATE_API_KEY=");
    lines.push("");
  }

  if (has("gdrive")) {
    lines.push("## Google Drive (gdrive)");
    lines.push("# OAuth app: Google Cloud Console -> APIs & Services -> Credentials");
    lines.push("MAR21_GDRIVE_CLIENT_ID=");
    lines.push("MAR21_GDRIVE_CLIENT_SECRET=");
    lines.push("MAR21_GDRIVE_REFRESH_TOKEN=");
    lines.push("");
  }

  if (has("ahrefs")) {
    lines.push("## Ahrefs (ahrefs) — optional / experimental (often via MCP)");
    lines.push("# If using Ahrefs API directly:");
    lines.push("MAR21_AHREFS_API_KEY=");
    lines.push("# If using an MCP server or gateway, document its URL here:");
    lines.push("# MAR21_AHREFS_MCP_URL=http://localhost:port");
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
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

  const repoRoot = findRepoRootFromCwd() ?? process.cwd();
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
  if (!fs.existsSync(secretsEnvPath) || opts.force) {
    const connectors = resolveConnectorSelection(opts);
    fs.writeFileSync(secretsEnvPath, envTemplateForConnectors(workspaceId, connectors), "utf-8");
  }

  for (const name of ["learnings.yaml", "winners.yaml", "losers.yaml", "exclusions.yaml"] as const) {
    const p = path.join(wsRoot, "memory", name);
    if (!fs.existsSync(p) || opts.force) fs.writeFileSync(p, "# mar21 memory (v1)\n", "utf-8");
  }

  return { workspace: workspaceId, root: path.relative(repoRoot, wsRoot) };
}
