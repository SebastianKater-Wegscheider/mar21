export type Mode = "advisory" | "supervised" | "autonomous";

export type SkillManifest = {
  apiVersion: "mar21/skill-v1";
  id: string;
  domain: string;
  description: string;
  inputs: { schema: Record<string, unknown> };
  outputs: { schema: Record<string, unknown> };
  usesConnectors: string[];
  risk: { level: "none" | "low" | "medium" | "high"; writes: boolean };
  artifacts: { produces: string[] };
  idempotency: { strategy: "pure" | "snapshot_based" | "tool_write" };
};

export type SkillDefinition = {
  manifestPath: string;
  dir: string;
  manifest: SkillManifest;
};

export type SkillStep = {
  skillId: string;
  inputs?: Record<string, unknown>;
};

export type RunContext = {
  repoRoot: string;
  workspaceId: string;
  workspaceRoot: string;
  runId: string;
  runDir: string;
  inputsDir: string;
  outputsDir: string;
  evidenceDir: string;
  mode: Mode;
  since: string;
  dryRun: boolean;
  context: unknown;
  request: unknown;
  writeText: (relativePath: string, content: string) => void;
  writeJson: (relativePath: string, data: unknown) => void;
  writeYaml: (relativePath: string, data: unknown) => void;
  exists: (relativePath: string) => boolean;
  log: (event: Record<string, unknown>) => void;
  confirmSensitiveRead: (args: {
    kind: "gdrive_download" | "gdrive_export" | "mcp_call";
    count: number;
    approxMB: number;
    reason: string;
  }) => Promise<boolean>;
};

export type SkillExecutionResult = {
  skillId: string;
  outputs: unknown;
  artifacts: string[];
  ops: Array<Record<string, unknown>>;
};
