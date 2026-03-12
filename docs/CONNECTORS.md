# mar21 Connectors (Integration Spec)

Connectors are the **API boundary** between `mar21` and external marketing tools. A connector is not “a thin client”—it is a **capability-declaring, safety-aware module** that makes tool operations:
- discoverable (capabilities manifest),
- auditable (run artifacts + logs),
- safe (risk levels + dry-run + approvals),
- portable (tool semantics are mapped into stable ops).

This document defines **v1 tool scope** and **capability boundaries**.

## MCP-first (default)
`mar21` is **MCP-first**:
- Prefer using MCP servers for integrations (pluggable, discoverable tools).
- Keep `mar21` focused on the stable surface: artifacts, approvals, caps, evidence indexing, and run auditability.

See `docs/MCP.md`.

v1 first-class tools:
- SEO: Google Search Console (`gsc`)
- Analytics: GA4 (`ga4`)
- Ads: Meta Ads (`meta_ads`)
- CRM: HubSpot (`hubspot`)
- Commerce: Shopify (`shopify`)
- CMS: WordPress (`wordpress`)
- Comms: Slack (`slack`)
- Email: Klaviyo (`klaviyo`)
- Private docs: Google Drive (`gdrive`, all file types)

For exhaustive per-tool capability catalogs, see `docs/connectors/README.md`.

Research packs may also cite **private documents** (Notion/Drive/Confluence/etc.). In v1 this can be handled as:
- manual doc refs inside `outputs/research_pack.md`, and/or
- local files placed into `runs/<id>/inputs/` (treated as private evidence),
with dedicated “docs connectors” being a later expansion.

Priority private-doc connector:
- **Google Drive / Google Docs (`gdrive`)**

## Connector rules (non-negotiable)
- **Least privilege by default**: prefer read-only scopes; write scopes are explicit and separable.
- **Dry-run always** for write ops: validate + compute intended effect without applying.
- **Rate limits are first-class**: connectors own retry/backoff; orchestrator treats them as bounded resources.
- **No PII in logs**: redact at the connector boundary.
- **Capability naming is stable**: skills reference capability ids, not SDK methods.

## Capability naming convention
Capability ids follow:

`<tool>.<read|write>.<resource>.<verb>`

Examples:
- `ga4.read.report.run`
- `gsc.read.search_analytics.query`
- `meta_ads.read.insights.by_adset`
- `wordpress.write.post.create_draft`
- `slack.write.message.post`

## Risk model for connector ops
Each capability must declare a risk level:
- **low**: reversible, bounded impact, no user-visible negative outcomes expected (e.g. Slack post)
- **medium**: changes live systems, but reversible and bounded (e.g. pause ad set, create WP draft)
- **high**: irreversible or potentially large monetary/brand impact (e.g. publish content, large budget changes)

`mar21` is supervised-by-default: medium/high writes require approval unless allowlisted.

## v1 connector boundaries (per tool)

### Google Search Console (`gsc`)
**Primary purpose:** organic demand + performance signals (queries, pages, CTR, position).

**Must-have reads (v1)**
- `gsc.read.search_analytics.query` (by query/page/country/device)

**Optional reads (later)**
- indexing coverage, sitemaps, manual actions, core web vitals surfaces

**Writes (v1)**
- none (GSC is treated as read-first for v1)

**Common pitfalls**
- sampling/aggregation differences by dimension selection
- timezone alignment (use GA4 timezone strategy in context)

### GA4 (`ga4`)
**Primary purpose:** funnel truth, conversions, channel performance, baseline/anomaly signals.

**Must-have reads (v1)**
- `ga4.read.report.run` (sessions, users, conversions, revenue; by channel/campaign/landing page)

**Writes (v1, optional)**
- `ga4.write.annotation.create` (**medium**) — annotate runs (if supported/available in your setup)

**Common pitfalls**
- conversion definitions drift; context must declare “what counts”
- attribution settings differ from ad platforms; report must call this out

### Meta Ads (`meta_ads`)
**Primary purpose:** paid social execution and operational excellence (structure, fatigue, waste).

**Must-have reads (v1)**
- `meta_ads.read.insights.by_campaign`
- `meta_ads.read.insights.by_adset`
- `meta_ads.read.insights.by_ad`

**Writes (v1, supervised)**
- `meta_ads.write.adset.pause` (**medium**)
- `meta_ads.write.campaign.pause` (**medium/high** depending on spend)
- `meta_ads.write.budget.update` (**high** unless tightly bounded)

**Common pitfalls**
- performance is non-stationary; require “evidence window” in reports (e.g. P7D vs P28D)
- creative fatigue metrics are proxies; always include “confidence level”

### HubSpot (`hubspot`)
**Primary purpose:** lead lifecycle truth (MQL→SQL→Closed Won), hygiene, SLA checks, nurture gaps.

**Must-have reads (v1)**
- `hubspot.read.deals.list`
- `hubspot.read.contacts.list` (limited fields; no full exports by default)
- `hubspot.read.lifecycle.metrics` (aggregations)

**Writes (v1, supervised)**
- `hubspot.write.property.update` (**medium**) — standardize lifecycle fields
- `hubspot.write.task.create` (**low/medium**) — create follow-up tasks

**Common pitfalls**
- lifecycle definitions vary by org; context must define the mapping
- avoid pulling/storing full contact PII; aggregate by default

### Shopify (`shopify`)
**Primary purpose:** revenue truth, cohorts, product/category signals.

**Must-have reads (v1)**
- `shopify.read.orders.list` (minimal fields, aggregated)
- `shopify.read.customers.cohorts` (derived from orders)

