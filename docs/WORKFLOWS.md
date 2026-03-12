# mar21 Workflows (Operator Playbook)

All workflows follow the same contract:
- **Trigger → Inputs → Connectors → Skills → Artifacts → Optional writes**
- Every run produces **Plan + Report + ChangeSet** (even when “no changes”).
- Writes are **supervised-by-default** unless allowlisted.

Evidence-based defaults and gates are defined in `docs/BEST_PRACTICES.md` and enforced via `docs/EVALS.md`.

v1 first-class integrations (one per angle):
- SEO: Google Search Console (`gsc`)
- Analytics: GA4 (`ga4`)
- Ads: Meta Ads (`meta_ads`)
- CRM: HubSpot (`hubspot`)
- Commerce: Shopify (`shopify`)
- CMS: WordPress (`wordpress`)
- Comms: Slack (`slack`)
- Email: Klaviyo (`klaviyo`)

## Typical CLI usage
Workflows can be invoked via generic verbs or (optionally) via namespaces:

```bash
mar21 plan gtm_in_a_box --workspace acme
mar21 report weekly_review --workspace acme
mar21 run daily --workspace acme

# Optional namespace aliases
mar21 seo run demand_capture --workspace acme
mar21 ads plan meta_cleanup --workspace acme
mar21 crm report lead_to_revenue_hygiene --workspace acme
```

## 0) Deep Research + Sparring
**Workflow ID:** `deep_research_sparring`  
**Trigger:** before GTM planning, for monthly GTM refresh, or when performance drifts and you need new hypotheses.  
**Command:** `mar21 plan deep_research_sparring --workspace <id> --since <duration>`

**Goal**
Create an evidence-backed **research pack** and a structured **sparring** output that pressure-tests the current strategy and produces measurable next steps.

**Inputs**
- `marketing-context.yaml` (ICP, positioning, goals, constraints)
- optional: explicit research questions (otherwise derived from context + current KPIs)
- optional: competitor list / URLs

**Connectors (v1, optional but recommended)**
- GSC (organic demand signals)
- GA4 (funnel + conversion evidence)
- Meta Ads (paid social performance context)
- Shopify / HubSpot / Klaviyo (revenue/lifecycle evidence if relevant)
- Google Drive (`gdrive`) for private strategy docs and attachments (all file types)

**Skills (examples)**
- `strategy.research_questions_derive`
- `strategy.deep_research_pack` (must output `research_pack.md` with sources)
- `strategy.sparring_positioning_and_risks` (thesis/antithesis, falsification tests)
- `strategy.hypothesis_backlog_generate` (ranked hypotheses with evidence + measurement)

**Artifacts**
- `outputs/research_pack.md`: findings with `[S1]…` citations + Sources section
- `outputs/decision_log.md`: decisions, assumptions, tradeoffs, “what changes our mind”
- `outputs/plan.md`: the executable next steps (experiments, owners, measurement, timelines)
- `outputs/report.md`: summary + key implications + what changed vs last research run
- `changeset.yaml`: usually `mar21.todo.create`, `mar21.memory.update`, Slack digest (no tool writes by default)

**Optional writes**
- Slack digest (low risk; can be auto)
- Memory updates (supervised-by-default)

**How this feeds other workflows**
- `gtm_in_a_box` should include the latest `research_pack.md` and link decisions to it.
- `weekly_review` should reference research-derived hypotheses when explaining “why” and “what we’ll do”.
- Monthly `run monthly` should refresh research + sparring before budget reallocation.

## 1) GTM in a Box (Strategy Sprint)
**Workflow ID:** `gtm_in_a_box`
**Trigger:** new product, new market, new motion, or “we don’t have a real plan”.
**Command:** `mar21 plan gtm_in_a_box --workspace <id>`

**Inputs**
- `marketing-context.yaml` (must include model + monetization + goals + constraints)
- optional: existing positioning docs, competitor list

**Connectors (v1)**
- none required; optional reads if available (GA4, GSC)

**Skills (examples)**
- `strategy.deep_research_pack`
- `strategy.sparring_positioning_and_risks`
- `strategy.kpi_tree_define`
- `strategy.channel_mix_recommend`
- `strategy.timeline_budget_plan`
- `strategy.measurement_instrumentation_plan`

