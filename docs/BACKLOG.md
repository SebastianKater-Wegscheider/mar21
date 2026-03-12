# mar21 Backlog (Concept Gaps → Docs/Specs to Add)

This backlog turns “end-to-end marketing value creation” gaps into concrete doc/spec work.

Each item is: **Gap → Spec to add → Where it lives → Acceptance criteria**.

## 1) Activation-to-revenue closure loop (truth pipeline)
**Gap**: we have joins + disclaimers, but not a canonical cross-tool “truth pipeline” for revenue impact across long cycles (and refunds/offline).

**Spec to add**
- Canonical object map: `ad/campaign` → `session` → `lead` → `opportunity` → `revenue` (+ `refunds`/`churn`)
- Explicit “source of truth per node” policy (GA4 vs Shopify vs HubSpot)
- Offline conversion/backfill approach (even if v1 is “manual import”)

**Where**
- Add `docs/REVENUE_LOOP.md`
- Extend `docs/DATA_MODEL.md` with a “truth pipeline” section
- Add context fields in `docs/SPECS.md` (`measurement.truthPolicy`)

**Acceptance criteria**
- Weekly report can state: “pipeline moved because X” with an explicit join path and confidence.
- “Unattributed share” is quantified per node (sessions, leads, revenue).

## 2) Experimentation OS (hypotheses → tests → learnings)
**Gap**: workflows mention tests, but there is no standard hypothesis registry, experiment design, guardrails, or stopping rules.

**Spec to add**
- `hypotheses.yaml` registry (id, claim, evidence refs, KPI node targeted, priority score)
- `experiments.yaml` (design, variants, allocation, duration, stop criteria, guardrails)
- Memory promotion rules (candidate → reviewed → accepted)

**Where**
- Add `docs/EXPERIMENTS.md`
- Add schema files in `schemas/` for hypothesis/experiment registries
- Add memory promotion section in `docs/SPECS.md`

**Acceptance criteria**
- Every plan references hypothesis ids; every report closes the loop with outcomes.

## 3) Distribution system (beyond creation)
**Gap**: content creation exists, but distribution (repurposing, syndication, PR/community/partner channels) isn’t specified as runs and artifacts.

**Spec to add**
- Distribution plan template + channel calendar
- Repurposing rules (one idea → N assets → N channels)
- Measurement mapping per distribution channel

**Where**
- Add `docs/DISTRIBUTION.md`
- Extend `docs/WORKFLOWS.md` with `distribution_weekly` workflowId

**Acceptance criteria**
- A weekly loop produces a distribution calendar + measurable goals per channel.

## 4) Creative production pipeline (assets, naming, fatigue)
**Gap**: principles mention creativity/distinctive assets, but we don’t specify asset lifecycle and creative ops.

**Spec to add**
- Asset manifest (id, format, message, distinctive assets used, legal notes)
- Creative test matrix spec (angles × formats × audiences)
- Fatigue signals + refresh policy

**Where**
- Add `docs/CREATIVE.md`
- Extend `docs/BEST_PRACTICES.md` with concrete “creative system” checklists
- Add schemas for creative manifests

**Acceptance criteria**
- Ads workflows output a creative matrix and can attribute performance to asset ids.

### Status
Initial v1 spec added:
- `docs/CREATIVE.md`
- `docs/DISTRIBUTION.md`

## 5) Technical SEO beyond GSC
**Gap**: without crawl/site audit/log analysis interfaces, “technical excellence” remains mostly aspirational.

**Spec to add**
- A site audit connector contract (read-only) and evidence artifact shapes
- Technical SEO workflowId (crawlability/indexability/CWV/structured data)

**Where**
- Add `docs/SEO_TECHNICAL.md`
- Add a connector catalog stub under `docs/connectors/` for a future crawler (later)

**Acceptance criteria**
- SEO runs produce a “technical blockers first” list with evidence artifacts.

## 6) Paid search / intent capture (Google Ads)
**Gap**: no paid search connector means we miss a core “one-person marketing” lever (search terms, negatives, landing page alignment).

**Spec to add**
- Google Ads connector catalog + capabilities (search terms, negatives, keyword status, budgets)
- WorkflowId: `paid_search_waste_cleanup` + `keyword_intent_alignment`

**Where**
- Add `docs/connectors/google_ads.md` (later v2 tool expansion)
- Extend `docs/ROADMAP.md` and `docs/WORKFLOWS.md`

**Acceptance criteria**
- A weekly paid-search workflow can propose negatives and measurement of waste reduction.

## 7) Lifecycle + CRM data model depth
**Gap**: connector catalogs exist, but we don’t specify the canonical event/object mapping for lifecycle.

**Spec to add**
- Lifecycle stage mapping policy (context-driven)
- Segment definitions and naming conventions
- SLA definitions + leak detection thresholds

**Where**
- Add `docs/LIFECYCLE.md`
- Extend `docs/SPECS.md` context with `lifecycle.stageMap`, `lifecycle.slas`

**Acceptance criteria**
- Weekly review can reliably explain stage leakage and recommend actions tied to stage definitions.

## 8) Planning → project execution handoff (non-API work)
**Gap**: ChangeSets model tool ops, but not human tasks (design, approvals, stakeholder review).

**Spec to add**
- `mar21.todo.*` op family spec (create/update/close tasks)
- Task store choices (v1: local `todos.yaml`; later: Jira/Linear/Asana connectors)

**Where**
- Add `docs/TASKS.md`
- Extend `schemas/changeset.schema.json` examples to include `mar21.todo.create`

**Acceptance criteria**
- GTM plans produce an actionable task backlog with owners and measurement.

### Status
Initial v1 spec added:
- `docs/TASKS.md`
- `schemas/todos.schema.json`
- `examples/todos.yaml`

## 9) Memory as a system (promotion + conflict resolution)
**Gap**: memory files exist, but no “how we update and trust memory” spec.

**Spec to add**
- Memory entry structure (claim, evidence refs, confidence, last reviewed)
- Promotion rules and review workflow (supervised)
- Conflict resolution (two learnings disagree)

**Where**
- Add `docs/MEMORY.md`
- Add schemas for memory files (optional)

**Acceptance criteria**
- Skills can reference memory entries deterministically and safely update them via ChangeSet ops.

## 10) Workspace inheritance (shared defaults vs overrides)
**Gap**: `_cfg/` exists, but no spec for “global defaults” across many workspaces.

**Spec to add**
- Global config layer: `_cfg-global/` or `defaults/` (repo-level)
- Precedence: core < global < workspace context < workspace `_cfg/`

**Where**
- Extend `docs/DEV.md` and `docs/SPECS.md`

**Acceptance criteria**
- Multi-brand operators can update a policy once and have it apply everywhere (unless overridden).

## 11) Run economics + prioritization (what to do next)
**Gap**: no explicit scoring model for prioritizing work under constraints.

**Spec to add**
- Scoring rubric (ICE/RICE or constraint-aware ROI)
- “Do next” output artifact (`outputs/next_actions.md` + JSON)

**Where**
- Add `docs/PRIORITIZATION.md`
- Extend `docs/EVALS.md` to require prioritization rationale for weekly/monthly plans

**Acceptance criteria**
- Weekly plan includes ranked actions with explicit expected impact + evidence.