**Writes (v1)**
- none by default (treat commerce writes as higher risk)

**Common pitfalls**
- refunds/chargebacks: define how they affect “revenue” in KPI tree
- multi-currency: context currency rules must be explicit

### WordPress (`wordpress`)
**Primary purpose:** content execution with safety (draft-first).

**Must-have reads (v1)**
- `wordpress.read.post.list`
- `wordpress.read.page.list`

**Writes (v1, draft-only)**
- `wordpress.write.post.create_draft` (**medium**)
- `wordpress.write.post.update_draft` (**medium**)

**Writes (later, high risk)**
- publish/update live pages (**high**, never autonomous by default)

**Common pitfalls**
- formatting/HTML block differences; preserve structure and keep edits minimal

### Slack (`slack`)
**Primary purpose:** operator notifications, digests, approvals coordination.

**Reads (v1)**
- none required

**Writes (v1)**
- `slack.write.message.post` (**low**)
- `slack.write.thread.reply` (**low**)

### Klaviyo (`klaviyo`)
**Primary purpose:** lifecycle operations (flows, campaigns, tests, segments).

**Must-have reads (v1)**
- `klaviyo.read.flows.list`
- `klaviyo.read.campaigns.list`
- `klaviyo.read.metrics.aggregate`

**Writes (v1, supervised)**
- `klaviyo.write.draft.update` (**medium**)

**Writes (later, high risk)**
- send/schedule campaigns (**high** by default)

### Google Drive (all file types) (`gdrive`) — priority private-doc connector
**Primary purpose:** bring private strategy docs, memos, interview syntheses, research notes, and attachments (Docs/Sheets/Slides/PDFs/images/etc.) into runs **safely** (reference-first, excerpt-minimal).

**Must-have reads (v1)**
- `gdrive.read.files.search` (**low**) — find docs by folder, name, query, modified time
- `gdrive.read.files.get_metadata` (**low**) — title, owner, modified time (no content)
- `gdrive.read.files.download` (**medium**) — download non-Google file bytes (PDFs, images, office docs)
- `gdrive.read.files.export` (**low/medium**) — export Google Workspace files (Docs/Sheets/Slides) into a target format for evidence packs

**Default policy (allowed by default)**
- In `supervised` mode, `gdrive.read.files.download` and `gdrive.read.files.export` are **allowed by default** (no allowlist needed).
- The orchestrator should still apply **GDPR-first minimization**:
  - metadata-first,
  - download/export only when a file is referenced by id/ref in the request, or when included as evidence for a specific finding,
  - prefer excerpts + redaction over storing whole files.

Recommended read capability aliases (convenience names)
- `gdrive.read.docs.export_markdown` (**low/medium**) → `files.export` to Markdown/plaintext
- `gdrive.read.sheets.export_csv` (**low/medium**) → `files.export` to CSV
- `gdrive.read.slides.export_pdf` (**low/medium**) → `files.export` to PDF
- `gdrive.read.pdf.extract_text` (**medium**) → download PDF then extract text (via a skill) with redaction

**Writes (default: none)**
- Treat Drive as **read-first**. Creating/modifying docs is **high risk** (accidental leakage / policy issues) and should be “later”.

**Safe evidence pattern**
- Prefer citing Drive docs by ref in `research_pack.md`:
  - `drive:fileId:<id>` (preferred), or `drive:<id>`
- If excerpts are needed (recommended default):
  - export/download only what’s needed for the current research question,
  - extract text/tables via a skill,
  - redact,
  - store the excerpt as `outputs/evidence/gdrive_<fileId>.<ext>`,
  - cite that excerpt as `internal_snapshot` and the original file as `private_doc`.
- If storing full files is necessary (exception):
  - store in `outputs/evidence/` with a clear filename,
  - record `sha256` and a retention note,
  - avoid re-distribution; treat runs as private.

**Common pitfalls**
- Docs often contain names/emails; default to summaries and aggressively redact.
- Don’t store secret-bearing URLs; store refs (file ids) only.
- Large binaries (videos, huge PDFs) bloat runs; prefer metadata + small excerpts unless explicitly requested.
  
## Auth defaults (local-first)
Connector secrets live in `workspaces/<workspace>/secrets/.env` (never committed).
Recommended pattern:
- one read-only credential set
- one write-enabled credential set (separate env vars), activated only when needed

### Env var naming convention (recommended)
Use `MAR21_<TOOL>_<NAME>` to keep secrets predictable:
- `MAR21_GA4_CLIENT_ID`, `MAR21_GA4_CLIENT_SECRET`, `MAR21_GA4_REFRESH_TOKEN`
- `MAR21_GSC_CLIENT_ID`, `MAR21_GSC_CLIENT_SECRET`, `MAR21_GSC_REFRESH_TOKEN`
- `MAR21_META_ADS_ACCESS_TOKEN` (or OAuth tokens)
- `MAR21_HUBSPOT_PRIVATE_APP_TOKEN`
- `MAR21_SHOPIFY_ACCESS_TOKEN`, `MAR21_SHOPIFY_STORE_DOMAIN`
- `MAR21_WORDPRESS_BASE_URL`, `MAR21_WORDPRESS_APP_PASSWORD`
- `MAR21_SLACK_BOT_TOKEN`
- `MAR21_KLAVIYO_PRIVATE_API_KEY`
- `MAR21_GDRIVE_CLIENT_ID`, `MAR21_GDRIVE_CLIENT_SECRET`, `MAR21_GDRIVE_REFRESH_TOKEN`
