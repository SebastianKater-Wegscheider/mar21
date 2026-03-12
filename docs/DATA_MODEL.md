# mar21 Data Model (Marketing Truth Layer)

This document defines canonical metrics, dimensions, joins, and attribution disclaimers. It exists to prevent “metric drift” across tools.

## Canonical metrics (v1)
All metrics are represented in a canonical namespace regardless of source tool.

### Spend & efficiency
- `spend` (money)
- `clicks`
- `impressions`
- `cpc = spend / clicks`
- `cpm = spend / impressions * 1000`

### Funnel & revenue
- `sessions` (GA4)
- `users` (GA4)
- `conversions` (GA4-defined; must be declared in context)
- `leads` (HubSpot aggregation; definition must be declared in context)
- `orders` (Shopify)
- `revenue_gross` (Shopify/GA4)
- `revenue_net` (optional; refunds/chargebacks policy required)

### Outcome ratios
- `cvr = conversions / sessions`
- `cpa = spend / conversions` (or spend / leads; specify denominator)
- `roas = revenue / spend` (specify which revenue and time window)

## Canonical dimensions (v1)
- `date` (ISO date or timestamp; windowing must be explicit)
- `source` (canonical channel source)
- `medium`
- `campaign`
- `content`
- `term`
- `landing_page` (normalized URL path)
- `geo_country`
- `device`
- `platform` (tool id: `ga4`, `meta_ads`, etc.)

### Creative/distribution dimensions (v1, recommended)
To make creative and distribution measurable, prefer these dimensions where possible:
- `creative_asset_id` (from asset manifest)
- `creative_angle`
- `creative_format`
- `distribution_channel` (owned/paid/earned + tool id)
- `distribution_touchpoint` (e.g. “newsletter”, “community_post”, “partner_email”)

## Windowing & rounding rules
- All time windows are expressed as ISO 8601 durations: `P7D`, `P28D`, `P90D`.
- Reports must clearly state:
  - window used for each finding (e.g. “P7D vs P28D”)
  - timezone used (from context `measurement.timezone`)
- Rounding:
  - money: 2 decimals
  - ratios: 2–4 decimals in machine outputs; human report can round to 1–2 decimals

## Currency normalization
The context must declare `businessModel.pricing.currency` as the canonical currency.
If multi-currency exists:
- canonical reporting currency is required
- conversions must state the exchange rate policy (later; out of v1 scope for implementation, but required as documentation in reports)

## KPI tree computation
`kpiTree` defines how goals decompose. The runner must:
- compute lagging/leading metrics per the tree
- explicitly annotate missing nodes as “unknown” instead of silently dropping them

Example:
- Pipeline → SQLs → MQLs → Sessions → Impressions

## Attribution disclaimers (non-negotiable)
`mar21` reports must always include an attribution note:
- **GA4**: first-party measurement, subject to consent, tagging, and attribution settings.
- **Meta Ads**: platform reporting, subject to modelled conversions, view-through, and attribution windows.
- **Shopify**: commerce truth, subject to refunds/chargebacks and offline payments.

Reports must:
- never claim “the truth” when sources disagree
- show differences as differences (and assign a confidence level)

## Joins: how we connect sources

### Primary join: UTM conventions (recommended)
UTMs are the primary join key across ads → sessions → revenue.

Required fields for join quality:
- `utm_source`
- `utm_medium`
- `utm_campaign`

Optional but recommended:
- `utm_content`
- `utm_term`

In `mar21`, `utm_content` should prefer embedding `creative_asset_id` (or a stable alias) when feasible, so we can join performance back to creative decisions.

### Fallback joins
If UTMs are missing:
- map using naming conventions (campaign name alignment)
- map using landing page + date window proximity

Fallback joins must:
- label outputs with a lower confidence
- create an “unattributed” bucket rather than forcing joins

## Unattributed handling & confidence
Any aggregation must include:
- `attribution.confidence`: `high|medium|low`
- `attribution.unattributed_share`: percentage of outcomes that cannot be joined

## Required reporting section: “Measurement Reality”
Every weekly/monthly report must include:
- what sources were used
- what joins were possible
- where attribution conflicts exist
- how much is unattributed
