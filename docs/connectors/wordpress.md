# WordPress (`wordpress`) — Connector Catalog (v1)

## Auth
- Type: Application password (or OAuth, later)

Env vars (suggested):
- `MAR21_WORDPRESS_BASE_URL`
- `MAR21_WORDPRESS_APP_PASSWORD`

## Data minimization / PII
- Do not fetch private user data.
- Treat content edits as medium/high risk based on publish state.

## Capabilities (v1)
### Reads
| Capability id | Read/Write | Risk | Dry-run | Required params | Limits |
|---|---|---:|---:|---|---|
| `wordpress.read.post.list` | read | low | yes | `since`, `status` | paging |
| `wordpress.read.page.list` | read | low | yes | `since`, `status` | paging |

### Writes (draft-only, supervised)
| Capability id | Read/Write | Risk | Dry-run | Required params | Limits |
|---|---|---:|---:|---|---|
| `wordpress.write.post.create_draft` | write | medium | yes | `title`, `contentRef` | drafts only |
| `wordpress.write.post.update_draft` | write | medium | yes | `postId`, `contentRef` | drafts only |

## Explicitly later
- Publishing or updating live pages (high risk)

