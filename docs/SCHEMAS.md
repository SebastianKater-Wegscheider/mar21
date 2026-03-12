# mar21 Schemas

`mar21` treats schemas as part of the product. Specs are only “real” if they can be validated.

## JSON Schema standard
- All schemas use **JSON Schema Draft 2020-12**.
- The schema files live in `schemas/`.
- YAML artifacts are validated by:
  1) parsing YAML into JSON,
  2) validating that JSON instance against the corresponding schema.

## Mapping: files → schemas
Stable artifacts and their schema:
- `workspaces/<ws>/marketing-context.yaml` → `schemas/marketing-context.schema.json`
- `workspaces/<ws>/_cfg/mcp-servers.yaml` → `schemas/mcp-servers.schema.json`
- `skills/*/*/skill.yaml` → `schemas/skill.schema.json`
- `runs/<id>/changeset.yaml` → `schemas/changeset.schema.json`
- `runs/<id>/inputs/request.yaml` → `schemas/request.schema.json`
- `runs/<id>/run.json` → `schemas/run.schema.json`

Recommended additional schemas:
- `workspaces/<ws>/profiles/*.yaml` → `schemas/profile.schema.json`
- `packages/connectors/*/connector.yaml` → `schemas/connector.schema.json`
- `runs/<id>/outputs/evidence/evidence.json` → `schemas/evidence.schema.json`
- `runs/<id>/outputs/creative_brief.yaml` → `schemas/creative-brief.schema.json`
- `runs/<id>/outputs/asset_manifest.yaml` → `schemas/asset-manifest.schema.json`
- `runs/<id>/outputs/distribution_plan.yaml` → `schemas/distribution-plan.schema.json`
- `runs/<id>/outputs/repurpose_map.yaml` → `schemas/repurpose-map.schema.json`
- `workspaces/<ws>/todos.yaml` → `schemas/todos.schema.json`

## `$id` strategy
Schemas use a stable URN-based `$id` so the identifier doesn’t depend on a hosted domain.

Example:
- `urn:mar21:schema:marketing-context:v1`

## Validation expectations (docs-only now, code later)
Future implementation should:
- validate user-provided files at the CLI boundary (fail fast)
- validate every skill output before writing artifacts
- validate ChangeSets before apply

Local validation commands and CI gates will be added during implementation. For now:
- schemas must remain syntactically valid JSON
- example instances in `examples/` must remain valid against the schemas

## Examples
Concrete examples for each schema live in `examples/`.
