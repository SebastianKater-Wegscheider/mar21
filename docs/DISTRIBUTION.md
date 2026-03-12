# mar21 Distribution System (Owned / Earned / Paid)

This document specifies how `mar21` operationalizes distribution:
- content is not “done” at draft,
- distribution is planned, versioned, and measured,
- repurposing is explicit (one idea → many assets),
- PR/community/partnership actions exist even when connectors don’t (as tasks).

## Core artifacts (per distribution run)
- `outputs/distribution_plan.md`
- `outputs/distribution_plan.yaml`
- `outputs/distribution_calendar.md` (next 7–30 days)
- `outputs/repurpose_map.yaml` (source asset → derived assets)
- `outputs/measurement_plan.md`
- `changeset.yaml` containing:
  - tool ops (WordPress drafts, Klaviyo drafts, Slack announcements)
  - `mar21.todo.*` ops for non-API work (PR pitches, partner outreach)

## 1) Distribution plan (contract)
`outputs/distribution_plan.yaml`:
```yaml
apiVersion: mar21/distribution-plan-v1
runId: 2026-03-12T090000Z_distribution_weekly
workspace: acme
since: P7D

goal:
  kpiNode: pipeline
  target: "SQLs +10% (P28D)"

sourceAssets:
  - assetId: wp_post_category-entry-point_2026-03_v1
    type: "pillar"
    status: draft

channels:
  owned:
    - id: wordpress
      cadence: weekly
    - id: email
      provider: klaviyo
      cadence: weekly
  paid:
    - id: meta_ads
      cadence: ongoing
  earned:
    - id: pr
      cadence: weekly
    - id: community
      cadence: weekly
    - id: partnerships
      cadence: monthly

repurposingPolicy:
  maxDerivedAssetsPerSource: 6
  requireDistinctiveAssets: true
  requirePlainLanguage: true

tracking:
  utmRequired: true
  conventionsRef: measurement.utm.conventions
```

## 2) Repurpose map (one idea → many assets)
`outputs/repurpose_map.yaml`:
```yaml
apiVersion: mar21/repurpose-map-v1
runId: 2026-03-12T090000Z_distribution_weekly
workspace: acme

maps:
  - sourceAssetId: wp_post_category-entry-point_2026-03_v1
    derived:
      - assetId: meta_static_auditability_2026-03_v1
        channel: meta_ads
        format: static
      - assetId: email_subject_activation_fix_2026-03_v1
        channel: email
        format: subject_line
      - assetId: slack_announcement_entry_point_2026-03_v1
        channel: slack
        format: message
```

## 3) Calendar (what ships, when, where)
`outputs/distribution_calendar.md` must include:
- date
- channel
- assetId
- owner
- measurement window + metric
- status (draft/scheduled/live)

## 4) PR / community / partnerships (no connector required)
Until connectors exist, these are encoded as tasks:
- pitch list + outreach plan
- community posts
- partner co-marketing requests

These appear in ChangeSets as `mar21.todo.create` ops and are tracked like any other work.
See `docs/TASKS.md` for the task contract and `todos.yaml` store.

## 5) WorkflowId: `distribution_weekly`
**Workflow ID:** `distribution_weekly`

**Inputs**
- latest drafts (WordPress/email/creative briefs)
- `marketing-context.yaml` (goals + budgets + constraints)
- optional: research pack summary for narrative alignment

**Connectors (v1)**
- WordPress (drafts)
- Klaviyo (draft updates)
- Meta Ads (context; optionally create “to-do” ops for new creatives)
- Slack (announcements)

**Artifacts**
- distribution plan + calendar + repurpose map + measurement plan
- ChangeSet containing a mix of tool ops and `mar21.todo.*` ops

## 6) Distribution quality gates
Distribution runs must:
- declare which KPI node they target and why
- include UTMs (or explicitly mark “untrackable” with low confidence)
- avoid “spray and pray”: every channel action must map to a hypothesis and a measurement window
