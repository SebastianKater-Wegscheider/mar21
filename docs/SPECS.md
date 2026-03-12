# mar21 Specs (Interfaces + File Formats)

This document defines the **stable surface** of `mar21`. These contracts are designed to be implemented by a CLI/agent runtime and to remain stable as tools and models evolve — so you can run **agentic marketing** while staying **in control**.

Principles:
- **YAML for human-first config and ops**, JSON for logs/metrics
- **Typed inputs/outputs everywhere**
- **Run artifacts are mandatory**
- **Supervised-by-default**
- **GDPR-first**

Companion contracts:
- Schema strategy: `docs/SCHEMAS.md` + `schemas/`
- CLI contract: `docs/CLI.md`
- Connector catalogs: `docs/connectors/README.md`

## 1) Workspace model (multi-workspace)

### 1.1 Workspace selection
The CLI must accept a workspace via:
- `--workspace <id>` (preferred)
- `MAR21_WORKSPACE=<id>` (fallback)

Workspace ids are filesystem-safe: `^[a-z0-9][a-z0-9-]{1,31}$`.

### 1.2 CLI surface (minimum, stable verbs)
The CLI contract is part of the stable surface because it defines how operators trigger runs.

**Global flags**
- `--workspace <id>`: required unless `MAR21_WORKSPACE` is set
- `--mode advisory|supervised|autonomous`: overrides context default for the run
- `--dry-run`: forces “never apply”, still emits a ChangeSet
- `--since <duration>`: where applicable (e.g. `P7D`, `P28D`)

**Core commands**
- `mar21 init`: creates a workspace skeleton and a starter context file
- `mar21 plan <workflow>`: generates a plan for a named workflow (always emits artifacts)
- `mar21 analyze <scope>`: analysis-only run that still emits ChangeSet suggestions
- `mar21 report <cadence>`: produces narrative report + machine metrics
- `mar21 run daily|weekly|monthly`: executes named loops once (emits artifacts)
- `mar21 autopilot start --profile <name>`: long-running scheduler that emits one run per scheduled execution
- `mar21 apply <runId>`: applies `changeset.yaml` for a run with interactive approvals

**Optional namespaces (aliases for discoverability)**
These are CLI aliases that map to workflows and skills; they should not change semantics:
- `mar21 seo …`
- `mar21 ads …`
- `mar21 content …`
- `mar21 crm …`

### 1.3 Workspace folder layout (canonical)
```
workspaces/
  acme/
    marketing-context.yaml
    secrets/
      .env                 # local-only, never commit
    _cfg/                  # workspace overrides (update-safe)
    profiles/              # autopilot profiles (daily/weekly/monthly)
    todos.yaml             # v1 task store (human work as first-class ops)
    memory/
      README.md            # optional: human notes about memory policy
      learnings.yaml
      winners.yaml
      losers.yaml
      exclusions.yaml
    cache/
      snapshots/           # connector response snapshots
    runs/
      2026-03-11T101530Z_gTmInAbox/
        inputs/
        outputs/
        logs.jsonl
        approvals.json
        changeset.yaml
        run.json
```

## 2) Marketing Context schema (YAML)

### 2.1 File
`workspaces/<workspace>/marketing-context.yaml`

### 2.0 Schema
Schema: `schemas/marketing-context.schema.json` (`urn:mar21:schema:marketing-context:v1`)

