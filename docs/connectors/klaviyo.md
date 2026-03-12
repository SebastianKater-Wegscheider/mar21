# Klaviyo (`klaviyo`) — Connector Catalog (v1)

## Auth
- Type: Private API key

Env vars (suggested):
- `MAR21_KLAVIYO_PRIVATE_API_KEY`

## Data minimization / PII
- Prefer aggregated metrics.
- Avoid pulling raw subscriber profiles unless strictly necessary.

## Capabilities (v1)
### Reads
| Capability id | Read/Write | Risk | Dry-run | Required params | Limits |
|---|---|---:|---:|---|---|
| `klaviyo.read.flows.list` | read | low | yes | `since` | paging |
| `klaviyo.read.campaigns.list` | read | low | yes | `since` | paging |
| `klaviyo.read.metrics.aggregate` | read | low | yes | `since`, `metricIds[]` | rate-limited |

### Writes (draft-only, supervised)
| Capability id | Read/Write | Risk | Dry-run | Required params | Limits |
|---|---|---:|---:|---|---|
| `klaviyo.write.draft.update` | write | medium | yes | `draftId`, `patchRef` | drafts only |

## Explicitly later
- Sending/scheduling campaigns (high risk)

