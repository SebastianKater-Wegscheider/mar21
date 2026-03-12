# mar21 Creative System (Production Pipeline)

This document specifies how `mar21` treats creative as a **measurable system**:
- briefs are structured,
- assets are versioned and attributable,
- variation is intentional (hypothesis-driven),
- fatigue is monitored,
- distinctive assets are enforced and compounded via memory.

The goal is to make “creative” operable by a one-person team without devolving into random iterations.

## Principles
- **Creative is a first-order efficiency lever**: we treat it like product work, not decoration.
- **Assets are tracked**: every creative unit has an id, a hypothesis, and measurement hooks.
- **Draft-first**: publishing/sending is high risk; drafts and plans come first.
- **Evidence-backed**: creative decisions cite run evidence and sources.

## Core artifacts (per run)
When a workflow touches creative, the run should produce:
- `outputs/creative_brief.md` (human-readable brief)
- `outputs/creative_brief.yaml` (machine-readable brief)
- `outputs/asset_manifest.yaml` (assets planned/created/updated)
- `outputs/creative_matrix.yaml` (variation system: angles × formats × audiences)
- `outputs/creative_fatigue.json` (fatigue signals and thresholds; if ad data available)
- `outputs/decision_log.md` (decisions + tradeoffs + what changes our mind)

## 1) Creative brief (contract)

### 1.1 Brief fields (required)
`outputs/creative_brief.yaml`:
```yaml
apiVersion: mar21/creative-brief-v1
runId: 2026-03-12T090000Z_meta_cleanup
workspace: acme

goal:
  kpiNode: conversions
  successMetric: cpa
  target: "CPA <= 45 EUR (P7D)"

audience:
  segmentRef: "icp.segments[0]"
  pains: ["manual reporting", "tool sprawl"]
  objections: ["too complex", "no time"]

offer:
  promise: "Weekly review that ships actions, not dashboards."
  proof: ["case study", "demo video", "screenshots"]
  cta: "Book a 15‑min audit"

message:
  angle: "auditable growth loops"
  supportPoints:
    - "Plan/Report/ChangeSet every week"
    - "Supervised-by-default"
  doNotSay: ["guaranteed outcomes"]

constraints:
  brandAssetsRequired: true
  eeatRequired: true
  plainLanguageRequired: true
  legalNotes: []

tracking:
  utm:
    required: true
    utm_source: "meta"
    utm_medium: "paid_social"
    utm_campaign: "prospecting_auditability"
```

### 1.2 Brief output (human)
`outputs/creative_brief.md` is the same content, optimized for quick review:
- what are we trying to change (KPI node + window)
- who is this for (segment + pains + objections)
- what’s the promise and proof
- what must remain consistent (distinctive assets, claims policy)
- what we will vary and why (creative matrix)

## 2) Asset manifest (IDs, versions, and lineage)

### 2.1 Asset id format (stable)
Asset ids must be deterministic and filesystem-safe:

`<channel>_<format>_<angle>_<yyyy-mm>_<vN>`

Examples:
- `meta_video_auditability_2026-03_v1`
- `wp_post_category-entry-point_2026-03_v2`
- `email_subject_activation_fix_2026-03_v3`

### 2.2 Asset manifest fields (required)
`outputs/asset_manifest.yaml`:
```yaml
apiVersion: mar21/asset-manifest-v1
runId: 2026-03-12T090000Z_meta_cleanup
workspace: acme

assets:
  - assetId: meta_video_auditability_2026-03_v1
    channel: meta_ads
    format: video
    status: planned # planned|draft|active|paused|retired
    briefRef: outputs/creative_brief.yaml
    hypothesisRef: HYP-001
    distinctiveAssetsUsed:
      - "brand.distinctiveAssets[tagline]"
    files:
      - path: outputs/evidence/assets/meta_video_auditability_2026-03_v1.mp4
        sha256: "…"
    landingPageRef: "https://example.com/audit"
    tracking:
      utm_campaign: prospecting_auditability
    measurement:
      primaryMetric: cpa
      window: P7D
```

### 2.3 Lineage rules
When replacing/iterating an asset:
- create a new `assetId` version (`_v2`, `_v3`, …)
- link to prior `assetId` in `notes` or a `derivedFrom` field (optional)
- never overwrite evidence for old assets in prior runs

## 3) Creative matrix (variation system)
The creative matrix is the “system” that prevents random testing.

`outputs/creative_matrix.yaml`:
```yaml
apiVersion: mar21/creative-matrix-v1
runId: 2026-03-12T090000Z_meta_cleanup
workspace: acme

angles:
  - id: ANG-001
    name: "Auditability"
    claim: "Plan/Report/ChangeSet every week"
  - id: ANG-002
    name: "Waste reduction"
    claim: "Reduce wasted ad spend with supervised changes"

formats:
  - id: FMT-001
    name: "Short video"
  - id: FMT-002
    name: "Static image"

audiences:
  - id: AUD-001
    name: "Ops-led SaaS"

tests:
  - id: TST-001
    angleId: ANG-001
    formatId: FMT-001
    audienceId: AUD-001
    hypothesisRef: HYP-001
    successMetric: cpa
    window: P7D
    guardrails:
      maxSpendEUR: 500
```

## 4) Creative fatigue tracking (operational)
Fatigue is tracked when we have channel data (Meta Ads in v1).

`outputs/creative_fatigue.json` should include:
- asset or ad id mapping
- performance deltas vs baseline (P7D vs P28D)
- fatigue flags (e.g., rising CPA, falling CTR, rising frequency)
- recommended action (refresh, pause, broaden, rotate)

Fatigue recommendations must produce ChangeSet ops (supervised):
- pause/rotate assets (bounded)
- create new drafts

## 5) Distinctive assets (memory and enforcement)
Distinctive assets are stored and evolved explicitly.

Recommended memory files:
- `memory/distinctive_assets.yaml` (what must stay consistent)
- `memory/creative_learnings.yaml` (what works/doesn’t, with evidence)

Memory updates are proposed via ChangeSet ops (`mar21.memory.update`) and approved.

## 6) WorkflowIds that produce creative artifacts
These workflows should (eventually) emit the artifacts above:
- `meta_cleanup` (ads creative refresh plan + fatigue)
- `demand_capture` (briefs + on-page copy gates)
- `lifecycle_revenue_loop` (email copy/subject test matrix)
- `landing_page_iteration` (page variants + copy gates)
- `creative_pipeline_weekly` (dedicated creative system run; see `docs/DISTRIBUTION.md` for distribution coupling)