### 2.2 Required fields (v1)
```yaml
apiVersion: mar21/v1
workspace: acme

company:
  name: ACME Inc.
  industry: B2B SaaS
  region: EU
  languages: [en, de]

businessModel:
  segment: b2b_saas # one of: b2b_saas, b2c_saas, ecommerce, b2b_industrial, agency, other
  monetization: subscription # e.g. subscription, one_time, usage_based, razor_razorblade, ads, marketplace, hybrid
  pricing:
    avgOrderValue: null
    avgContractValue: 1200
    currency: EUR

goToMarket:
  stage: scale # one of: idea, validation, launch, scale, mature
  channels:
    seo:
      enabled: true
      primary: true
    paid_social:
      enabled: true
      primary: false
    lifecycle_email:
      enabled: true
      primary: true

goals:
  primaryKpi: pipeline # e.g. pipeline, revenue, subscriptions, purchases
  secondaryKpis: [traffic, leads, activation]
  kpiTree:
    pipeline:
      leading: [mqls, sqls]
      lagging: [closed_won]

constraints:
  compliance:
    gdpr: true
    sensitiveData: false
  brandVoice:
    tone: professional
    doNotSay: ["guaranteed", "best in class"]
  autonomy:
    defaultMode: supervised # advisory | supervised | autonomous
    allowlist:
      - tool: meta_ads
        operation: "ads.pause"
        maxDailyImpact:
          spendDeltaPct: 10
  budgets:
    monthly:
      total: 8000
      breakdown:
        meta_ads: 4000
        content: 1500
        tools: 500
```

### 2.3 Context invariants
- Context must be **complete enough** to choose KPIs, channels, and constraints without asking ad-hoc questions every run.
- The orchestrator must snapshot the context into every run (`runs/<id>/inputs/context.snapshot.yaml`).
- Workspace autonomy allowlist is the **only** way to enable autonomous writes.

### 2.4 Optional strategic fields (recommended for GTM planning)
These fields are not strictly required for v1 execution, but they materially improve planning quality and consistency.

```yaml
icp:
  segments:
    - name: "Ops-led SaaS"
      firmographics:
        companySize: "50-500"
        region: [DACH, EU]
      pains: ["manual reporting", "tool sprawl"]
      triggers: ["new CMO", "budget freeze"]

positioning:
  category: "AI-native marketing ops"
  valueProps:
    - "Run marketing as auditable loops"
    - "Own your AI competence and memory"
  proofPoints:
    - "Weekly review produces Plan/Report/ChangeSet"

measurement:
  timezone: "Europe/Vienna"
  utm:
    sourceOfTruth: "ga4"
    conventions:
      utm_source: ["meta", "email", "organic"]
      utm_medium: ["paid_social", "lifecycle", "seo"]

brand:
  budgetStrategy:
    brandBuildingPct: 60
    activationPct: 40
  distinctiveAssets:
    - type: "color"
      value: "#FF4D00"
    - type: "tagline"
      value: "Auditable growth loops"
  categoryEntryPoints:
    - "need weekly marketing reporting"
    - "ad spend waste"
    - "activation drop on pricing page"

contentGuidelines:
  peopleFirst: true
  eeat:
    requireSourcesForClaims: true
    requireAboutAuthor: true
    claimsPolicy:
      forbid: ["guaranteed outcomes"]
      requireEvidenceFor: ["benchmarks", "savings claims"]
  plainLanguage:
    required: true
    readingLevelTarget: "general"

creativeSystem:
  assetIdConvention: "<channel>_<format>_<angle>_<yyyy-mm>_<vN>"
  defaultTestWindow: P7D
  fatigueSignals:
    meta_ads:
      watch:
        - "cpa_up"
        - "ctr_down"
        - "frequency_up"
      thresholds:
        cpaDeltaPct: 20
        ctrDeltaPct: -15
        frequency: 2.5

distributionSystem:
  utmRequired: true
  earnedChannelsEnabled: true
  taskHandoff:
    enabled: true
    defaultOwner: "operator"
```

## 3) Skill contract (code-first, typed I/O)

### 3.1 Skill manifest
Skills live under `skills/` and include a machine-readable manifest:

`skills/<domain>/<skill>/skill.yaml`

Schema: `schemas/skill.schema.json` (`urn:mar21:schema:skill:v1`)

