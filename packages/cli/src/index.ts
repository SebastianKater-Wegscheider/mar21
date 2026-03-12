#!/usr/bin/env node
import { Command } from "commander";
import process from "node:process";
import { applyRunChangeset } from "./apply-engine.js";
import { autopilotStart } from "./autopilot.js";
import { initWorkspace } from "./init.js";
import { mcpCall, mcpDoctor, mcpScaffoldMapping, mcpTools } from "./mcp.js";
import { runCadence } from "./run-cadence.js";
import { runAnalyze, runPlan, runReport } from "./run-engine.js";
import { runSession } from "./session.js";
import { showArtifact } from "./show.js";
import { validateExamples } from "./validate.js";

process.on("uncaughtException", (err) => {
  const exitCode = (err as Error & { exitCode?: number }).exitCode;
  if (exitCode) {
    console.error((err as Error).message);
    process.exit(exitCode);
  }
  throw err;
});

process.on("unhandledRejection", (err) => {
  const exitCode = (err as Error & { exitCode?: number }).exitCode;
  if (exitCode) {
    console.error((err as Error).message);
    process.exit(exitCode);
  }
  throw err;
});

const program = new Command();

async function writeStdoutLine(line: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(line.endsWith("\n") ? line : `${line}\n`, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

program
  .name("mar21")
  .description("Marketing boilerplate for the 21st century (agentic, you in control)")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a workspace skeleton (v0.1)")
  .option("--workspace <id>", "Workspace id")
  .option(
    "--stack <preset>",
    "Stack preset (default: default). Examples: default, content_engine, paid_growth, lifecycle"
  )
  .option(
    "--connectors <list>",
    "Comma-separated connector ids (overrides --stack), e.g. gsc,ga4,wordpress,slack,gdrive,ahrefs"
  )
  .option("--force", "Overwrite if exists", false)
  .action(
    (opts: { workspace?: string; stack?: string; connectors?: string; force?: boolean }) => {
      const res = initWorkspace({
        workspace: opts.workspace,
        stack: opts.stack,
        connectors: opts.connectors,
        force: opts.force
      });
      console.log(`✓ workspace initialized: ${res.workspace} (${res.root})`);
    }
  );

program
  .command("session")
  .alias("start")
  .description("Run a guided marketer-mode session (v0.1)")
  .option("--workspace <id>", "Workspace id (will prompt if omitted)")
  .option("--since <duration>", "ISO 8601 duration, e.g. P7D or P28D", undefined)
  .option("--mode <mode>", "advisory|supervised|autonomous", undefined)
  .action(async (opts: { workspace?: string; since?: string; mode?: string }) => {
    const mode =
      opts.mode === "advisory" || opts.mode === "supervised" || opts.mode === "autonomous"
        ? opts.mode
        : undefined;
    await runSession({ workspace: opts.workspace, since: opts.since, mode });
  });

program
  .command("show")
  .description("Print an artifact to stdout (marketer-friendly)")
  .argument("<runId>", "Run id, or 'latest'")
  .argument("<artifact>", "research_pack|report|plan|decision_log|changeset|todos|context|creative_brief")
  .option("--workspace <id>", "Workspace id")
  .action((runId: string, artifact: string, opts: { workspace?: string }) => {
    process.exit(showArtifact({ workspace: opts.workspace, runId, artifact }));
  });

program
  .command("validate")
  .description("Validate artifacts against schemas (v0.1)")
  .option("--examples", "Validate examples/", false)
  .action((opts: { examples?: boolean }) => {
    if (opts.examples) process.exit(validateExamples());
    console.log("Nothing to validate. Use --examples for now.");
  });

program
  .command("mcp")
  .description("MCP utilities (v0.1: stdio transport)")
  .addCommand(
    new Command("doctor")
      .description("Validate workspace MCP server config")
      .option("--workspace <id>", "Workspace id")
      .option("--json", "Print machine-readable output", false)
      .action(async (opts: { workspace?: string; json?: boolean }) => {
        await mcpDoctor({ workspace: opts.workspace, json: Boolean(opts.json) });
      })
  )
  .addCommand(
    new Command("tools")
      .description("List tools exposed by an MCP server (stdio)")
      .requiredOption("--server <id>", "Server id from _cfg/mcp-servers.yaml")
      .option("--workspace <id>", "Workspace id")
      .option("--json", "Print machine-readable output", false)
      .action(async (opts: { workspace?: string; server?: string; json?: boolean }) => {
        await mcpTools({ workspace: opts.workspace, serverId: String(opts.server), json: Boolean(opts.json) });
      })
  )
  .addCommand(
    new Command("call")
      .description("Call an MCP tool (stdio)")
      .requiredOption("--server <id>", "Server id from _cfg/mcp-servers.yaml")
      .requiredOption("--tool <name>", "Tool name")
      .requiredOption("--input <json>", "JSON string for tool input (use '{}' for empty)")
      .option("--workspace <id>", "Workspace id")
      .option("--json", "Pretty printing off (useful for piping)", false)
      .action(
        async (opts: { workspace?: string; server?: string; tool?: string; input?: string; json?: boolean }) => {
          await mcpCall({
            workspace: opts.workspace,
            serverId: String(opts.server),
            tool: String(opts.tool),
            input: String(opts.input),
            json: Boolean(opts.json)
          });
        }
      )
  )
  .addCommand(
    new Command("scaffold-mapping")
      .description("Scaffold capabilityId mappings from discovered MCP tool names")
      .requiredOption("--server <id>", "Server id from _cfg/mcp-servers.yaml")
      .option("--workspace <id>", "Workspace id")
      .option("--apply", "Write mappings into _cfg/mcp-servers.yaml (rewrites YAML)", false)
      .option("--force", "Overwrite existing capabilities when used with --apply", false)
      .option("--json", "Print machine-readable output", false)
      .action(async (opts: { workspace?: string; server?: string; apply?: boolean; force?: boolean; json?: boolean }) => {
        await mcpScaffoldMapping({
          workspace: opts.workspace,
          serverId: String(opts.server),
          apply: Boolean(opts.apply),
          force: Boolean(opts.force),
          json: Boolean(opts.json)
        });
      })
  );

program
  .command("plan")
  .description("Run a workflow in planning mode (v0.1: artifacts-only)")
  .argument("<workflowId>", "Workflow id")
  .option("--workspace <id>", "Workspace id")
  .option("--mode <mode>", "advisory|supervised|autonomous")
  .option("--since <duration>", "ISO 8601 duration, e.g. P7D or P28D")
  .option("--request <path>", "YAML request patch file (merged into params.*)", undefined)
  .option("--dry-run", "Never apply writes (still produces ChangeSet)", false)
  .option("--json", "Print machine-readable run summary", false)
  .action(
    async (
      workflowId: string,
      opts: {
        workspace?: string;
        mode?: string;
        since?: string;
        request?: string;
        dryRun?: boolean;
        json?: boolean;
      }
    ) => {
    const mode =
      opts.mode === "advisory" || opts.mode === "supervised" || opts.mode === "autonomous"
        ? opts.mode
        : undefined;
      const summary = await runPlan(workflowId, {
        workspace: opts.workspace,
        mode,
        since: opts.since,
        requestPath: opts.request,
        dryRun: Boolean(opts.dryRun),
        json: Boolean(opts.json)
      });

    if (opts.json) {
      await writeStdoutLine(JSON.stringify(summary));
      return;
    }
    console.log(`✓ run created: ${summary.runId}`);
    console.log(`  - ${summary.paths.runDir}`);
    }
  );

program
  .command("analyze")
  .description("Run an analysis scope (v0.1: artifacts-only)")
  .argument("<scope>", "Scope (e.g. seo, ads, crm)")
  .option("--workspace <id>", "Workspace id")
  .option("--mode <mode>", "advisory|supervised|autonomous")
  .option("--since <duration>", "ISO 8601 duration, e.g. P7D or P28D")
  .option("--dry-run", "Never apply writes (still produces ChangeSet)", false)
  .option("--json", "Print machine-readable run summary", false)
  .action(
    async (
      scope: string,
      opts: {
        workspace?: string;
        mode?: string;
        since?: string;
        dryRun?: boolean;
        json?: boolean;
      }
    ) => {
      const mode =
        opts.mode === "advisory" || opts.mode === "supervised" || opts.mode === "autonomous"
          ? opts.mode
          : undefined;
      const summary = await runAnalyze(scope, {
        workspace: opts.workspace,
        mode,
        since: opts.since,
        dryRun: Boolean(opts.dryRun),
        json: Boolean(opts.json)
      });

      if (opts.json) {
        await writeStdoutLine(JSON.stringify(summary));
        return;
      }
      console.log(`✓ run created: ${summary.runId}`);
      console.log(`  - ${summary.paths.runDir}`);
    }
  );

program
  .command("report")
  .description("Generate a report (v0.1: artifacts-only)")
  .argument("<cadenceOrWorkflowId>", "Cadence (daily|weekly|monthly) or workflowId")
  .option("--workspace <id>", "Workspace id")
  .option("--since <duration>", "ISO 8601 duration, e.g. P7D or P28D")
  .option("--json", "Print machine-readable run summary", false)
  .action(
    async (
      cadenceOrWorkflowId: string,
      opts: {
        workspace?: string;
        since?: string;
        json?: boolean;
      }
    ) => {
      const summary = await runReport(cadenceOrWorkflowId, {
        workspace: opts.workspace,
        since: opts.since,
        json: Boolean(opts.json)
      });

      if (opts.json) {
        await writeStdoutLine(JSON.stringify(summary));
        return;
      }
      console.log(`✓ run created: ${summary.runId}`);
      console.log(`  - ${summary.paths.runDir}`);
    }
  );

program
  .command("run")
  .description("Execute a cadence profile once (v0.1: artifacts-only)")
  .argument("<cadence>", "daily|weekly|monthly")
  .option("--workspace <id>", "Workspace id")
  .option("--profile <profileId>", "Profile id (default: cadence)")
  .option("--mode <mode>", "advisory|supervised|autonomous")
  .option("--since <duration>", "ISO 8601 duration, e.g. P7D or P28D")
  .option("--dry-run", "Never apply writes (still produces ChangeSet)", false)
  .option("--json", "Print machine-readable run summary", false)
  .action(
    async (
      cadence: string,
      opts: {
        workspace?: string;
        profile?: string;
        mode?: string;
        since?: string;
        dryRun?: boolean;
        json?: boolean;
      }
    ) => {
      const c = cadence.trim();
      if (c !== "daily" && c !== "weekly" && c !== "monthly") {
        const err = new Error(`invalid cadence: ${cadence} (expected daily|weekly|monthly)`);
        (err as Error & { exitCode?: number }).exitCode = 2;
        throw err;
      }

      const mode =
        opts.mode === "advisory" || opts.mode === "supervised" || opts.mode === "autonomous"
          ? opts.mode
          : undefined;
      const summary = await runCadence({
        cadence: c,
        workspace: opts.workspace,
        profile: opts.profile,
        mode,
        since: opts.since,
        dryRun: Boolean(opts.dryRun)
      });

      if (opts.json) {
        await writeStdoutLine(JSON.stringify(summary));
        return;
      }

      console.log(`✓ cadence run: ${summary.cadence} (${summary.profileId})`);
      for (const r of summary.runs) console.log(`  - ${r.runId}`);
    }
  );

program
  .command("autopilot")
  .description("Run a scheduled loop (v0.1: foreground only)")
  .command("start")
  .requiredOption("--profile <profileId>", "Profile id (workspaces/<ws>/profiles/<id>.yaml)")
  .option("--workspace <id>", "Workspace id")
  .option("--mode <mode>", "advisory|supervised|autonomous")
  .option("--dry-run", "Never apply writes (still produces ChangeSet)", false)
  .option("--foreground", "Run in foreground (required in v0.1)", false)
  .action(
    async (opts: { profile: string; workspace?: string; mode?: string; dryRun?: boolean; foreground?: boolean }) => {
      const mode =
        opts.mode === "advisory" || opts.mode === "supervised" || opts.mode === "autonomous"
          ? opts.mode
          : undefined;
      await autopilotStart({
        workspace: opts.workspace,
        profileId: opts.profile,
        mode,
        dryRun: Boolean(opts.dryRun),
        foreground: Boolean(opts.foreground)
      });
    }
  );

program
  .command("apply")
  .description("Apply a run changeset (v0.1: internal ops only)")
  .argument("<runId>", "Run id")
  .option("--workspace <id>", "Workspace id")
  .option("--yes", "Auto-approve all required approvals", false)
  .option("--fail-on-reject", "Exit non-zero if any op is rejected", false)
  .option("--json", "Print machine-readable apply summary", false)
  .action(
    async (
      runId: string,
      opts: {
        workspace?: string;
        yes?: boolean;
        failOnReject?: boolean;
        json?: boolean;
      }
    ) => {
      const { summary, exitCode } = await applyRunChangeset({
        workspace: opts.workspace,
        runId,
        yes: Boolean(opts.yes),
        json: Boolean(opts.json),
        failOnReject: Boolean(opts.failOnReject)
      });

      if (opts.json) {
        await writeStdoutLine(JSON.stringify(summary));
        process.exitCode = exitCode;
        return;
      }

      const failed = summary.results.filter((r) => r.status === "failed");
      const skipped = summary.results.filter((r) => r.status === "skipped");
      const rejected = summary.results.filter((r) => r.status === "rejected");
      console.log(`✓ apply finished: ${summary.runId}`);
      if (failed.length) console.log(`  - failed ops: ${failed.length}`);
      if (skipped.length) console.log(`  - skipped ops: ${skipped.length}`);
      if (rejected.length) console.log(`  - rejected ops: ${rejected.length}`);
      process.exitCode = exitCode;
    }
  );

await program.parseAsync(process.argv);
