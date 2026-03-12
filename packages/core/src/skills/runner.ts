import Ajv2020Import from "ajv/dist/2020.js";
import addFormatsImport from "ajv-formats";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import YAML from "yaml";
import {
  ga4RunReport,
  getGoogleAccessToken,
  gscSearchAnalyticsQuery,
  requireEnv,
  gdriveDownloadFile,
  gdriveExportFile,
  gdriveGetMetadata,
  gdriveSearchFiles,
  type DriveFile
} from "@mar21/connectors";
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

function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function sanitizeModifiedTime(modifiedTime: string | undefined): string {
  if (!modifiedTime) return "unknown";
  const s = modifiedTime.trim();
  if (!s) return "unknown";
  return s.replace(/[^0-9TZ]/g, "");
}

function extForContentType(contentType: string): string {
  const ct = contentType.split(";")[0]?.trim().toLowerCase();
  if (ct === "text/plain") return "txt";
  if (ct === "text/csv") return "csv";
  if (ct === "application/pdf") return "pdf";
  if (ct === "application/json") return "json";
  if (ct === "text/markdown") return "md";
  return "bin";
}

function extFromName(name: string | undefined): string | null {
  if (!name) return null;
  const base = name.trim();
  if (!base) return null;
  const idx = base.lastIndexOf(".");
  if (idx === -1) return null;
  const ext = base.slice(idx + 1).toLowerCase();
  if (!/^[a-z0-9]{1,8}$/.test(ext)) return null;
  return ext;
}

function looksLikeEmail(text: string): boolean {
  return /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text);
}

function redactBasic(text: string): { redacted: string; stats: { emails: number; phones: number; longIds: number } } {
  let out = text;
  let emails = 0;
  let phones = 0;
  let longIds = 0;

  out = out.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, () => {
    emails += 1;
    return "[REDACTED_EMAIL]";
  });

  out = out.replace(/(\+?\d[\d\s().-]{7,}\d)/g, () => {
    phones += 1;
    return "[REDACTED_PHONE]";
  });

  out = out.replace(/(?=[A-Za-z0-9_-]{24,})(?=.*\d)[A-Za-z0-9_-]+/g, (m) => {
    longIds += 1;
    return `[REDACTED_ID:${Math.min(8, m.length)}]`;
  });

  return { redacted: out, stats: { emails, phones, longIds } };
}

function firstNChars(bytes: Uint8Array, n: number): string {
  const txt = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (txt.length <= n) return txt;
  return txt.slice(0, n);
}

function csvPreviewToMarkdown(csvText: string, maxLines = 25): string {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const head = lines.slice(0, maxLines);
  return ["```csv", ...head, "```", ""].join("\n");
}