**Artifacts**
- `outputs/plan.md`: 2–6 week timeline, owners, deliverables, experiments, measurement
- `outputs/report.md`: rationale + assumptions + risks
- `outputs/research_pack.md`: synthesis + competitor/category notes, **with sources** (`[S1]`… + Sources section)
- `outputs/decision_log.md`: what we decided, what we deferred, what would change our mind
- `changeset.yaml`: “setup tasks” (usually `mar21.todo.create` style ops, advisory by default)

**Optional writes**
- none by default (setup is mostly human work); may post Slack summary.

## 2) Weekly Growth Operating Review
**Workflow ID:** `weekly_review`
**Trigger:** weekly cadence (exec-ready view + operator action list).
**Command:** `mar21 report weekly_review --workspace <id>`

**Connectors**
- GA4, GSC, Meta Ads, Shopify, HubSpot, Klaviyo (+ Slack for broadcast)

**Skills (examples)**
- `analytics.kpi_tree_compute`
- `analytics.week_over_week_deltas`
- `ads.meta_efficiency_audit`
- `seo.gsc_opportunity_clusters`
- `lifecycle.klaviyo_flow_health`
- `commerce.shopify_cohort_signals`

**Artifacts**
- `outputs/plan.md`: next-week priorities + experiments
- `outputs/report.md`: “what changed, why, what we’ll do”
- `changeset.yaml`: cleanup + low-risk fixes (supervised)

**Optional writes (supervised)**
- Pause obvious waste (bounded by allowlist)
- Post Slack digest

## 3) Daily Anomaly Guardrail (Autopilot loop)
**Workflow ID:** `daily_anomaly_guardrail`
**Trigger:** daily (or intra-day) health checks.
**Command:** `mar21 run daily --workspace <id>` (or `mar21 autopilot start --profile daily --workspace <id>`)

**Connectors**
- GA4, Meta Ads, Shopify, HubSpot (+ Slack)

**Skills**
- `monitoring.baseline_build_or_load`
- `monitoring.detect_anomalies`
- `monitoring.generate_investigation_steps`

**Artifacts**
- `outputs/plan.md`: investigation checklist
- `outputs/report.md`: anomaly summary + suspected causes
- `changeset.yaml`: suggestions (advisory) or bounded mitigations (supervised)

**Optional writes**
- Slack alerts (low risk, may be auto)
- “Stop the bleeding” actions only if allowlisted

## 4) Meta Ads Waste & Structure Cleanup
**Workflow ID:** `meta_cleanup`
**Trigger:** weekly (or when spend spikes / performance drops).
**Command:** `mar21 ads plan meta_cleanup --workspace <id>` (or `mar21 plan meta_cleanup --workspace <id>`)

**Connectors**
- Meta Ads (+ GA4 for downstream signals)

**Skills**
- `ads.meta_searchless_waste_scan`
- `ads.meta_placement_breakdown`
- `ads.meta_creative_fatigue_detect`
- `ads.meta_budget_reallocation_plan`

**Artifacts**
- Plan + report with thresholds and evidence refs
- ChangeSet with pause/rename/reallocate ops (supervised)

## 4.1) Creative Pipeline (Weekly)
**Workflow ID:** `creative_pipeline_weekly`  
**Trigger:** weekly cadence to keep creative intentional and refreshed.  
**Command:** `mar21 plan creative_pipeline_weekly --workspace <id> --since P28D`

**Connectors (v1)**
- Meta Ads (insights for fatigue)
- GA4 (downstream conversion context)
- WordPress/Klaviyo (destination and lifecycle context; optional)

**Skills (examples)**
- `ads.meta_creative_fatigue_detect`
- `creative.brief_generate`
- `creative.matrix_generate`
- `creative.asset_manifest_update`
- `content.eeat_review`
- `copy.plain_language_check`

**Artifacts**
- `outputs/creative_brief.md` + `outputs/creative_brief.yaml`
- `outputs/creative_matrix.yaml`
- `outputs/asset_manifest.yaml`
- `outputs/creative_fatigue.json`
- `changeset.yaml`: pause/rotate ops (supervised) + create draft tasks/assets

## 5) SEO Demand Capture Engine
**Workflow ID:** `demand_capture`
**Trigger:** weekly content pipeline + monthly theme planning.
**Command:** `mar21 seo run demand_capture --workspace <id>` (or `mar21 run weekly --workspace <id>`)

**Connectors**
- GSC (+ WordPress draft API)

