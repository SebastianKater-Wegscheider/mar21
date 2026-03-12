# mar21 CLI Spec

This document defines the **exact** CLI surface and UX expectations. Implementers should not have to guess flags, outputs, prompts, or exit codes.

## Command grammar

### Core verbs
```
mar21 init --workspace <id> [--stack <preset>] [--connectors <list>] [--force]

mar21 plan <workflowId> --workspace <id> [--mode <mode>] [--since <duration>] [--dry-run] [--json]
mar21 analyze <scope> --workspace <id> [--mode <mode>] [--since <duration>] [--dry-run] [--json]
mar21 report <cadence|workflowId> --workspace <id> [--since <duration>] [--json]

mar21 run daily|weekly|monthly --workspace <id> [--profile <profileId>] [--mode <mode>] [--dry-run] [--json]
mar21 autopilot start --workspace <id> --profile <profileId> [--mode <mode>] [--dry-run] [--foreground]

mar21 apply <runId> --workspace <id> [--yes] [--fail-on-reject] [--json]
```

### Optional task convenience commands (v1)
These commands are optional sugar over `todos.yaml` + `mar21.todo.*` ops:
```
mar21 tasks list --workspace <id> [--status open|in_progress|blocked]
mar21 tasks show <taskId> --workspace <id>
mar21 tasks close <taskId> --workspace <id> [--status done|canceled] [--note <text>]
```
They must not bypass the audit trail: mutations should still be recorded as a run with a ChangeSet op.

### Optional namespaces (aliases only)
These do not change semantics; they map to workflows/skills for discoverability:
```
mar21 seo plan <workflowId> ...
mar21 ads plan <workflowId> ...
mar21 content plan <workflowId> ...
mar21 crm plan <workflowId> ...
```

## Global flags and precedence
- `--workspace <id>` selects `workspaces/<id>/`.
- `MAR21_WORKSPACE` is used only if `--workspace` is absent.
- `mar21 init` stack selection:
  - `--connectors <list>` (comma-separated ids) wins over `--stack`.
  - `--stack <preset>` defaults to `default`.
  - Supported presets in v0.1: `default`, `content_engine`, `paid_growth`, `lifecycle`.
- `--mode advisory|supervised|autonomous` overrides:
  - `constraints.autonomy.defaultMode` in the context, and
  - any profile step mode (unless a step explicitly pins a higher-safety mode).
- `--dry-run` forces: never apply tool writes (ChangeSet still produced).
- `--since <duration>` uses ISO 8601 duration strings (e.g. `P7D`, `P28D`, `P90D`).
- `--json` prints a machine-readable run summary to stdout.

## Run id format
Run ids must be filesystem-safe and sortable:

`<UTC timestamp>_<workflowId>`

Example:
- `2026-03-11T101530Z_weekly_review`

Rules:
- timestamp is UTC in `YYYY-MM-DDTHHMMSSZ`
- workflowId is slugified (`[a-z0-9_]+`)
- on collision, append `_<n>` (e.g. `_2`, `_3`)

## Output locations
All runs write to:
- `workspaces/<ws>/runs/<runId>/`

Required run files (see `docs/SPECS.md`):
- `inputs/context.snapshot.yaml`
- `inputs/request.yaml`
- `outputs/plan.md`
- `outputs/report.md`
- `changeset.yaml`
- `logs.jsonl`
- `run.json`
- `approvals.json` (may be empty if no approvals were requested)

## Interactive prompts

### Applying ChangeSets
For each op where `requiresApproval: true`, the CLI must display:
- op id, tool, operation, risk
- reason (if provided)
- expected impact (if provided)
- rollback hint (if provided)
- evidence references (if provided)

Prompt:
- `Approve this operation? (y/n) `

If rejected, the CLI must:
- record a rejection entry in `approvals.json`
- skip the op
- continue to the next op

If `--fail-on-reject` is set, the CLI must exit non-zero if any op is rejected.

### Sensitive reads exceeding caps (Drive exports/downloads)
If a run would exceed caps (e.g. `maxDownloads`, `maxFileSizeMB`):
- prompt: `This run will download/export N files (~X MB). Continue? (y/n) `
- record the decision in `logs.jsonl` (no private URLs)

## Exit codes
`mar21` uses conventional Unix exit codes:
- `0` success
- `2` invalid usage (unknown command, missing required arg)
- `10` workspace not found / invalid workspace
- `11` schema validation failed (context/request/changeset)
- `20` connector auth missing or invalid
- `21` connector rate-limited beyond retry budget
- `30` apply failed (partial apply possible; see stdout/logs)

If an apply is partial:
- exit `30`
- include per-op results in `logs.jsonl` and `--json` output

## `--json` output (run summary)
When `--json` is set, stdout must include a single JSON object:
```json
{
  "runId": "2026-03-11T101530Z_weekly_review",
  "workspace": "acme",
  "workflowId": "weekly_review",
  "mode": "supervised",
  "paths": {
    "runDir": "workspaces/acme/runs/2026-03-11T101530Z_weekly_review",
    "changeset": "workspaces/acme/runs/2026-03-11T101530Z_weekly_review/changeset.yaml"
  }
}
```

## Autopilot (v0.1 behavior)
In v0.1, `mar21 autopilot start` is a **foreground-only loop runner**:
- It loads `workspaces/<ws>/profiles/<profileId>.yaml` and executes all steps immediately (one run per step).
- It then sleeps and repeats. The sleep interval is a heuristic derived from `profileId`:
  - `daily` → 24h
  - `weekly` → 7d
  - `monthly` → 30d
  - otherwise → 24h
- Background/daemon mode is not implemented in v0.1.
