#!/usr/bin/env node
import { Command } from "commander";
import process from "node:process";
import { validateExamples } from "./validate.js";

const program = new Command();

program
  .name("mar21")
  .description("AI-native Marketing Operating System (boilerplate)")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a workspace skeleton (v0.1: stub)")
  .option("--workspace <id>", "Workspace id")
  .option("--force", "Overwrite if exists", false)
  .action(() => {
    console.log("mar21 init: not implemented yet (see docs/SPECS.md).");
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
  .description("Run a workflow in planning mode (v0.1: stub)")
  .argument("<workflowId>", "Workflow id")
  .action((workflowId: string) => {
    console.log(`mar21 plan ${workflowId}: not implemented yet (see docs/WORKFLOWS.md).`);
  });

program
  .command("apply")
  .description("Apply a run changeset (v0.1: stub)")
  .argument("<runId>", "Run id")
  .action((runId: string) => {
    console.log(`mar21 apply ${runId}: not implemented yet (see docs/SPECS.md).`);
  });

program.parse(process.argv);
