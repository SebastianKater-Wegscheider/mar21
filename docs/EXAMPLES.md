# mar21 Examples (Concrete Artifacts)

This document shows **end-to-end examples** of the canonical artifacts `mar21` produces and consumes.

## Example 1: `marketing-context.yaml` (minimal but usable)
```yaml
apiVersion: mar21/v1
workspace: acme

company:
  name: ACME Inc.
  industry: "B2B SaaS"
  region: EU
  languages: [en, de]

businessModel:
  segment: b2b_saas
  monetization: subscription
  pricing:
    avgContractValue: 1200
    currency: EUR

goals:
  primaryKpi: pipeline
  secondaryKpis: [activation, traffic]
  kpiTree:
    pipeline:
      leading: [mqls, sqls]
      lagging: [closed_won]

constraints:
  compliance:
    gdpr: true
    sensitiveData: false
  autonomy:
    defaultMode: supervised
    allowlist: []
  budgets:
    monthly:
      total: 8000
      breakdown:
        meta_ads: 4000
        content: 1500
```

## Example 2: Weekly review run folder
```
workspaces/acme/runs/2026-03-11T101530Z_weekly-review/
  inputs/
    context.snapshot.yaml
    request.yaml
  outputs/
    plan.md
    report.md
    kpi_tree.json
    deltas.json
    research_pack.md
    decision_log.md
  changeset.yaml
  logs.jsonl
  approvals.json
  run.json
```

### Example `outputs/research_pack.md` (skeleton with sources)
```md
# Research Pack — ACME — 2026-03-11

## Research questions
- What category narratives are winning in DACH right now?
- Which competitor positions are crowded vs under-served?
- What would need to be true for our GTM plan to succeed?

## Findings
- Competitor positioning clusters around “automation”; “auditability” is underclaimed. [S1]
- Demand is concentrated in 3 query clusters with rising impressions P28D. [S2]

## Implications
- Lead with “auditable growth loops” and “human-approved execution”.
- Prioritize SEO cluster #2 and lifecycle activation improvements.

## Gaps / unknowns
- Limited evidence on enterprise procurement objections; interview 5 customers.

## Sources
- [S1] Competitor X landing page — Competitor X — https://example.com — accessed 2026-03-11
- [S2] (private_doc) ICP interview synthesis — Internal — drive:fileId:abc123 — accessed 2026-03-11
- [S3] (private_doc) Q1 Win/Loss Notes (PDF) — Internal — drive:fileId:pdf987 — accessed 2026-03-11
- [S4] (internal_snapshot) Extracted objections from Win/Loss PDF — mar21 — outputs/evidence/gdrive_pdf987.md — accessed 2026-03-11
- [S5] (internal_snapshot) Google Search Console export (P28D) — ACME property — outputs/evidence/gsc_p28d.json — accessed 2026-03-11
```

### Example `inputs/request.yaml`
```yaml
apiVersion: mar21/request-v1
workflowId: weekly_review
workspace: acme
mode: supervised
since: P7D
params:
  slackChannel: "#growth"
```

### Example `inputs/request.yaml` (deep research + sparring)
```yaml
apiVersion: mar21/request-v1
workflowId: deep_research_sparring
workspace: acme
mode: supervised
since: P90D
params:
  research:
    questions:
      - "Which positioning claims are crowded vs underclaimed in DACH?"
      - "What would have to be true for our pipeline goal to be realistic?"
    competitorUrls:
      - "https://example-competitor.com"
  slackChannel: "#growth"
```

### Example `outputs/plan.md` (skeleton)
```md
# Weekly Review Plan (ACME) — 2026-03-11

## Goal
Increase pipeline while keeping CAC within guardrails.

## KPI Tree
- Pipeline → SQLs → MQLs → Sessions → Impressions

## Ranked hypotheses
1) Meta fatigue in core prospecting ad set is raising CPA.
2) Landing page friction on pricing page reduces activation.
3) Demand capture gap: high-impression queries without dedicated pages.

## Tasks (this week)
- [ ] Pause 2 fatigued ad sets (supervised) — Owner: Ops — ETA: today — Measure: CPA P7D
- [ ] Draft 2 landing page variants (draft-only) — Owner: Content — ETA: 2 days — Measure: CVR P14D
- [ ] Create 3 SEO briefs + WP drafts — Owner: Content — ETA: 5 days — Measure: impressions/clicks P28D

## Guardrails
- No budget increases > 10% without explicit approval
- No publishing to WordPress without manual review
```

### Example `outputs/decision_log.md` (skeleton)
```md
# Decision Log — ACME — 2026-03-11

## Decisions (this run)
- We position primarily on “auditable growth loops” rather than “automation”. (evidence: [S1])
- We prioritize lifecycle activation before increasing top-of-funnel spend. (evidence: GA4 funnel deltas)

## Assumptions
- ICP is ops-led; sales cycle 30–90 days; pipeline is a meaningful primary KPI.
- Meta is not saturated; performance can recover with creative refresh + tighter targeting.

## Tradeoffs
- Slower top-of-funnel scaling in exchange for better activation and CAC guardrails.

## What would change our mind
- If activation improves but pipeline doesn’t move in 2 cycles, revisit ICP fit and channel mix.
```

### Example `outputs/report.md` (skeleton)
```md
# Weekly Review Report (ACME) — 2026-03-11

## What changed
- Meta spend +12%, purchases -8% (P7D), CPA +22%
- GA4 conversions stable; activation down on pricing page
- GSC: 3 query clusters with high impressions and low CTR

## Why (best current explanation)
- Creative fatigue in prospecting; placement mix shift to lower-quality inventory
- Pricing page copy mismatch with ad promise

## What we’ll do
See `changeset.yaml` ops and the plan tasks.

## Risks & unknowns
- Attribution mismatch between Meta and GA4

## Next checkpoint
Next weekly review (P7D), plus daily anomaly guardrails.
```

### Example `changeset.yaml` (multi-tool)
```yaml
apiVersion: mar21/changeset-v1
runId: 2026-03-11T101530Z_weekly-review
workspace: acme
mode: supervised

ops:
  - id: slack_post_digest
    tool: slack
    operation: slack.post_message
    risk: low
    requiresApproval: false
    params:
      channel: "#growth"
      messageRef: "outputs/report.md"

  - id: meta_pause_adset_123
    tool: meta_ads
    operation: ads.pause_adset
    risk: medium
    requiresApproval: true
    idempotencyKey: "meta_ads:pause_adset:123"
    params:
      adsetId: "123"
      reason: "CPA +22% P7D; fatigue signal; low incremental conversions."
    expectedImpact:
      spendDeltaPct: -5
    evidenceRef:
      - "outputs/evidence/meta_adset_123_p7d.json"
    rollbackHint: "Unpause if CPA normalizes after creative refresh."

  - id: wordpress_create_draft_pricing_variant
    tool: wordpress
    operation: post.create_draft
    risk: medium
    requiresApproval: true
    params:
      title: "Pricing page variant A (draft)"
      contentRef: "outputs/pricing_variant_a.md"

  - id: mar21_memory_update
    tool: mar21
    operation: memory.update
    risk: low
    requiresApproval: true
    params:
      file: "memory/learnings.yaml"
      patchRef: "outputs/memory_patch.yaml"
```
