# mar21 Roadmap (Moving Target, Stable Surface)

`mar21` is intentionally a moving target: tools evolve, models evolve, the profession evolves.

What must *not* churn are the **interfaces**:
- marketing context (`marketing-context.yaml`)
- skill I/O contracts (`skills/*/skill.yaml`)
- run artifacts (`runs/<id>/**`)
- typed ChangeSets (`changeset.yaml`)

This roadmap is organized by maturity levels rather than a rigid timeline.

## Maturity levels
### L0 — Docs-as-product (now)
- Manifesto + architecture + specs + workflows
- Decision-complete contracts for a TypeScript/Node boilerplate

### L1 — Read-only engine
- CLI skeleton + workspace init wizard
- Connectors implement read capabilities (GSC, GA4, Meta Ads, HubSpot, Shopify, WordPress, Slack, Klaviyo)
- Runs produce Plan + Report + ChangeSet suggestions (no writes)

### L2 — Supervised execution
- `mar21 apply <runId>` applies ChangeSets with interactive approvals
- Connector dry-run support for write ops
- Memory updates as ChangeSet ops (supervised)

### L3 — Safe autopilot
- Built-in loop runner + profiles (daily/weekly/monthly)
- Workspace allowlist enables limited low-risk autonomous ops
- Impact budgets (max spend delta, max publish scope, etc.)

### L4 — Verified skills + evaluations
- Schema validation for every skill output
- Golden-run fixtures for key workflows
- Regression checks (output shape + key metrics invariants)
- Research pack quality gates (sources present, claims attributable, gaps explicit)

## Expansion vectors (after v1)
### Deeper per-tool support
- Google Ads connector (search terms, negatives, bids, budgets)
- Ahrefs connector (keyword explorer, competitor gap)
- Search Console + GA4 joins (landing page intent → conversion)
- HubSpot Marketing Hub (emails, workflows) if needed
- Private docs connector: Google Drive / Docs (priority)

### New channels
- LinkedIn Ads, TikTok Ads, YouTube, email providers beyond Klaviyo

### Multi-agent “marketing team”
- SEO agent, Paid agent, Lifecycle agent, CRM agent
- CMO orchestrator agent delegates, resolves conflicts, enforces budget/risk

### Operational hardening
- OpenTelemetry traces (optional)
- CI templates, release workflow for the boilerplate
- Better secrets UX (keychain-first)
