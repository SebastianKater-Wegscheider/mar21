# Contributing to mar21

`mar21` is currently **docs-first**: the goal is to stabilize the operating model and interfaces before shipping a lot of code.

## What we accept
- Clarifications, fixes, and expansions to the docs:
  - `docs/MANIFESTO.md`
  - `docs/ARCHITECTURE.md`
  - `docs/SPECS.md`
  - `docs/WORKFLOWS.md`
  - `docs/CONNECTORS.md`
  - `docs/SECURITY.md`
  - `docs/ROADMAP.md`
- Proposals for new skills/connectors as **specs** (manifests + contracts), even if code isn’t implemented yet.

## How to contribute (docs/specs)
1) Open an issue describing the change and why it matters.
2) Prefer small PRs that:
   - keep interfaces stable (Context, Skill I/O, ChangeSet, Run artifacts),
   - add concrete examples,
   - document safety/risk.
3) If you propose a breaking change to an interface:
   - explain migration,
   - justify why the old interface can’t work,
   - propose a version bump (`mar21/v2`, `changeset-v2`, etc.).

## Non-negotiables
- Supervised-by-default (autonomy must be explicitly allowlisted)
- No secrets in repo
- GDPR-first defaults (redaction + minimization)
- All workflows are run-based and emit Plan + Report + ChangeSet

## Style
- Be concrete: show example YAML/JSON snippets.
- Prefer naming conventions over prose.
- Keep language direct and operator-friendly.

