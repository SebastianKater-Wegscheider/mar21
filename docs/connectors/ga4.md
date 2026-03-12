# Google Analytics 4 (`ga4`) — Connector Catalog (v1)

## Auth
- Type: OAuth
- Recommended scope (read-only): `https://www.googleapis.com/auth/analytics.readonly`

Env vars (suggested):
- `MAR21_GA4_CLIENT_ID`
- `MAR21_GA4_CLIENT_SECRET`
- `MAR21_GA4_REFRESH_TOKEN`

## Data minimization / PII
- Prefer aggregated reports; avoid pulling user-level identifiers.
- Respect consent mode; reports must include “Measurement Reality” disclaimers.

## Capabilities (v1)
| Capability id | Read/Write | Risk | Dry-run | Required params | Limits |
|---|---|---:|---:|---|---|
| `ga4.read.report.run` | read | low | yes | `propertyId`, `since`, `dimensions[]`, `metrics[]` | paging depends on report; rate-limited by API |
| `ga4.read.funnel.summary` | read | low | yes | `propertyId`, `since`, `funnelDefinition` | derived from reports |

### Optional writes (still supervised)
| Capability id | Read/Write | Risk | Dry-run | Required params | Limits |
|---|---|---:|---:|---|---|
| `ga4.write.annotation.create` | write | medium | yes | `propertyId`, `timestamp`, `note` | treat as supervised-only |

## Explicitly later
- Audience management, config writes

