# mar21 Structure Patterns (What We Standardize)

This document captures repo-structure patterns `mar21` intentionally adopts to keep the boilerplate:
- updateable,
- override-friendly,
- safe to operate,
- and easy to extend.

It does not depend on any single upstream project; these are common patterns in modern agent/tool frameworks.

## 1) Stable surface vs implementation
We separate:
- **stable surface**: file formats + capability ids + run artifacts
- **implementation**: heuristics, SDKs, prompts, internal orchestration

This lets the repo evolve without breaking operators.

## 2) Overlay configuration (`_cfg/`)
Each workspace gets an override layer:
- `workspaces/<ws>/_cfg/`

Purpose:
- keep local customization and policies separate from core defaults
- make upstream updates easier (fewer merge conflicts)

## 3) Catalog + manifests
We treat “what exists” as data:
- skills have manifests (`skills/*/*/skill.yaml`)
- connectors have manifests (recommended) (`packages/connectors/*/connector.yaml`)
- schemas are first-class (`schemas/`)

This enables discovery, validation, and tooling.

## 4) Runs as immutable artifacts
The run folder is the audit trail:
- inputs snapshot
- evidence
- plan/report
- changeset
- approvals
- structured logs

Runs are meant to be replayable and reviewable.

## 5) Modules/packs mindset (future code organization)
Even in a monorepo, `mar21` should feel modular:
- core orchestration in `packages/core`
- UI/CLI boundary in `packages/cli`
- each connector in `packages/connectors/<tool>`
- skills in `skills/`

This keeps tool integrations isolated and replaceable.

## 6) “Core” vs “packs” (optional distribution pattern)
As the implementation grows, `mar21` can separate:
- a **core** set of skills/workflows/templates that everyone gets, and
- optional **packs** (expansions) for specific industries, motions, or tool stacks.

This enables:
- smaller installs (one-person marketing should not require a giant context window),
- clearer governance (“core” stays stable; packs iterate faster),
- easier sharing of best-practice playbooks.

Suggested structure (in the implementation repo):
```
packs/
  core/
  ecommerce/
  b2b_saas/
  agency/
```

## 7) Bundles (optional “copy/paste” distribution)
Some operators will run `mar21` via chat-first tools rather than a CLI.
For those cases, a “bundle export” pattern can exist:
- produce single-file bundles of selected skills/workflows/templates suitable for upload.

Suggested structure:
```
dist/
  skills/
  workflows/
  teams/        # grouped bundles (e.g., SEO+Content+Lifecycle)
```

These bundles are a distribution convenience and must never replace the stable surface artifacts (Context, ChangeSet, Runs).
