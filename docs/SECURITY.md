# mar21 Security (GDPR-first)

`mar21` treats security and privacy as product requirements, not compliance paperwork.

This document specifies how secrets, PII, approvals, and retention work in the `mar21` operating model.

## Secrets
- Secrets live in `workspaces/<workspace>/secrets/.env` and are never committed.
- Prefer **separate credentials** for:
  - read-only operations (default),
  - write operations (explicitly enabled),
  - high-risk operations (kept off by default).
- OAuth refresh tokens must be stored locally (keychain where available) or encrypted-at-rest in `secrets/`.

## PII and data minimization
Non-negotiables:
- **No raw PII in `runs/`** unless the workspace explicitly opts in (and documents why).
- **No raw PII in logs** (`logs.jsonl`) ever.
- Pull only what you need for the run scope (aggregation-first).

Examples of data that must be redacted:
- emails, names, addresses, phone numbers
- message bodies or free-form notes containing personal data
- order-level payloads with customer details

## Approvals and audit
- Every write op is represented as a ChangeSet op (`changeset.yaml`).
- `approvals.json` records:
  - operator id (or “local”)
  - timestamp
  - op id
  - decision and optional note
- Run folders are the audit trail: inputs snapshot + outputs + logs + approvals + changeset.

## Retention defaults
Defaults (workspace can override):
- `cache/` snapshots: 30 days
- `runs/`: retained indefinitely (auditing), unless auto-prune is enabled

If auto-prune is enabled, it must:
- keep aggregated metrics (if needed) without raw payloads
- keep ChangeSets and approvals for accountability

## Kill switch
Every workspace must be able to immediately stop writes:
- set `constraints.autonomy.defaultMode: advisory`
- remove allowlist entries
- revoke write credentials in `secrets/`

## Public vs private sources (research packs)
`mar21` research is allowed to use both:
- **public sources** (webpages, public reports), and
- **private sources** (Notion/Drive/Confluence docs, internal memos, interview notes).

Security requirements for private sources:
- Treat private docs as **references** first: cite doc ids/refs in `research_pack.md` and avoid copying full content into runs.
- If excerpts are necessary, store only the minimal excerpt (redacted) in `outputs/evidence/`.
- Never log private URLs containing tokens; never store them in `runs/`.
- If private docs contain personal data, default to **summaries** and strip identifiers.

If you plan to ingest private doc systems via connectors, treat them as high-sensitivity connectors:
- strict scopes
- aggressive redaction
- explicit retention policy

### Google Drive specifics (priority)
- Prefer scopes like Drive **metadata-only** or **readonly** where possible.
- Store Drive references as `drive:fileId:<id>` in `research_pack.md` sources.
- If exporting any file type for evidence (Docs/Sheets/Slides/PDFs/images/etc.), store only redacted excerpts in `outputs/evidence/` and reference them from the research pack.
- Avoid storing full binaries unless explicitly required; if stored, add a retention note and avoid re-distribution.

Default stance:
- Exporting/downloading Drive files is **allowed by default** in `supervised` mode, but must stay within configured caps (count/size) and follow minimization/redaction rules.

## Supply chain / dependencies (future implementation)
When code is added:
- pin dependencies
- run vulnerability scans in CI
- keep connector SDK usage behind stable ops (so swapping SDK versions doesn’t change semantics)

## Third-party skills and templates (supply chain)
If `mar21` supports importing third-party skills/templates:
- treat them as **code**, not content
- require review before enabling in autopilot
- pin versions and record provenance (source + hash)
- prefer running them in advisory mode first

## Vulnerability reporting
Report vulnerabilities via **GitHub Security Advisories** (private reporting).

Do not open public issues with exploit details. Use the repository’s Security tab to submit a private report.
