# mar21 Governance

`mar21` is an open-source boilerplate with a stable interface surface. Governance exists to keep interfaces coherent and safe.

## Maintainer model
- Initially **maintainer-led**: maintainers merge PRs and resolve disputes.
- As adoption grows, the project may add:
  - co-maintainers for connectors/domains,
  - a lightweight RFC process for interface changes (required for breaking changes).

## Interface changes (stable surface)
Changes to the stable surface (see `docs/VERSIONING.md`) require:
- updated schemas in `schemas/`
- updated examples in `examples/`
- migration notes in the PR description (or a short doc)
- version bump via `apiVersion` if breaking

## RFC process (when needed)
For significant changes:
1) Open an issue titled `RFC: <topic>`
2) Provide:
   - motivation
   - proposed interface changes
   - backwards-compat story
   - migration steps
3) Maintain discussion until decision is documented

## Releases (docs-first now)
Until code exists:
- treat doc+schema updates as “release-worthy” if they affect stability
- keep examples valid and in sync

Once code exists:
- publish release notes
- document deprecations and migration windows

## Security and vulnerability reporting
Report vulnerabilities via **GitHub Security Advisories** (private reporting).

If you discover a security issue:
- do not open a public issue with exploit details
- use the repository’s Security tab to submit a private report

