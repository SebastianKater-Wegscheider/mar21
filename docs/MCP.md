# MCP-First (`mar21`) — Pluggable Tooling, You in Control

`mar21` is **MCP-first**: it prefers integrating external systems through **Model Context Protocol (MCP)** servers rather than maintaining bespoke connector code for every platform.

This unlocks the core goal: a one-person marketing cockpit where your agent can “bring its own tools” and still remain **auditable, supervised, and evidence-based**.

## Why MCP-first
- **Speed:** adopt new platforms by adding an MCP server (no mar21 release required).
- **Portability:** workflows target stable artifacts + capability intent; servers are interchangeable.
- **Control:** `mar21` still owns approvals, caps, evidence retention, and audit trails.

## What “pluggable” means in practice
1) You can add a new MCP server to a workspace at any time:
   - `workspaces/<ws>/_cfg/mcp-servers.yaml`
2) `mar21` can discover what that server provides (tools) at runtime.
3) Workflows/skills can use those tools in supervised mode and still produce:
   - `runs/<id>/outputs/evidence/*`
   - `runs/<id>/outputs/research_pack.md` with `[S#]` citations

## Config surface (v0.1)
- File: `workspaces/<ws>/_cfg/mcp-servers.yaml`
- Schema: `schemas/mcp-servers.schema.json` (`urn:mar21:schema:mcp-servers:v1`)
- Transports:
  - `stdio` (supported in v0.1 for `mar21 mcp *`)
  - `http` (reserved; not yet implemented)

## CLI
Use these for “bring your own server” debugging:
- `mar21 mcp doctor --workspace <id>`: schema validation + basic sanity checks
- `mar21 mcp tools --workspace <id> --server <serverId>`: list tools (stdio only)
- `mar21 mcp call --workspace <id> --server <serverId> --tool <toolName> --input <json>`: call tool (stdio only)
- `mar21 mcp scaffold-mapping --workspace <id> --server <serverId>`: generate a starter `capabilities:` mapping

## Using MCP inside runs (v0.1: deep research sources)
`deep_research_sparring` can ingest MCP tool outputs as private evidence when you provide selectors in `--request`:

```yaml
params:
  research:
    sources:
      mcpLimits:
        maxCalls: 10
      mcp:
        - title: "Slack: competitor mentions"
          serverId: slack
          capabilityId: slack.read.messages.search
          input:
            query: "competitor name"
```

Outputs:
- `outputs/evidence/mcp_sources.json`
- `outputs/evidence/mcp_*.md` excerpts (redacted)
- `outputs/research_pack.md` with `[S#]` citations like `mcp:server:slack:tool:<toolName>`

## Capability mapping (recommended)
To let `mar21` workflows call MCP tools **without hard-coding server-specific tool names**, you can map stable capability ids to tool names in `mcp-servers.yaml`:

```yaml
servers:
  - id: slack
    transport: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-slack"]
    capabilities:
      - capabilityId: slack.write.message.post
        toolName: post_message
```

If you later switch MCP servers, you can keep workflows stable by updating only these mappings.

## Safety boundaries (non-negotiable)
Even when using MCP:
- evidence pulls are **metadata-first**
- raw bytes are **cache-only** by default for private sources
- prompts/outputs must cite sources (`drive:fileId:<id>`, URLs, etc.)
- sensitive reads/writes require interactive approvals (supervised-by-default)
