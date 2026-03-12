# HubSpot (`hubspot`) — Connector Catalog (v1)

## Auth
- Type: Private App token

Env vars (suggested):
- `MAR21_HUBSPOT_PRIVATE_APP_TOKEN`

## Data minimization / PII
- Default to aggregated lifecycle metrics.
- Avoid exporting raw contacts; if required, pull only minimal fields and redact.

## Capabilities (v1)
### Reads
| Capability id | Read/Write | Risk | Dry-run | Required params | Limits |
|---|---|---:|---:|---|---|
| `hubspot.read.deals.list` | read | low | yes | `since`, `properties[]` | paging |
| `hubspot.read.contacts.list` | read | medium | yes | `since`, `properties[]` | treat as medium due to PII risk |
| `hubspot.read.lifecycle.metrics` | read | low | yes | `since` | aggregated |

### Writes (supervised)
| Capability id | Read/Write | Risk | Dry-run | Required params | Limits |
|---|---|---:|---:|---|---|
| `hubspot.write.property.update` | write | medium | yes | `objectType`, `objectId`, `patch` | bounded changes |
| `hubspot.write.task.create` | write | low/medium | yes | `assignee`, `dueAt`, `note` | avoid PII in notes |

## Explicitly later
- Workflow automation changes
- Bulk contact updates without strict scoping