function cachePathsForDrive(args: {
  workspaceRoot: string;
  fileId: string;
  modifiedTime: string | undefined;
  mode: "export" | "download";
  ext: string;
}): { rawPath: string; sidecarPath: string; cacheRef: string } {
  const mod = sanitizeModifiedTime(args.modifiedTime);
  const relDir = path.join("cache", "private", "gdrive", args.fileId, mod);
  const rawName = `${args.mode}.${args.ext}`;
  const rawPath = path.join(args.workspaceRoot, relDir, rawName);
  const sidecarPath = `${rawPath}.json`;
  return { rawPath, sidecarPath, cacheRef: path.join(relDir, rawName).replace(/\\/g, "/") };
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
  },

  "research.gdrive_ingest": async ({ ctx, inputs }) => {
    const fileIds = Array.isArray((inputs as any).fileIds) ? (inputs as any).fileIds.map(String) : [];
    const folderIds = Array.isArray((inputs as any).folderIds) ? (inputs as any).folderIds.map(String) : [];
    const query = (inputs as any).query === null ? null : (inputs as any).query ? String((inputs as any).query) : null;
    const limitsIn = (inputs as any).limits ?? {};
    const maxDownloads =
      typeof limitsIn.maxDownloads === "number" && limitsIn.maxDownloads >= 0 ? limitsIn.maxDownloads : 10;
    const maxFileSizeMB =
      typeof limitsIn.maxFileSizeMB === "number" && limitsIn.maxFileSizeMB >= 0 ? limitsIn.maxFileSizeMB : 25;

    if (fileIds.length === 0 && folderIds.length === 0 && (!query || query.trim().length === 0)) {
      const err = new Error("gdrive_ingest requires fileIds, folderIds, or query") as Error & { exitCode?: number };
      err.exitCode = 2;
      throw err;
    }

    const required = ["MAR21_GDRIVE_CLIENT_ID", "MAR21_GDRIVE_CLIENT_SECRET", "MAR21_GDRIVE_REFRESH_TOKEN"] as const;
    const missing = required.filter((n) => !process.env[n] || process.env[n]?.trim().length === 0);
    if (missing.length > 0) {
      const err = new Error(`missing required env var(s) for gdrive: ${missing.join(", ")}`) as Error & {
        exitCode?: number;
      };
      err.exitCode = 20;
      throw err;
    }

    const access = await getGoogleAccessToken({
      clientId: process.env.MAR21_GDRIVE_CLIENT_ID!.trim(),
      clientSecret: process.env.MAR21_GDRIVE_CLIENT_SECRET!.trim(),
      refreshToken: process.env.MAR21_GDRIVE_REFRESH_TOKEN!.trim()
    });

    const discovered: DriveFile[] = [];
    if (query || folderIds.length > 0) {
      for (const folderId of folderIds.length > 0 ? folderIds : [null]) {
        const res = await gdriveSearchFiles({
          accessToken: access.accessToken,
          query,
          folderId,
          limit: 50
        });
        for (const f of res.files) discovered.push(f);
      }
    }

    const allIds = new Set<string>([...fileIds, ...discovered.map((f) => f.id).filter(Boolean)]);
    const candidates = Array.from(allIds)
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
      .slice(0, 500);

    const metas: DriveFile[] = [];
    for (const id of candidates) {
      try {
        const m = await gdriveGetMetadata({ accessToken: access.accessToken, fileId: id });
        metas.push(m);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.log({ event: "gdrive.meta.failed", fileId: id, error: msg });
      }
    }

    const planned = metas
      .filter((m) => m.mimeType !== "application/vnd.google-apps.folder")
      .filter((m) => m.mimeType !== "application/vnd.google-apps.shortcut")
      .map((m) => ({
      fileId: m.id,
      name: m.name ?? "",
      mimeType: m.mimeType ?? "",
      modifiedTime: m.modifiedTime,
      sizeBytes: m.size ? Number(m.size) : null
    }));

    const plannedOrdered = [...planned].sort((a, b) => {
      const am = a.modifiedTime ?? "";
      const bm = b.modifiedTime ?? "";
      if (am !== bm) return bm.localeCompare(am); // newest first
      if (a.fileId !== b.fileId) return a.fileId.localeCompare(b.fileId);
      return a.name.localeCompare(b.name);
    });

    const maxFileBytes = maxFileSizeMB * 1024 * 1024;
    const oversized = new Set(
      plannedOrdered
        .filter((p) => p.sizeBytes !== null && p.sizeBytes > maxFileBytes)
        .map((p) => p.fileId)
    );

    const withinSize = plannedOrdered.filter((p) => !oversized.has(p.fileId));
    const allowed = withinSize.slice(0, maxDownloads);
    const allowedIds = new Set(allowed.map((p) => p.fileId));

    const skippedItems: Array<{ fileId: string; reason: "over_maxFileSizeMB" | "over_maxDownloads"; sizeBytes: number | null }> =
      [];
    for (const p of plannedOrdered) {
      if (oversized.has(p.fileId)) {
        skippedItems.push({ fileId: p.fileId, reason: "over_maxFileSizeMB", sizeBytes: p.sizeBytes });
      } else if (!allowedIds.has(p.fileId)) {
        skippedItems.push({ fileId: p.fileId, reason: "over_maxDownloads", sizeBytes: p.sizeBytes });
      }
    }

    const plannedExportCount = plannedOrdered.filter((p) => p.mimeType.startsWith("application/vnd.google-apps.")).length;
    const plannedDownloadCount = plannedOrdered.length - plannedExportCount;
    const approxMB = plannedOrdered.reduce((sum, p) => sum + (p.sizeBytes ? p.sizeBytes / (1024 * 1024) : 0), 0) || 0;

    const capsExceeded = skippedItems.length > 0;
    const decision = capsExceeded
      ? await ctx.confirmSensitiveRead({
          kind: plannedExportCount > 0 && plannedDownloadCount === 0 ? "gdrive_export" : "gdrive_download",
          count: plannedOrdered.length,
          approxMB,
          reason: `caps exceeded: planned=${plannedOrdered.length}, allowed=${allowed.length}, skipped=${skippedItems.length} (maxDownloads=${maxDownloads}, maxFileSizeMB=${maxFileSizeMB})`
        })
      : null;

    const toIngest = capsExceeded ? (decision ? plannedOrdered : allowed) : plannedOrdered;

    fs.mkdirSync(path.join(ctx.workspaceRoot, "cache", "private", "gdrive"), { recursive: true });

    const evidence: Array<{
      id: string;
      sourceRef: string;
      derivedFrom: string;
      path: string;
      contentType: string;
      redacted: boolean;
      sha256: string;
      notes?: string;
    }> = [];

    const sources: Array<Record<string, unknown>> = [];
    const accessedDate = new Date().toISOString().slice(0, 10);

    let sourceN = 0;
    for (const m of toIngest) {
      try {
        const sourceRef = `drive:fileId:${m.fileId}`;

        const isGoogleNative = m.mimeType.startsWith("application/vnd.google-apps.");
        const exportMime =
          m.mimeType === "application/vnd.google-apps.document"
            ? "text/plain"
            : m.mimeType === "application/vnd.google-apps.spreadsheet"
              ? "text/csv"
              : m.mimeType === "application/vnd.google-apps.presentation"
                ? "application/pdf"
                : null;

        const mode: "export" | "download" = isGoogleNative && exportMime ? "export" : "download";
        const expectedContentType = mode === "export" && exportMime ? exportMime : "application/octet-stream";
        const expectedExt =
          mode === "export" ? extForContentType(expectedContentType) : extFromName(m.name) ?? "bin";

        const { rawPath, sidecarPath, cacheRef } = cachePathsForDrive({
          workspaceRoot: ctx.workspaceRoot,
          fileId: m.fileId,
          modifiedTime: m.modifiedTime,
          mode,
          ext: expectedExt
        });
        fs.mkdirSync(path.dirname(rawPath), { recursive: true });

        // Cache-only raw retention: keep raw bytes out of run folder.
        let sha = "";
        let cachedContentType: string | null = null;
        if (fs.existsSync(rawPath) && fs.existsSync(sidecarPath)) {
          try {
            const side = JSON.parse(fs.readFileSync(sidecarPath, "utf-8")) as any;
            if (typeof side.sha256 === "string" && side.sha256.length >= 16) sha = side.sha256;
            if (typeof side.contentType === "string" && side.contentType.length > 0) cachedContentType = side.contentType;
          } catch {
            // ignore
          }
        }

        let bytes: Uint8Array;
        let contentType: string;
        let note = "";

        const cacheHit = Boolean(sha) && fs.existsSync(rawPath);
        if (cacheHit) {
          contentType = cachedContentType ?? expectedContentType;
          note = "cache hit";
          bytes =
            contentType === "text/plain" || contentType === "text/csv"
              ? new Uint8Array(fs.readFileSync(rawPath))
              : new Uint8Array();
        } else if (mode === "export" && exportMime) {
          const res = await gdriveExportFile({
            accessToken: access.accessToken,
            fileId: m.fileId,
            mimeType: exportMime
          });
          bytes = res.bytes;
          contentType = exportMime;
          note = `exported as ${exportMime}`;
        } else {
          const res = await gdriveDownloadFile({ accessToken: access.accessToken, fileId: m.fileId });
          bytes = res.bytes;
          contentType = res.contentType;
          note = "downloaded raw";
        }

        if (!sha) {
          sha = sha256Hex(bytes);
          fs.writeFileSync(rawPath, bytes);
          fs.writeFileSync(
            sidecarPath,
            `${JSON.stringify(
              {
                fetchedAt: new Date().toISOString(),
                fileId: m.fileId,
                name: m.name,
                mimeType: m.mimeType,
                modifiedTime: m.modifiedTime,
                mode,
                contentType,
                bytes: bytes.length,
                sha256: sha
              },
              null,
              2
            )}\n`,
            "utf-8"
          );
        }

        sourceN += 1;
        const sourceId = `S${sourceN + 1}`; // reserve S1 for public placeholder
        const evidenceId = `E${sourceN}`;
        const excerptPath = `outputs/evidence/gdrive_${m.fileId}.md`;

        let excerpt = `# Drive excerpt\n\n- source: ${sourceRef}\n- name: ${m.name || "(unknown)"}\n- mimeType: ${m.mimeType}\n- cached: ${cacheRef}\n- sha256: ${sha}\n- accessed: ${accessedDate}\n\n`;
        let redacted = true;

        if (contentType === "text/plain") {
          const rawText = firstNChars(bytes, 4000);
          const { redacted: r, stats } = redactBasic(rawText);
          excerpt += `## Excerpt (first 4k chars)\n\n${r}\n\n`;
          excerpt += `## Redaction\n\n- emails: ${stats.emails}\n- phones: ${stats.phones}\n- longIds: ${stats.longIds}\n\n`;
        } else if (contentType === "text/csv") {
          const rawText = firstNChars(bytes, 4000);
          const { redacted: r, stats } = redactBasic(rawText);
          excerpt += `## CSV preview (top rows)\n\n${csvPreviewToMarkdown(r)}\n`;
          excerpt += `## Redaction\n\n- emails: ${stats.emails}\n- phones: ${stats.phones}\n- longIds: ${stats.longIds}\n\n`;
        } else if (contentType === "application/pdf") {
          excerpt += `## Note\n\nPDF stored in cache. Text extraction is not implemented in v0.1.\n\n`;
        } else {
          excerpt += `## Note\n\nBinary stored in cache. No excerpt extractor for contentType=${contentType} in v0.1.\n\n`;
          redacted = true;
        }

        ctx.writeText(excerptPath, excerpt);

        evidence.push({
          id: evidenceId,
          sourceRef,
          derivedFrom: "private_doc",
          path: excerptPath,
          contentType: "text/markdown",
          redacted,
          sha256: sha,
          notes: note
        });

        sources.push({
          sourceId,
          type: "private_doc",
          sourceRef,
          name: m.name ?? null,
          mimeType: m.mimeType,
          modifiedTime: m.modifiedTime ?? null,
          accessedDate,
          excerptRef: excerptPath,
          sha256: sha
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.log({ event: "gdrive.ingest.failed", fileId: m.fileId, error: msg });
      }
    }

    ctx.writeJson("outputs/evidence/evidence.json", evidence);
    ctx.writeJson("outputs/evidence/gdrive_sources.json", {
      skipped: capsExceeded && !decision,
      plannedCount: plannedOrdered.length,
      appliedCount: toIngest.length,
      maxDownloads,
      maxFileSizeMB,
      capsExceeded,
      operatorApprovedToExceed: decision,
      skippedItems: capsExceeded && !decision ? skippedItems : [],
      sources
    });

    return {
      outputs: {
        evidenceManifestRef: "outputs/evidence/evidence.json",
        sourcesIndexRef: "outputs/evidence/gdrive_sources.json"
      }
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
