#!/usr/bin/env node
import { Command } from "commander";
import process from "node:process";
import { applyRunChangeset } from "./apply-engine.js";
import { initWorkspace } from "./init.js";
import { runCadence } from "./run-cadence.js";
import { runAnalyze, runPlan, runReport } from "./run-engine.js";
import { validateExamples } from "./validate.js";

process.on("uncaughtException", (err) => {
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
  .description("AI-native Marketing Operating System (boilerplate)")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a workspace skeleton (v0.1)")
  .option("--workspace <id>", "Workspace id")
  .option("--force", "Overwrite if exists", false)
  .action((opts: { workspace?: string; force?: boolean }) => {
    const res = initWorkspace({ workspace: opts.workspace, force: opts.force });
    console.log(`✓ workspace initialized: ${res.workspace} (${res.root})`);
  });

program
  .command("validate")
  .description("Validate artifacts against schemas (v0.1: stub)")
  .option("--examples", "Validate examples/", false)
  .action((opts: { examples?: boolean }) => {
    if (opts.examples) process.exit(validateExamples());
    console.log("Nothing to validate. Use --examples for now.");
  });

program
  .command("plan")
  .description("Run a workflow in planning mode (v0.1: artifacts-only)")
  .argument("<workflowId>", "Workflow id")
  .option("--workspace <id>", "Workspace id")
  .option("--mode <mode>", "advisory|supervised|autonomous")
  .option("--since <duration>", "ISO 8601 duration, e.g. P7D or P28D")
  .option("--dry-run", "Never apply writes (still produces ChangeSet)", false)
  .option("--json", "Print machine-readable run summary", false)
  .action(
    async (
      workflowId: string,
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
      const summary = runPlan(workflowId, {
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
      const summary = runAnalyze(scope, {
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
      const summary = runReport(cadenceOrWorkflowId, {
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
      const summary = runCadence({
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
