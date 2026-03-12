# Slack (`slack`) — Connector Catalog (v1)

## Auth
- Type: Bot token

Env vars (suggested):
- `MAR21_SLACK_BOT_TOKEN`

## Data minimization / PII
- Avoid posting personal data; prefer aggregated and redacted summaries.

## Capabilities (v1)
| Capability id | Read/Write | Risk | Dry-run | Required params | Limits |
|---|---|---:|---:|---|---|
| `slack.write.message.post` | write | low | yes | `channel`, `messageRef` | rate-limited by Slack API |
| `slack.write.thread.reply` | write | low | yes | `channel`, `threadTs`, `messageRef` | rate-limited |

## Reads (v1)
- none required