```yaml
apiVersion: mar21/skill-v1
id: seo.gsc_opportunity_clusters
domain: seo
description: "Turn GSC query/page data into prioritized opportunity clusters."

inputs:
  schema:
    type: object
    required: [dateRange, minImpressions]
    properties:
      dateRange: { type: string, description: "e.g. P28D" }
      minImpressions: { type: number, minimum: 0 }

outputs:
  schema:
    type: object
    required: [clusters]
    properties:
      clusters:
        type: array
        items:
          type: object
          required: [name, pages, queries, opportunityScore]
          properties:
            name: { type: string }
            pages: { type: array, items: { type: string } }
            queries: { type: array, items: { type: string } }
            opportunityScore: { type: number }

usesConnectors:
  - gsc.read.search_analytics

risk:
  level: low # none|low|medium|high
  writes: false

artifacts:
  produces:
    - outputs/opportunity_clusters.json
    - outputs/opportunity_clusters.md

idempotency:
  strategy: "pure" # pure|snapshot_based|tool_write
```

### 3.2 Skill execution rules
- Skills must be runnable with only their typed inputs + connector access + workspace memory.
- If an LLM is used, its prompt is an implementation detail; output must still validate against `outputs.schema`.
- Skills must write artifacts only inside the active run folder.

## 4) Connector contract (tool integrations)

### 4.1 Connector capabilities
Each connector must declare:
- `toolId` (e.g. `ga4`, `gsc`, `meta_ads`, `hubspot`, `shopify`, `wordpress`, `slack`, `klaviyo`)
- Supported operations with:
  - `read` vs `write`
  - risk level (`low|medium|high`)
  - dry-run support
- rate-limit strategy

For exhaustive per-tool capability catalogs, see `docs/connectors/README.md`.

### 4.2 Auth boundary (local-first env + OAuth)
- Secrets live in `workspaces/<workspace>/secrets/.env` and are not committed.
- OAuth tokens must be stored locally (keychain where available) or encrypted-at-rest file within `secrets/`.
- Connectors must never log raw secrets; runs may log *redacted* config.

Schema (recommended): `schemas/connector.schema.json` (`urn:mar21:schema:connector:v1`)

## 5) ChangeSet format (Typed Ops YAML)

### 5.1 File
`runs/<id>/changeset.yaml`

Schema: `schemas/changeset.schema.json` (`urn:mar21:schema:changeset:v1`)

### 5.2 Structure
```yaml
apiVersion: mar21/changeset-v1
runId: 2026-03-11T101530Z_weekly-review
workspace: acme
mode: supervised # advisory|supervised|autonomous

ops:
  - id: meta_pause_adset_01
    tool: meta_ads
    operation: ads.pause_adset
    risk: medium
    requiresApproval: true
    idempotencyKey: "meta_ads:pause_adset:12345"
    params:
      adsetId: "12345"
      reason: "Spend up, purchases down; fatigue signal; CPA > threshold."
    expectedImpact:
      spendDeltaPct: -8
      cpaDeltaPct: -10
    evidenceRef:
      - "outputs/evidence/meta_adset_12345_p7d.json"
    rollbackHint: "Unpause ad set 12345 if CPA recovers or attribution changes."

  - id: slack_post_digest_01
    tool: slack
    operation: slack.post_message
    risk: low
    requiresApproval: false
    params:
      channel: "#growth"
      messageRef: "outputs/weekly_digest.md"
    evidenceRef:
      - "outputs/report.md"
```

### 5.3 Semantics
- A ChangeSet is **the** machine-actionable representation of work.
- Applying a ChangeSet is a separate step that records approvals and results.
- `requiresApproval` must be true unless:
  - operation is `risk: low`, **and**
  - workspace allowlist permits it, **and**
  - mode is `autonomous`.

### 5.4 `mar21` internal ops (v1)
Not all work is a tool API call. `mar21` defines internal ops to track human work and repo-owned knowledge:
- `mar21.todo.create|update|close` (task system; see `docs/TASKS.md`)
- `mar21.memory.update` (memory updates; see section 8)

