# Google Search Console (`gsc`) — Connector Catalog (v1)

## Auth
- Type: OAuth
- Recommended scope (read-only): `https://www.googleapis.com/auth/webmasters.readonly`

Env vars (suggested):
- `MAR21_GSC_CLIENT_ID`
- `MAR21_GSC_CLIENT_SECRET`
- `MAR21_GSC_REFRESH_TOKEN`

## Data minimization / PII
- Prefer aggregated search analytics; avoid exporting raw URL lists beyond what is needed for a run.
- Store exports as aggregated tables in `outputs/evidence/`.

## Capabilities (v1)
| Capability id | Read/Write | Risk | Dry-run | Required params | Limits |
|---|---|---:|---:|---|---|
| `gsc.read.search_analytics.query` | read | low | yes | `siteUrl`, `since`, `dimensions[]` | paging by row limit; max lookback depends on property |

## Supported in v1
- Search analytics by query/page/country/device, used for opportunity clustering and demand capture.

## Explicitly later
- Index coverage, sitemaps, manual actions
- Write actions (generally avoided)

