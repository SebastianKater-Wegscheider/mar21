# Meta Ads (`meta_ads`) — Connector Catalog (v1)

## Auth
- Type: OAuth access token

Env vars (suggested):
- `MAR21_META_ADS_ACCESS_TOKEN`
- `MAR21_META_ADS_ACCOUNT_ID`

## Data minimization / PII
- Do not pull user-level data.
- Prefer insights aggregations by entity (campaign/adset/ad).
- Store only aggregated evidence in `outputs/evidence/`.

## Capabilities (v1)
### Reads
| Capability id | Read/Write | Risk | Dry-run | Required params | Limits |
|---|---|---:|---:|---|---|
| `meta_ads.read.insights.by_campaign` | read | low | yes | `accountId`, `since`, `fields[]` | paging; API rate limits |
| `meta_ads.read.insights.by_adset` | read | low | yes | `accountId`, `since`, `fields[]` | paging; API rate limits |
| `meta_ads.read.insights.by_ad` | read | low | yes | `accountId`, `since`, `fields[]` | paging; API rate limits |

### Writes (supervised-by-default)
| Capability id | Read/Write | Risk | Dry-run | Required params | Limits |
|---|---|---:|---:|---|---|
| `meta_ads.write.adset.pause` | write | medium | yes | `adsetId`, `reason` | bounded by allowlist/impact caps |
| `meta_ads.write.campaign.pause` | write | medium/high | yes | `campaignId`, `reason` | high when spend impact is large |
| `meta_ads.write.budget.update` | write | high | yes | `entityId`, `amount`, `currency` | must be capped and approved |

## Explicitly later
- Creative uploads and publishing
- Broad structural changes without a simulation step