## 6) Safety + approvals model

### 6.1 Modes
- `advisory`: never applies writes; always produces suggestions in ChangeSet
- `supervised` (default): may apply writes only after interactive approvals
- `autonomous`: may apply allowlisted low-risk writes without a prompt

### 6.3 Read operations and sensitive sources
Reads do not require ChangeSet approvals, but they still have privacy risk.

Default policy:
- Read capabilities are allowed by default in all modes.
- “Sensitive reads” (e.g. private-doc exports/downloads) are allowed by default in `supervised` mode **with caps**:
  - only fetch what is needed for the run scope,
  - prefer metadata-first,
  - store excerpts (redacted) rather than full files,
  - enforce `maxDownloads` and `maxFileSizeMB` limits from the request/profile (or sensible defaults).

If the run needs to exceed caps, the CLI should prompt for confirmation and record the decision in `logs.jsonl` (without leaking doc URLs).

### 6.2 Approval UX (CLI)
When applying, the CLI must:
- show each op (tool, operation, risk, reason, rollback hint)
- prompt `approve? (y/n)` for required approvals
- write `approvals.json` with:
  - who approved (operator id)
  - timestamp
  - op id
  - decision + optional note

## 7) Run artifacts + observability

### 7.1 Run folder
Every run must produce:
- `outputs/plan.md`
- `outputs/report.md`
- `changeset.yaml`
- `logs.jsonl` (structured)
- `run.json` (run metadata)

Recommended (machine-readable) additions:
- `outputs/plan.yaml` (task list, owners, timelines, measurements)
- `outputs/report.json` (key metrics + deltas for downstream tooling)
- `outputs/evidence/` (files referenced by report/changeset, e.g. aggregated tables)
- `outputs/research_pack.md` (deep research synthesis with **sources**; mainly for strategy/planning workflows)
- `outputs/decision_log.md` (human-owned decisions, assumptions, tradeoffs)
Creative/distribution (when relevant):
- `outputs/creative_brief.yaml` (schema: `urn:mar21:schema:creative-brief:v1`)
- `outputs/asset_manifest.yaml` (schema: `urn:mar21:schema:asset-manifest:v1`)
- `outputs/creative_matrix.yaml` (recommended; schema optional initially)
- `outputs/distribution_plan.yaml` (schema: `urn:mar21:schema:distribution-plan:v1`)
- `outputs/repurpose_map.yaml` (schema: `urn:mar21:schema:repurpose-map:v1`)

Example:
```
runs/<runId>/
  inputs/
    context.snapshot.yaml
    request.yaml
  outputs/
    plan.md
    report.md
    kpi_tree.json
    plan.yaml
    report.json
    evidence/
  changeset.yaml
  logs.jsonl
  approvals.json
  run.json
```

### 7.2 `logs.jsonl` event shape (minimum)
Each line is a JSON object:
```json
{"ts":"2026-03-11T10:15:30Z","level":"info","event":"connector.fetch","tool":"ga4","op":"ga4.report","durationMs":842}
```

### 7.2.1 `run.json` metadata (minimum)
`run.json` must include enough to replay and to reason about safety:
```json
{
  "apiVersion": "mar21/run-v1",
  "runId": "2026-03-11T101530Z_weekly-review",
  "workspace": "acme",
  "workflowId": "weekly_review",
  "mode": "supervised",
  "since": "P7D",
  "startedAt": "2026-03-11T10:15:30Z",
  "finishedAt": "2026-03-11T10:17:12Z",
  "connectorsUsed": ["ga4", "gsc", "meta_ads", "shopify", "hubspot", "klaviyo", "slack"],
  "writesAttempted": false
}
```

Schema: `schemas/run.schema.json` (`urn:mar21:schema:run:v1`)

