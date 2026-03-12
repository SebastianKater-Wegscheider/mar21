# mar21 Evals (Quality Gates)

This document defines what “good output” means and how runs can be regression-tested.

## Goals
- Prevent schema drift and broken artifacts.
- Keep outputs comparable over time (especially weekly/monthly runs).
- Ensure strategy artifacts (research/sparring) remain evidence-backed.

## Hard gates (must always pass)
1) **Schema validation**
   - context, request, changeset, run.json must validate
   - skill outputs must validate against each skill’s declared output schema
2) **Required artifacts exist**
   - Plan + Report + ChangeSet + logs.jsonl + run.json always present
3) **Research pack source discipline**
   - if `research_pack.md` exists, every major claim has `[S#]`
   - Sources section includes: type + location ref + accessed date
4) **Best-practice gates (when relevant)**
   - if a workflow produces content drafts or landing-page variants, run the content gates below
   - if a workflow produces SEO audits, run the SEO gates below

## Rubrics (operator-facing)

### Plan rubric (`outputs/plan.md`)
Must include:
- a single-sentence goal
- KPI tree or KPI mapping
- ranked hypotheses
- tasks with:
  - owner
  - ETA or milestone date
  - measurement definition (what metric, what window)
- assumptions & open questions
- guardrails (what will not be done)

### Report rubric (`outputs/report.md`)
Must include:
- “What changed” with deltas and evidence references
- “Why” with confidence labels
- “What we did / will do” linked to ChangeSet ops
- risks & unknowns
- next checkpoint date/cadence
- “Measurement Reality” section (joins, attribution conflicts, unattributed share)

### Research pack rubric (`outputs/research_pack.md`)
Must include:
- research questions
- findings with `[S#]` citations
- implications (how this changes plan/positioning/channel mix)
- gaps/unknowns
- sources section with type + ref + accessed date

### Content gates (when content artifacts exist)
If a run produces content drafts (e.g. `outputs/*.md` intended for WordPress/email/ad copy), evaluate:
- **People-first**: content is written for a user need (not for “rankings”)
- **E‑E‑A‑T fit-for-purpose**: appropriate trust signals for the topic and claims
- **Plain language**: comprehension-first and scannable structure

These gates operationalize `docs/BEST_PRACTICES.md`.

### Creative system gates (when creative artifacts exist)
If a run produces:
- `outputs/creative_brief.yaml`, `outputs/asset_manifest.yaml`, or `outputs/creative_matrix.yaml`

Evaluate:
- **Traceability**: every asset has an `assetId`, a brief reference, and a measurement window
- **Hypothesis-driven**: each test ties to a hypothesisRef (or the plan explicitly states why it’s exploratory)
- **Consistency**: distinctive assets are included by default, deviation is justified in the decision log
- **Versioning**: assets are not overwritten; iterations create new versions (`_v2`, `_v3`, …)

### Distribution system gates (when distribution artifacts exist)
If a run produces:
- `outputs/distribution_plan.yaml` or `outputs/repurpose_map.yaml`

Evaluate:
- **No “spray and pray”**: every channel action maps to a hypothesis and a KPI node
- **Tracking**: UTMs are present or an explicit “untrackable” note exists (low confidence)
- **Repurposing discipline**: derived assets are linked to source assets; limits respected
- **Task handoff**: if the plan includes earned/community/partner actions, the ChangeSet includes `mar21.todo.create` ops with owner and due date

### SEO gates (when SEO artifacts exist)
If a run produces SEO changes or audits:
- technical eligibility is addressed first (crawl/index/understand)
- misconceptions are avoided (no keyword stuffing, no “meta keywords” superstition)
- changes are tied to evidence (GSC/GA4) and a measurement plan

## Golden runs (fixtures)
Golden runs are snapshots of a run folder used for regression testing.

Recommended structure (later, during implementation):
```
fixtures/
  golden/
    weekly_review_minimal/
      inputs/
      expected/
```

Rules:
- no secrets
- redact PII
- keep evidence files small; prefer aggregated tables

Regression checks should verify:
- schemas validate
- artifact files exist
- key JSON outputs contain expected keys
- report includes required sections
- ChangeSet ops remain stable in shape (not content)

## Non-goals
- Tone or style grading (unless explicitly configured in workspace `_cfg/`)
- “Performance” evals that require live tool accounts (use fixtures for CI)
