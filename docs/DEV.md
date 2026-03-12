# mar21 Development Guide

This is the engineering guide for implementing the `mar21` boilerplate.

## Tooling assumptions
- Node.js: **20.x**
- Package manager: **pnpm**
- Repo shape: TypeScript/Node monorepo (see `docs/ARCHITECTURE.md`)

## Workspace bootstrap (local)
Conceptual flow:
1) Create workspace skeleton:
   - `mar21 init --workspace acme`
2) Fill `workspaces/acme/marketing-context.yaml`
3) Add secrets locally:
   - `workspaces/acme/secrets/.env`
4) Run a read-only workflow (advisory/supervised):
   - `mar21 plan deep_research_sparring --workspace acme --since P90D`
5) Inspect run artifacts in:
   - `workspaces/acme/runs/<runId>/`

## `_cfg/` overrides (update-safe customization)
Each workspace may define:
- `workspaces/<ws>/_cfg/`

Purpose:
- keep local customization **separate** from core defaults so upstream updates are easier to merge.

Recommended contents:
- `policies.yaml` (approval rules, caps, redaction)
- `templates/` (Plan/Report templates)
- `skills/` (workspace-specific skill config or wrappers)

Precedence:
1) core defaults (hard-coded / package defaults)
2) `marketing-context.yaml`
3) `_cfg/` overrides (highest precedence)

## Adding a connector (end-to-end)
1) Add connector manifest:
   - `packages/connectors/<tool>/connector.yaml` (must validate with `schemas/connector.schema.json`)
2) Implement capability ids in code (later):
   - each capability is a stable operation name
3) Add docs:
   - `docs/connectors/<tool>.md` capability catalog
4) Add tests/fixtures (later):
   - schema validation tests
   - dry-run behavior tests for writes

## Adding a skill (end-to-end)
1) Add manifest:
   - `skills/<domain>/<skill>/skill.yaml` (validate with `schemas/skill.schema.json`)
2) Define typed I/O:
   - input and output schema in the manifest
3) Define artifacts:
   - required outputs and evidence refs
4) Add docs:
   - list the skill in the relevant workflow(s)
5) Add fixtures (later):
   - validate outputs against schema

## Adding a workflowId
1) Add workflow spec to `docs/WORKFLOWS.md` (id + command + artifacts)
2) Ensure it maps cleanly to CLI grammar (`docs/CLI.md`)
3) If it’s part of autopilot:
   - add it to a profile (`workspaces/<ws>/profiles/*.yaml` shape in `docs/SPECS.md`)

## Optional: packs and bundles (distribution)
If you add “packs” (core + expansions):
- keep core interfaces stable; packs can iterate faster
- document pack provenance and versions
- ship packs as folders under `packs/`

If you export “bundles” for chat-first tools:
- treat them as distribution artifacts under `dist/`
- ensure bundles never bypass the stable surface (runs + changesets + approvals)

## Recommended scripts (once code exists)
Planned monorepo scripts:
- `pnpm -w lint`
- `pnpm -w test`
- `pnpm -w validate` (schemas + examples)
