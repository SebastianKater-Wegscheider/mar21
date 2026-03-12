# Google Drive (`gdrive`) — Connector Catalog (v1, all file types)

`gdrive` is the priority private-doc connector for `mar21`. It supports reading **all file types** with a default policy:
- allowed by default in `supervised` mode
- metadata-first, capped, and excerpt-based evidence

## Auth
- Type: OAuth
- Recommended scopes (read):
  - `https://www.googleapis.com/auth/drive.metadata.readonly` (search + metadata)
  - `https://www.googleapis.com/auth/drive.readonly` (downloads/exports)

Env vars (suggested):
- `MAR21_GDRIVE_CLIENT_ID`
- `MAR21_GDRIVE_CLIENT_SECRET`
- `MAR21_GDRIVE_REFRESH_TOKEN`

## Data minimization / PII
Non-negotiables:
- cite by `drive:fileId:<id>` in `outputs/research_pack.md`
- store **excerpts** in `outputs/evidence/` by default, not full documents
- store raw bytes **cache-only** under `workspaces/<ws>/cache/private/gdrive/…` (never in run folders by default)
- redact names/emails and other PII in excerpts
- never log tokenized private URLs

## Capability catalog (v1)
| Capability id | Read/Write | Risk | Dry-run | Required params | Limits |
|---|---|---:|---:|---|---|
| `gdrive.read.files.search` | read | low | yes | `query` or `folderId`, `limit` | cap results (default 50) |
| `gdrive.read.files.get_metadata` | read | low | yes | `fileId` | - |
| `gdrive.read.files.export` | read | low/medium | yes | `fileId`, `mimeType` | cap size; Sheets/Slides exports can be large |
| `gdrive.read.files.download` | read | medium | yes | `fileId` | cap downloads and max file size |

## Recommended export formats (by type)
- Google Docs → Markdown or plain text
- Google Sheets → CSV
- Google Slides → PDF
- PDFs → text extraction via a skill (redacted)
- Images → optional OCR via a skill (redacted)

## Default caps (recommended)
Unless overridden via `inputs/request.yaml`:
- `maxDownloads`: 10
- `maxFileSizeMB`: 25

If caps are exceeded, the CLI must prompt for confirmation and record the decision (no private URLs).

## Explicitly later
- Creating/modifying Drive files (high risk)
- Auto-sharing or permission changes (out of scope)
