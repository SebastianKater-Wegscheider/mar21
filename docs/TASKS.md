# mar21 Tasks (Human Work as First-Class Ops)

Marketing execution is not only API calls. A lot of value creation is still human work:
- PR pitches
- partner outreach
- creative production (design/video)
- stakeholder reviews
- instrumentation fixes

`mar21` treats this work as **trackable**, **reviewable**, and **loop-closable** by encoding it as tasks and referencing it from ChangeSets and run artifacts.

## Goals
- Make GTM and distribution plans executable end-to-end (not just “recommendations”).
- Keep human work in the same audit trail as tool ops (Plan/Report/ChangeSet/Runs).
- Enable autopilot to generate tasks safely (supervised), and allow operators to close the loop.

## Storage: `todos.yaml` (v1)
In v1, tasks live in a workspace-local file:
- `workspaces/<workspace>/todos.yaml`

Schema:
- `schemas/todos.schema.json` (`urn:mar21:schema:todos:v1`)

This file is the single source of truth for task status.

## Task model
Each task must include:
- `taskId` (stable id)
- `title` (short)
- `description` (optional; should not contain PII)
- `status`: `open|in_progress|blocked|done|canceled`
- `owner` (string, usually “operator” for one-person marketing)
- `dueDate` (ISO date, optional)
- `priority`: `p0|p1|p2|p3`
- `tags` (e.g. `pr`, `partner`, `creative`, `instrumentation`)
- `createdAt` (ISO datetime)
- provenance:
  - `createdBy.runId`
  - `createdBy.opId` (ChangeSet op that created it)
- `evidenceRef` (optional list of run-relative evidence paths)

### Task id format
Tasks should be filesystem-safe and sortable:

`T-<YYYYMMDD>-<NNN>`

Example:
- `T-20260312-001`

If a runner cannot guarantee sequencing, it may generate:
- `T-<YYYYMMDD>-<HHMMSS>-<rand>`

## ChangeSet ops for tasks (v1)
Tasks are created/updated/closed via ChangeSet ops with `tool: mar21`.

### `mar21.todo.create`
Creates a new task in `todos.yaml`.

Example op:
```yaml
- id: todo_pr_pitch_01
  tool: mar21
  operation: mar21.todo.create
  risk: low
  requiresApproval: true
  params:
    task:
      title: "Pitch 5 category reporters (auditability angle)"
      description: "Use research pack findings [S1]/[S2]. Draft email. Track replies."
      owner: "operator"
      dueDate: "2026-03-15"
      priority: p1
      tags: ["pr", "distribution"]
      evidenceRef:
        - "outputs/research_pack.md"
```

### `mar21.todo.update`
Updates fields on an existing task (e.g. owner, dueDate, status, notes).

Example:
```yaml
- id: todo_update_01
  tool: mar21
  operation: mar21.todo.update
  risk: low
  requiresApproval: true
  params:
    taskId: "T-20260312-001"
    patch:
      status: in_progress
```

### `mar21.todo.close`
Closes a task as `done` or `canceled` with an optional outcome note.

Example:
```yaml
- id: todo_close_01
  tool: mar21
  operation: mar21.todo.close
  risk: low
  requiresApproval: true
  params:
    taskId: "T-20260312-001"
    status: done
    outcome: "2 replies, 1 interview scheduled. Added learning to memory."
    evidenceRef:
      - "outputs/evidence/pr_outreach_log.csv"
```

## How tasks appear in run artifacts
When tasks are created/updated/closed, the run should:
- reference tasks in `outputs/plan.md` (“Tasks (this week)” section)
- include task ids in `outputs/report.md` (“What we did” / “What we’ll do”)
- include ChangeSet ops for task mutations

## Privacy (GDPR-first)
- Avoid PII in task descriptions and outcome notes.
- Store contact lists or sensitive outreach details only as redacted evidence, or keep them outside `runs/`.

## Future (connectors)
Later, tasks can be backed by external systems:
- Linear/Jira/Asana/Trello

When that happens:
- `todos.yaml` can remain a local cache, or
- the external system becomes the source of truth and `todos.yaml` becomes derived.

