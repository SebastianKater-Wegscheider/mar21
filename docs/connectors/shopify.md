# Shopify (`shopify`) — Connector Catalog (v1)

## Auth
- Type: Admin API access token

Env vars (suggested):
- `MAR21_SHOPIFY_ACCESS_TOKEN`
- `MAR21_SHOPIFY_STORE_DOMAIN`

## Data minimization / PII
- Prefer order aggregations and cohort summaries.
- Do not store customer PII in runs; default to summary rows.

## Capabilities (v1)
| Capability id | Read/Write | Risk | Dry-run | Required params | Limits |
|---|---|---:|---:|---|---|
| `shopify.read.orders.list` | read | medium | yes | `since`, `fields[]` | treat as medium (PII risk), paging |
| `shopify.read.revenue.summary` | read | low | yes | `since` | derived from orders (aggregated) |

## Writes (v1)
- None by default (commerce writes are treated as high-risk)

