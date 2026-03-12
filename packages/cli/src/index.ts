#!/usr/bin/env node
import { Command } from "commander";
import process from "node:process";
import { applyRunChangeset } from "./apply-engine.js";
import { initWorkspace } from "./init.js";
import { runPlan } from "./run-engine.js";
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
  .requiredOption("--workspace <id>", "Workspace id")
  .option("--mode <mode>", "advisory|supervised|autonomous")
  .option("--since <duration>", "ISO 8601 duration, e.g. P7D or P28D")
  .option("--dry-run", "Never apply writes (still produces ChangeSet)", false)
  .option("--json", "Print machine-readable run summary", false)
  .action(
    (
      workflowId: string,
      opts: {
        workspace: string;
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
      process.stdout.write(`${JSON.stringify(summary)}\n`);
      return;
    }
    console.log(`✓ run created: ${summary.runId}`);
    console.log(`  - ${summary.paths.runDir}`);
    }
  );

program
  .command("apply")
  .description("Apply a run changeset (v0.1: internal ops only)")
  .argument("<runId>", "Run id")
  .requiredOption("--workspace <id>", "Workspace id")
  .option("--yes", "Auto-approve all required approvals", false)
  .option("--json", "Print machine-readable apply summary", false)
  .action(
    async (
      runId: string,
      opts: {
        workspace: string;
        yes?: boolean;
        json?: boolean;
      }
    ) => {
      const { summary, exitCode } = await applyRunChangeset({
        workspace: opts.workspace,
        runId,
        yes: Boolean(opts.yes),
        json: Boolean(opts.json)
      });

      if (opts.json) {
        process.stdout.write(`${JSON.stringify(summary)}\n`);
        process.exit(exitCode);
      }

      const failed = summary.results.filter((r) => r.status === "failed");
      const rejected = summary.results.filter((r) => r.status === "rejected");
      console.log(`✓ apply finished: ${summary.runId}`);
      if (failed.length) console.log(`  - failed ops: ${failed.length}`);
      if (rejected.length) console.log(`  - rejected ops: ${rejected.length}`);
      process.exit(exitCode);
    }
  );

program.parse(process.argv);