**Skills**
- `seo.gsc_query_intent_map`
- `seo.gsc_opportunity_clusters`
- `content.brief_generate`
- `content.wordpress_draft_create`
- `content.eeat_review` (people-first + trust fit-for-purpose)
- `copy.plain_language_check` (clarity + scannability)
- `seo.snippet_quality_check` (titles/snippets aligned to intent)
- `seo.internal_linking_plan`

**Artifacts**
- Plan: editorial calendar + briefs + internal linking tasks
- Report: why these topics, expected impact, measurement
- ChangeSet: create WP drafts (draft-only) + internal link TODOs

## 6) Lifecycle Revenue Loop (Klaviyo × Shopify)
**Workflow ID:** `lifecycle_revenue_loop`
**Trigger:** weekly retention + monthly lifecycle refresh.
**Command:** `mar21 run weekly --workspace <id>` (or `mar21 plan lifecycle_revenue_loop --workspace <id>`)

**Connectors**
- Klaviyo, Shopify (+ GA4 optional)

**Skills**
- `lifecycle.flow_funnel_audit`
- `lifecycle.segment_opportunity_scan`
- `lifecycle.subjectline_test_plan`
- `lifecycle.draft_updates`
- `copy.plain_language_check` (clarity + CTA)

**Artifacts**
- Plan: tests + rollout + measurement
- Report: drop-offs and segments
- ChangeSet: draft updates; optionally push to draft state (supervised)

## 7) Lead-to-Revenue Hygiene (HubSpot)
**Workflow ID:** `lead_to_revenue_hygiene`
**Trigger:** weekly pipeline quality and SLA checks.
**Command:** `mar21 crm report lead_to_revenue_hygiene --workspace <id>` (or `mar21 report lead_to_revenue_hygiene --workspace <id>`)

**Connectors**
- HubSpot (+ Slack for escalations)

**Skills**
- `crm.lifecycle_stage_consistency_audit`
- `crm.pipeline_leak_detection`
- `crm.nurture_gap_plan`

**Artifacts**
- Plan: fixes and ownership
- Report: where leads die + what to change
- ChangeSet: property fixes / workflow suggestions (supervised)

## 8) Landing Page Conversion Iteration (WordPress × GA4)
**Workflow ID:** `landing_page_iteration`
**Trigger:** weekly conversion work; after campaign launches.
**Command:** `mar21 plan landing_page_iteration --workspace <id>`

**Connectors**
- WordPress, GA4 (+ Meta Ads context)

**Skills**
- `cro.funnel_dropoff_analysis`
- `cro.hypothesis_generate`
- `cro.variant_copy_draft`
- `content.eeat_review` (trust checks for claims and tone)
- `copy.plain_language_check` (comprehension-first)
- `cro.measurement_plan`

**Artifacts**
- Plan: hypotheses + variants + QA + measurement window
- Report: evidence + expected impact
- ChangeSet: WP draft updates (supervised)

## 9) Distribution Weekly (Owned/Earned/Paid)
**Workflow ID:** `distribution_weekly`  
**Trigger:** weekly cadence to ship and measure distribution, not only drafts.  
**Command:** `mar21 plan distribution_weekly --workspace <id> --since P7D`

**Connectors (v1)**
- WordPress (owned)
- Klaviyo (owned)
- Meta Ads (paid context; optional)
- Slack (operator broadcast)

**Skills (examples)**
- `distribution.plan_generate`
- `distribution.calendar_generate`
- `distribution.repurpose_map_generate`
- `copy.plain_language_check`

**Artifacts**
- `outputs/distribution_plan.md` + `outputs/distribution_plan.yaml`
- `outputs/distribution_calendar.md`
- `outputs/repurpose_map.yaml`
- `outputs/measurement_plan.md`
- `changeset.yaml`: draft/schedule ops where possible + `mar21.todo.create` for PR/community/partners

## Autopilot loops (daily / weekly / monthly)

### Daily (`mar21 run daily`)
- Anomaly guardrails (traffic/spend/revenue/leads)
- “Inbox zero” triage: generate investigation steps + Slack summary

### Weekly (`mar21 run weekly`)
- Growth Operating Review
- Meta Ads cleanup (bounded)
- SEO opportunity clusters + briefs
- Lifecycle flow health + test plan
- Creative system pipeline (briefs + matrix + fatigue)
- Distribution weekly (calendar + repurpose map)

### Monthly (`mar21 run monthly`)
- GTM refresh (positioning, ICP, channels)
- Deep research refresh + sparring (update `research_pack.md` + decisions)
- Budget reallocation strategy + forecast
- Measurement audit (events, UTMs, attribution assumptions)