### 7.3 Plan/Report minimum templates (opinionated)
To keep runs comparable across time and across workspaces, these documents must follow a minimum structure.

`outputs/plan.md` must include:
- Goal (single sentence)
- KPI tree (what moves what)
- Hypotheses (ranked)
- Tasks (with owners, ETA, measurement)
- Assumptions & open questions
- Guardrails (what we won’t do)

`outputs/report.md` must include:
- What changed (deltas + evidence refs)
- Why (most likely causes)
- What we did / will do (linked to ChangeSet ops)
- Risks & unknowns
- Next checkpoint (date/cadence)

`outputs/research_pack.md` must include (when produced):
- Research questions (what we’re trying to learn)
- Findings (each major claim annotated with source ids like `[S1]`)
- Implications for strategy (what changes in positioning/channel mix/creative)
- Gaps/unknowns (what we still don’t know)
- Sources section with:
  - stable source ids (`S1`, `S2`, …)
  - source type, title, publisher/owner, location reference (URL or private ref), and accessed date

Recommended citation format:
```md
## Findings
- Category demand is seasonal in DACH; Q4 spikes correlate with budget cycles. [S1]
- Competitor X positions on “automation” but lacks “auditability” claims. [S2]

## Sources
- [S1] (public_url) Title — Publisher — https://… — accessed 2026-03-11
- [S2] (private_doc) Memo: ICP Interviews — Internal — drive:docid:abc123 — accessed 2026-03-11
- [S3] (internal_snapshot) GSC export (P28D) — ACME property — outputs/evidence/gsc_p28d.json — accessed 2026-03-11
```

### 7.3.1 Source types (required)
`mar21` supports both **public** and **private** sources. A research pack must label each source as one of:
- `public_url`: a public webpage or public document URL
- `private_doc`: a private document reference (Drive/Notion/Confluence/etc.) that may not be shareable publicly
- `internal_snapshot`: an internal run artifact (e.g. connector snapshot in `outputs/evidence/`)
- `interview_note`: human notes or transcripts (must be PII-safe; default is summaries only)

### 7.3.2 Private-doc handling (GDPR-first)
When citing or using private docs:
- Prefer referencing by **document id/ref** rather than copying full contents into run logs.
- If excerpts are needed, keep them short and avoid PII; store excerpts in `outputs/evidence/` with redaction.
- Never put private doc URLs/tokens in logs; store access configuration in `secrets/` only.
- The run must record **what was accessed** (doc refs) and **when**, but not store secret-bearing URLs.

Recommended private doc ref formats:
- Google Drive: `drive:fileId:<id>`
- Notion: `notion:page:<id>`
- Confluence: `confluence:page:<id>`

### 7.3.3 Evidence extraction for arbitrary file types (Drive priority)
When private sources include arbitrary file types (Docs/Sheets/Slides/PDFs/images/etc.), the default approach is:
1) cite the original as `private_doc` (by ref),
2) extract only the minimal needed evidence into `outputs/evidence/`,
3) cite the extracted artifact as `internal_snapshot`.

Recommended evidence file naming:
- `outputs/evidence/gdrive_<fileId>.<ext>`
- `outputs/evidence/<tool>_<descriptor>_<window>.<ext>` (e.g. `ga4_funnel_p7d.json`)

Recommended evidence manifest (optional but useful):
`outputs/evidence/evidence.json`
```json
[
  {
    "id": "E1",
    "sourceRef": "drive:fileId:abc123",
    "derivedFrom": "private_doc",
    "path": "outputs/evidence/gdrive_abc123.md",
    "contentType": "text/markdown",
    "redacted": true,
    "sha256": "…",
    "notes": "Extracted only the section about ICP objections; names removed."
  }
]
```

Schema: `schemas/evidence.schema.json` (`urn:mar21:schema:evidence:v1`)

## 8) Marketing memory (files)

### 8.1 Goals
Memory must:
- compound learnings across runs
- be human-readable and reviewable
- be safe to edit manually

