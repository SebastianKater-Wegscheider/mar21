export const MAR21 = {
  name: "mar21",
  version: "0.1.0"
} as const;

export type { Mode, RunContext, SkillExecutionResult, SkillManifest, SkillStep } from "./skills/types.js";
export { discoverSkills, executeSkillPipeline } from "./skills/runner.js";
