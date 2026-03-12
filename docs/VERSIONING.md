# mar21 Versioning & Compatibility

This document defines how `mar21` evolves **without breaking users**.

## The stable surface (must be compatible)
These interfaces are considered the **stable surface**:
- Marketing context: `workspaces/<ws>/marketing-context.yaml`
- Skill manifests and their typed I/O: `skills/*/*/skill.yaml`
- Connector capability ids (e.g. `ga4.read.report.run`)
- ChangeSets: `runs/<id>/changeset.yaml`
- Run artifact contract and layout: `runs/<id>/**` (required files + minimum templates)

Everything else is allowed to iterate more freely (internal implementation, prompts, SDK usage, heuristics).

## `apiVersion` rules
Every artifact that is part of the stable surface must include an `apiVersion` string.

Naming:
- Context: `mar21/v1`
- Skill manifest: `mar21/skill-v1`
- Connector manifest: `mar21/connector-v1`
- ChangeSet: `mar21/changeset-v1`
- Request: `mar21/request-v1`
- Run metadata: `mar21/run-v1`
- Autopilot profile: `mar21/profile-v1`

Rules:
- **Compatible changes** keep the same `apiVersion`.
- **Breaking changes** require a new `apiVersion` (e.g. `mar21/changeset-v2`).
- Do not overload meanings: if semantics change, version changes.

## What is backwards-compatible vs breaking?

### Marketing context (`mar21/v1`)
Backwards-compatible:
- add a new **optional** field (with a default behavior)
- add a new enum value *only if* it is treated as “unknown/other” safely by old runners

Breaking:
- rename/remove a field
- change a field type (string → object, number → string)
- change semantics of a field (e.g. interpreting budget units differently)
- make a previously optional field required

### Skill manifests (`mar21/skill-v1`)
Backwards-compatible:
- add optional metadata fields (e.g. `tags`, `examples`)
- expand `usesConnectors` with additional *optional* capabilities

Breaking:
- change `id` format/meaning
- change output schema in a way that invalidates old consumers

### ChangeSets (`mar21/changeset-v1`)
Backwards-compatible:
- add optional fields in ops (`expectedImpact`, `evidenceRef`)
- add a new op type if the apply engine treats unknown ops as “unsupported” and refuses safely

Breaking:
- change op semantics (e.g. risk levels, approval behavior)
- change required fields for ops
- change how idempotency keys are interpreted

### Connector capability ids
Backwards-compatible:
- add new capabilities
- deprecate a capability (keep it working for the deprecation window)

Breaking:
- rename a capability id
- change the semantics of a capability id (same id does something different)

## Deprecation policy
- Deprecations must be announced in:
  - release notes (once code exists), and
  - docs (`docs/ROADMAP.md` and the relevant spec).
- A deprecated field/capability must remain supported for **at least 2 minor releases** (once releases exist).
- Deprecations must include:
  - “replacement” guidance,
  - migration steps,
  - examples of before/after.

## How to introduce a v2
When a breaking change is required:
1) Add new schema + docs for the v2 artifact (`schemas/*-v2*.json`).
2) Keep v1 support during the deprecation window (dual-read / dual-write where feasible).
3) Provide a migration guide and tooling notes (even if manual at first).
4) Only then mark v1 as deprecated.

## Release discipline (docs-first)
Until implementation exists, treat doc changes like API changes:
- If you change a required field or semantics in specs, update `apiVersion` accordingly.
- Keep example artifacts in `examples/` in sync with schemas.