### 8.2 Canonical files (suggested)
`workspaces/<workspace>/memory/`:
- `learnings.yaml`: durable “what we learned”
- `winners.yaml`: headlines/angles/audiences/keywords that work (with evidence refs)
- `losers.yaml`: what failed (and why)
- `exclusions.yaml`: negative keywords, blocked audiences, forbidden claims

### 8.3 Update rules
- Skills may propose memory updates as ChangeSet ops (tool: `mar21`, operation: `memory.update`).
- Memory updates are supervised by default, because they influence future decisions.

## 9) Connector manifest (recommended, for capability discovery)
While connectors can be code-only, `mar21` strongly recommends a small manifest so skills can declare requirements and the CLI can validate “what writes are even possible”.

`packages/connectors/<tool>/connector.yaml`:
```yaml
apiVersion: mar21/connector-v1
toolId: ga4
displayName: "Google Analytics 4"
auth:
  type: oauth
  scopes:
    - "https://www.googleapis.com/auth/analytics.readonly"
capabilities:
  - id: ga4.read.report
    risk: low
    writes: false
    dryRun: true
  - id: ga4.write.annotation
    risk: medium
    writes: true
    dryRun: true
rateLimits:
  strategy: "token_bucket"
  requestsPerMinute: 60
```

## 10) GDPR-first requirements (non-optional)
- **Data minimization**: connectors fetch only fields needed for the current run scope.
- **Redaction**: logs must not contain emails, names, raw message content, or raw order PII.
- **Retention**: `cache/` has a documented retention (default 30 days); `runs/` are kept unless the workspace opts into an auto-prune policy.
- **Separation**: secrets are never stored in `runs/` and are never committed.

## 11) Workflow requests and autopilot profiles (recommended)
Workflows are triggered by the CLI, but the run must persist “what exactly was requested” in a stable shape.

### 11.1 `inputs/request.yaml`
`runs/<runId>/inputs/request.yaml`:
```yaml
apiVersion: mar21/request-v1
workflowId: weekly_review
workspace: acme
mode: supervised # advisory|supervised|autonomous
since: P7D
params:
  currency: EUR
  minSpend: 50
  slackChannel: "#growth"
  research:
    questions:
      - "What changed in the category narrative in DACH over the last 90 days?"
      - "Which ICP objections are most likely blocking activation?"
    competitorUrls:
      - "https://example-competitor.com"
    sources:
      drive:
        fileIds: ["abc123", "pdf987"] # optional; preferred for deterministic pulls
        folderIds: []                 # optional
        query: null                   # optional Drive query string
        limits:
          maxDownloads: 10
          maxFileSizeMB: 25
```

Schema: `schemas/request.schema.json` (`urn:mar21:schema:request:v1`)

### 11.2 Autopilot profiles
Profiles define what `mar21 run daily|weekly|monthly` *means* for a workspace.

Recommended location:
- `workspaces/<workspace>/profiles/daily.yaml`
- `workspaces/<workspace>/profiles/weekly.yaml`
- `workspaces/<workspace>/profiles/monthly.yaml`

Example `profiles/weekly.yaml`:
```yaml
apiVersion: mar21/profile-v1
id: weekly
steps:
  - workflowId: weekly_review
    mode: supervised
    since: P7D
  - workflowId: meta_cleanup
    mode: supervised
    since: P7D
  - workflowId: demand_capture
    mode: supervised
    since: P28D
```

Schema: `schemas/profile.schema.json` (`urn:mar21:schema:profile:v1`)

## 12) Task system (v1)
Task store:
- `workspaces/<workspace>/todos.yaml`

Schema:
- `schemas/todos.schema.json` (`urn:mar21:schema:todos:v1`)

Task mutations:
- only via ChangeSet ops (`mar21.todo.*`), supervised by default

See `docs/TASKS.md` for the full contract and examples.
