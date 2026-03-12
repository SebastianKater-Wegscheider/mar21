import Ajv2020Import from "ajv/dist/2020.js";
import addFormatsImport from "ajv-formats";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import YAML from "yaml";
import { ga4RunReport, getGoogleAccessToken, gscSearchAnalyticsQuery, requireEnv } from "@mar21/connectors";
import type { SkillDefinition, SkillExecutionResult, SkillManifest, SkillStep, RunContext } from "./types.js";

type Ajv2020Class = typeof import("ajv/dist/2020.js").default;
type Ajv2020Instance = InstanceType<Ajv2020Class>;

const Ajv2020 = Ajv2020Import as unknown as Ajv2020Class;
const addFormats = ((addFormatsImport as unknown as { default?: unknown }).default ??
  addFormatsImport) as unknown as (ajv: Ajv2020Instance) => void;

function walkSkillManifests(dirPath: string, out: string[]): void {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const p = path.join(dirPath, entry.name);
    if (entry.isDirectory()) walkSkillManifests(p, out);
    else if (entry.isFile() && entry.name === "skill.yaml") out.push(p);
  }
}

function readYamlFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, "utf-8");
  return YAML.parse(raw);
}

function buildAjv(): Ajv2020Instance {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function validateWithSchema(ajv: Ajv2020Instance, schema: Record<string, unknown>, instance: unknown): string[] {
  const validate = ajv.compile(schema as any);
  const ok = validate(instance);
  if (ok) return [];
  return (
    validate.errors?.map((e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`) ?? ["invalid"]
  );
}

function requiredString(x: unknown, field: string): string {
  if (typeof x === "string" && x.trim().length > 0) return x;
  throw new Error(`skill manifest missing/invalid ${field}`);
}

function asSkillManifest(doc: unknown, manifestPath: string): SkillManifest {
  if (!doc || typeof doc !== "object") throw new Error(`invalid YAML (expected object): ${manifestPath}`);
  const o = doc as any;
  if (o.apiVersion !== "mar21/skill-v1") throw new Error(`unsupported apiVersion in ${manifestPath}`);
  if (!o.inputs?.schema || typeof o.inputs.schema !== "object") throw new Error(`missing inputs.schema in ${manifestPath}`);
  if (!o.outputs?.schema || typeof o.outputs.schema !== "object") throw new Error(`missing outputs.schema in ${manifestPath}`);
  if (!o.artifacts?.produces || !Array.isArray(o.artifacts.produces)) throw new Error(`missing artifacts.produces in ${manifestPath}`);

  return {
    apiVersion: "mar21/skill-v1",
    id: requiredString(o.id, "id"),
    domain: requiredString(o.domain, "domain"),
    description: requiredString(o.description, "description"),
    inputs: { schema: o.inputs.schema as Record<string, unknown> },
    outputs: { schema: o.outputs.schema as Record<string, unknown> },
    usesConnectors: Array.isArray(o.usesConnectors) ? o.usesConnectors.map(String) : [],
    risk: {
      level: (o.risk?.level ?? "none") as SkillManifest["risk"]["level"],
      writes: Boolean(o.risk?.writes ?? false)
    },
    artifacts: { produces: o.artifacts.produces.map(String) },
    idempotency: {
      strategy: (o.idempotency?.strategy ?? "snapshot_based") as SkillManifest["idempotency"]["strategy"]
    }
  };
}

export function discoverSkills(repoRoot: string): SkillDefinition[] {
  const skillsDir = path.join(repoRoot, "skills");
  const manifestPaths: string[] = [];
  walkSkillManifests(skillsDir, manifestPaths);

  const defs: SkillDefinition[] = [];
  const byId = new Map<string, string>();
  for (const manifestPath of manifestPaths) {
    const doc = readYamlFile(manifestPath);
    const manifest = asSkillManifest(doc, manifestPath);

    const existing = byId.get(manifest.id);
    if (existing) {
      throw new Error(`duplicate skill id: ${manifest.id}\n- ${existing}\n- ${manifestPath}`);
    }
    byId.set(manifest.id, manifestPath);

    defs.push({
      manifestPath,
      dir: path.dirname(manifestPath),
      manifest
    });
  }

  return defs.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
}

type SkillImplResult = { outputs: unknown; ops?: Array<Record<string, unknown>> };
type SkillImpl = (args: { ctx: RunContext; inputs: Record<string, unknown> }) =>
  | SkillImplResult
  | Promise<SkillImplResult>;

function opId(skillId: string, suffix: string): string {
  const safeSkill = skillId.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
  const safeSuffix = suffix.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
  return `${safeSkill}_${safeSuffix}`.slice(0, 64);
}

const IMPLS: Record<string, SkillImpl> = {
  "content.brief_generate": ({ ctx, inputs }) => {
    const context = (ctx.context ?? {}) as any;
    const companyName = String(context?.company?.name ?? "Your Company");
    const industry = String(context?.company?.industry ?? "your category");
    const primaryKpi = String(context?.goals?.primaryKpi ?? "primary KPI");
    const tone = String(context?.constraints?.brandVoice?.tone ?? "professional");
    const assetType = String((inputs as any).assetType ?? "landing_page");

    const brief = {
      apiVersion: "mar21/creative-brief-v1",
      id: `brief_${ctx.runId}`,
      assetType,
      objective: `Increase ${primaryKpi} with an execution-ready asset that matches ${companyName}'s constraints.`,
      audience: {
        icp: context?.company?.industry ? `${industry} operators / buyers` : "Define ICP",
        pains: ["Define top pain", "Define top objection"],
        desiredOutcome: "Define desired outcome"
      },
      message: {
        promise: "Define a single, specific promise (no vague superlatives).",
        proof: ["Add proof points (case studies, data, process)."],
        objections: ["List top objections and how we answer them."],
        cta: "Define primary CTA (1)."
      },
      constraints: {
        tone,
        compliance: context?.constraints?.compliance ?? { gdpr: true },
        doNotSay: context?.constraints?.brandVoice?.doNotSay ?? []
      },
      measurement: {
        primaryKpi,
        utmConvention: "utm_source, utm_medium, utm_campaign are required; utm_content for variants"
      },
      variants: {
        system: "1 concept × 3 angles × 3 hooks (keep naming deterministic)",
        naming: "asset::<assetType>::<concept>::<angle>::<hook>::v<NN>"
      },
      notes: {
        generatedBy: "mar21 v0.1 (template skill)",
        inputs
      }
    };

    ctx.writeYaml("outputs/creative_brief.yaml", brief);

    return {
      outputs: {
        briefRef: "outputs/creative_brief.yaml",
        assetType,
        primaryKpi
      }
    };
  },

  "content.wordpress_draft_create": ({ ctx, inputs }) => {
    const context = (ctx.context ?? {}) as any;
    const companyName = String(context?.company?.name ?? "Your Company");
    const primaryCta = String((inputs as any).cta ?? "Book a demo");
    const title = String((inputs as any).title ?? `Landing page draft — ${companyName}`);

    const draft = `# ${title}\n\n## TL;DR\n- Outcome: <one sentence>\n- Proof: <one proof point>\n- CTA: **${primaryCta}**\n\n## The problem\n...\n\n## The approach\n...\n\n## Proof / credibility\n- Case study: ...\n- Metrics: ...\n\n## FAQs / objections\n- Q: ...\n  A: ...\n\n---\n\nCTA: ${primaryCta}\n`;

    ctx.writeText("outputs/drafts/wordpress_draft_v1.md", draft);

    const ops: Array<Record<string, unknown>> = [
      {
        id: opId("content.wordpress_draft_create", "todo_wordpress_draft"),
        tool: "mar21",
        operation: "mar21.todo.create",
        risk: "low",
        requiresApproval: true,
        params: {
          task: {
            title: "Create WordPress draft from outputs/drafts/wordpress_draft_v1.md",
            description:
              "Draft-only in v0.1. Paste/import the markdown and keep it unpublished until measurement is set.",
            owner: "operator",
            priority: "p1",
            tags: ["wordpress", "draft", "cro"],
            evidenceRef: ["outputs/drafts/wordpress_draft_v1.md", "outputs/creative_brief.yaml"]
          }
        }
      }
    ];

    return {
      outputs: {
        draftRef: "outputs/drafts/wordpress_draft_v1.md",
        title,
        cta: primaryCta
      },
      ops
    };
  },

  "ads.meta_creative_refresh_plan": ({ ctx, inputs }) => {
    const focus = String((inputs as any).focus ?? "creative fatigue + message-market fit");
    const plan = `# Creative Refresh Plan — Meta Ads\n\n## Focus\n- ${focus}\n\n## Checklist (v0.1)\n- [ ] Pull top ads by spend and result\n- [ ] Identify fatigue signals (CTR drop, CPM rise, frequency)\n- [ ] Generate 3 new angles from the latest brief\n- [ ] Produce a 3×3 variation matrix (angle × hook)\n- [ ] Ship in draft mode; measure for 7 days\n\n## Notes\n- This is a stub skill intended to produce an execution-ready checklist + tasks.\n`;
    ctx.writeText("outputs/creative_refresh_plan.md", plan);

    const ops: Array<Record<string, unknown>> = [
      {
        id: opId("ads.meta_creative_refresh_plan", "todo_matrix"),
        tool: "mar21",
        operation: "mar21.todo.create",
        risk: "low",
        requiresApproval: true,
        params: {
          task: {
            title: "Create 3×3 creative variation matrix for Meta Ads",
            description:
              "Use outputs/creative_brief.yaml to define 3 angles and 3 hooks; name assets deterministically.",
            owner: "operator",
            priority: "p2",
            tags: ["meta_ads", "creative"],
            evidenceRef: ["outputs/creative_refresh_plan.md", "outputs/creative_brief.yaml"]
          }
        }
      }
    ];

    return {
      outputs: { planRef: "outputs/creative_refresh_plan.md" },
      ops
    };
  },

  "analytics.weekly_review_evidence": async ({ ctx, inputs }) => {
    const ga4PropertyId =
      String((inputs as any).ga4PropertyId ?? "").trim() || (process.env.MAR21_GA4_PROPERTY_ID ?? "").trim();
    const gscSiteUrl =
      String((inputs as any).gscSiteUrl ?? "").trim() || (process.env.MAR21_GSC_SITE_URL ?? "").trim();

    const cacheRoot = path.join(ctx.workspaceRoot, "cache", "snapshots");
    const ensureDir = (p: string) => fs.mkdirSync(p, { recursive: true });
    ensureDir(cacheRoot);

    const cacheKey = (obj: unknown) => createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 16);
    const readCache = (connectorId: string, key: string): unknown | null => {
      const p = path.join(cacheRoot, connectorId, `${key}.json`);
      if (!fs.existsSync(p)) return null;
      try {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
      } catch {
        return null;
      }
    };
    const writeCache = (connectorId: string, key: string, payload: unknown): void => {
      const dir = path.join(cacheRoot, connectorId);
      ensureDir(dir);
      fs.writeFileSync(path.join(dir, `${key}.json`), `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
    };

    const hasGa4Signal =
      Boolean(ga4PropertyId) ||
      Boolean(process.env.MAR21_GA4_REFRESH_TOKEN || process.env.MAR21_GA4_CLIENT_ID || process.env.MAR21_GA4_CLIENT_SECRET);
    const hasGscSignal =
      Boolean(gscSiteUrl) ||
      Boolean(process.env.MAR21_GSC_REFRESH_TOKEN || process.env.MAR21_GSC_CLIENT_ID || process.env.MAR21_GSC_CLIENT_SECRET);

    if (!hasGa4Signal && !hasGscSignal) {
      ctx.writeJson("outputs/evidence/ga4_report.json", { configured: false, reason: "ga4 not configured" });
      ctx.writeJson("outputs/evidence/gsc_queries.json", { configured: false, reason: "gsc not configured" });
      ctx.writeText(
        "outputs/report.md",
        `# Report — weekly_review\n\n## Evidence\n- GA4: not configured (set MAR21_GA4_* env vars)\n- GSC: not configured (set MAR21_GSC_* env vars)\n\n## Next\n- Run \`mar21 init --connectors ga4,gsc\` (or update secrets/.env) and re-run.\n`
      );
      return {
        outputs: { ga4EvidenceRef: "outputs/evidence/ga4_report.json", gscEvidenceRef: "outputs/evidence/gsc_queries.json" }
      };
    }

    const ga4Enabled = hasGa4Signal;
    const gscEnabled = hasGscSignal;

    const ga4Access = ga4Enabled
      ? await getGoogleAccessToken({
          clientId: requireEnv("MAR21_GA4_CLIENT_ID"),
          clientSecret: requireEnv("MAR21_GA4_CLIENT_SECRET"),
          refreshToken: requireEnv("MAR21_GA4_REFRESH_TOKEN")
        })
      : null;
    const gscAccess = gscEnabled
      ? await getGoogleAccessToken({
          clientId: requireEnv("MAR21_GSC_CLIENT_ID"),
          clientSecret: requireEnv("MAR21_GSC_CLIENT_SECRET"),
          refreshToken: requireEnv("MAR21_GSC_REFRESH_TOKEN")
        })
      : null;

    const ga4Req = ga4Enabled
      ? {
          propertyId: ga4PropertyId || requireEnv("MAR21_GA4_PROPERTY_ID"),
          since: ctx.since,
          dimensions: ["sessionDefaultChannelGroup"],
          metrics: ["sessions", "totalUsers"],
          limit: 50
        }
      : null;
    const gscReq = gscEnabled
      ? {
          siteUrl: gscSiteUrl || requireEnv("MAR21_GSC_SITE_URL"),
          since: ctx.since,
          dimensions: ["query"] as Array<"query" | "page" | "country" | "device">,
          rowLimit: 100
        }
      : null;

    const ga4Data = ga4Req
      ? (() => {
          const key = cacheKey({ cap: "ga4.read.report.run", ...ga4Req });
          const cached = readCache("ga4", key);
          return { key, cached };
        })()
      : null;
    const gscData = gscReq
      ? (() => {
          const key = cacheKey({ cap: "gsc.read.search_analytics.query", ...gscReq });
          const cached = readCache("gsc", key);
          return { key, cached };
        })()
      : null;

    const ga4Payload =
      ga4Req && ga4Access
        ? ga4Data?.cached ?? (await ga4RunReport({ accessToken: ga4Access.accessToken, ...ga4Req }))
        : { configured: false, reason: "ga4 not configured" };
    const gscPayload =
      gscReq && gscAccess
        ? gscData?.cached ?? (await gscSearchAnalyticsQuery({ accessToken: gscAccess.accessToken, ...gscReq }))
        : { configured: false, reason: "gsc not configured" };

    if (ga4Req && ga4Access && ga4Data && !ga4Data.cached) {
      writeCache("ga4", ga4Data.key, { fetchedAt: new Date().toISOString(), request: ga4Req, data: ga4Payload });
    }
    if (gscReq && gscAccess && gscData && !gscData.cached) {
      writeCache("gsc", gscData.key, { fetchedAt: new Date().toISOString(), request: gscReq, data: gscPayload });
    }

    ctx.writeJson("outputs/evidence/ga4_report.json", ga4Payload);
    ctx.writeJson("outputs/evidence/gsc_queries.json", gscPayload);

    const report = `# Report — weekly_review\n\n## Evidence (this run)\n- GA4: \`outputs/evidence/ga4_report.json\`\n- GSC: \`outputs/evidence/gsc_queries.json\`\n\n## Notes\n- GA4 and GSC use different attribution and measurement assumptions. Treat them as complementary.\n- End dates default to “yesterday” (UTC) to avoid partial-day volatility.\n\n## Next actions\n- Turn the top movers into hypotheses and ship draft variants (landing page + ads + email) linked to UTMs.\n`;
    ctx.writeText("outputs/report.md", report);

    return {
      outputs: { ga4EvidenceRef: "outputs/evidence/ga4_report.json", gscEvidenceRef: "outputs/evidence/gsc_queries.json" }
    };
  }
};

function requireImpl(skillId: string): SkillImpl {
  const impl = IMPLS[skillId];
  if (!impl) throw new Error(`skill not implemented in v0.1: ${skillId}`);
  return impl;
}

export async function executeSkillPipeline(args: {
  ctx: RunContext;
  steps: SkillStep[];
}): Promise<SkillExecutionResult[]> {
  const defs = discoverSkills(args.ctx.repoRoot);
  const byId = new Map<string, SkillDefinition>(defs.map((d) => [d.manifest.id, d]));

  const ajv = buildAjv();
  const results: SkillExecutionResult[] = [];

  for (const step of args.steps) {
    const def = byId.get(step.skillId);
    if (!def) throw new Error(`skill not found: ${step.skillId} (expected skill.yaml under skills/)`);

    args.ctx.log({ event: "skill.started", skillId: step.skillId });

    const inputs = step.inputs ?? {};
    const inputErrors = validateWithSchema(ajv, def.manifest.inputs.schema, inputs);
    if (inputErrors.length > 0) {
      throw new Error(
        `skill input validation failed: ${step.skillId}\n- manifest: ${path.relative(args.ctx.repoRoot, def.manifestPath)}\n- ${inputErrors.join("\n- ")}`
      );
    }

    const impl = requireImpl(step.skillId);
    const { outputs, ops } = await Promise.resolve(impl({ ctx: args.ctx, inputs }));

    const outputErrors = validateWithSchema(ajv, def.manifest.outputs.schema, outputs);
    if (outputErrors.length > 0) {
      throw new Error(
        `skill output validation failed: ${step.skillId}\n- manifest: ${path.relative(args.ctx.repoRoot, def.manifestPath)}\n- ${outputErrors.join("\n- ")}`
      );
    }

    const missingArtifacts = def.manifest.artifacts.produces.filter((p) => !args.ctx.exists(p));
    if (missingArtifacts.length > 0) {
      throw new Error(
        `skill missing required artifacts: ${step.skillId}\n- ${missingArtifacts.join("\n- ")}`
      );
    }

    results.push({
      skillId: step.skillId,
      outputs,
      artifacts: def.manifest.artifacts.produces,
      ops: ops ?? []
    });
    args.ctx.log({ event: "skill.finished", skillId: step.skillId });
  }

  return results;
}
