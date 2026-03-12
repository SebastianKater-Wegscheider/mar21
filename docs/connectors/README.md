# mar21 Connector Catalogs

This folder contains the per-tool **capability catalogs** for v1. Each connector doc lists:
- auth method + minimal scopes
- env vars
- capability ids (stable)
- risk levels, dry-run behavior
- limits (rate, paging, lookback)
- data minimization and PII handling rules

## Naming conventions
Capability ids follow:

`<tool>.<read|write>.<resource>.<verb>`

Examples:
- `ga4.read.report.run`
- `meta_ads.write.adset.pause`
- `gdrive.read.files.download`

Risk levels:
- `low`: reversible, bounded, low likelihood of harm
- `medium`: changes live systems or handles sensitive data, but bounded/reversible
- `high`: irreversible or large monetary/brand risk

## v1 connector catalogs
- `gsc.md`
- `ga4.md`
- `meta_ads.md`
- `hubspot.md`
- `shopify.md`
- `wordpress.md`
- `slack.md`
- `klaviyo.md`
- `gdrive.md` (priority private docs; all file types)

