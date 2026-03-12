# Workspaces (local)

`mar21` workspaces live under `workspaces/<workspaceId>/` and contain local context, runs, cache snapshots, and secrets.

By default, `workspaces/*` is ignored by git to prevent accidental commits of private data.

Create one:
```bash
mar21 init --workspace acme
```

