import Ajv2020Import from "ajv/dist/2020.js";
import addFormatsImport from "ajv-formats";
import type { ErrorObject } from "ajv";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import YAML from "yaml";

type ValidateResult = { ok: true } | { ok: false; errors: string[] };

type Ajv2020Class = typeof import("ajv/dist/2020.js").default;
type Ajv2020Instance = InstanceType<Ajv2020Class>;

const Ajv2020 = Ajv2020Import as unknown as Ajv2020Class;
const addFormats = ((addFormatsImport as unknown as { default?: unknown }).default ??
  addFormatsImport) as unknown as (ajv: Ajv2020Instance) => void;

function findRepoRootFromCwd(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 25; i += 1) {
    const schemaDir = path.join(dir, "schemas");
    const examplesDir = path.join(dir, "examples");
    if (fs.existsSync(schemaDir) && fs.existsSync(examplesDir)) return dir;

    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function loadJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function loadYamlFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, "utf-8");
  return YAML.parse(raw);
}

function buildAjv(schemaDir: string): Ajv2020Instance {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false
  });
  addFormats(ajv);

  for (const entry of fs.readdirSync(schemaDir)) {
    if (!entry.endsWith(".json")) continue;
    const schemaPath = path.join(schemaDir, entry);
    const schema = loadJsonFile(schemaPath) as any;
    ajv.addSchema(schema);
  }

  return ajv;
}

function schemaForExampleFilename(filename: string): string | null {
  const map: Record<string, string> = {
    "marketing-context.yaml": "urn:mar21:schema:marketing-context:v1",
    "request.yaml": "urn:mar21:schema:request:v1",
    "changeset.yaml": "urn:mar21:schema:changeset:v1",
    "run.json": "urn:mar21:schema:run:v1",
    "skill.yaml": "urn:mar21:schema:skill:v1",
    "profile.yaml": "urn:mar21:schema:profile:v1",
    "connector.yaml": "urn:mar21:schema:connector:v1",
    "evidence.json": "urn:mar21:schema:evidence:v1",
    "todos.yaml": "urn:mar21:schema:todos:v1",
    "creative-brief.yaml": "urn:mar21:schema:creative-brief:v1",
    "asset-manifest.yaml": "urn:mar21:schema:asset-manifest:v1",
    "distribution-plan.yaml": "urn:mar21:schema:distribution-plan:v1",
    "repurpose-map.yaml": "urn:mar21:schema:repurpose-map:v1"
  };
  return map[filename] ?? null;
}

function validateOne(ajv: Ajv2020Instance, schemaId: string, filePath: string): ValidateResult {
  const validate = ajv.getSchema(schemaId);
  if (!validate) {
    return { ok: false, errors: [`schema not found: ${schemaId}`] };
  }

  const ext = path.extname(filePath).toLowerCase();
  let instance: unknown;
  if (ext === ".json") instance = loadJsonFile(filePath);
  else instance = loadYamlFile(filePath);

  const ok = validate(instance);
  if (ok) return { ok: true };

  const errors =
    validate.errors?.map((e: ErrorObject) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`) ??
    ["invalid"];
  return { ok: false, errors };
}

export function validateExamples(): number {
  const repoRoot = findRepoRootFromCwd();
  if (!repoRoot) {
    console.error("could not find repo root (expected ./schemas and ./examples in cwd or parents)");
    return 11;
  }
  const schemaDir = path.join(repoRoot, "schemas");
  const examplesDir = path.join(repoRoot, "examples");

  if (!fs.existsSync(schemaDir)) {
    console.error(`schemas/ not found at: ${schemaDir}`);
    return 11;
  }
  if (!fs.existsSync(examplesDir)) {
    console.error(`examples/ not found at: ${examplesDir}`);
    return 11;
  }

  const ajv = buildAjv(schemaDir);

  let failures = 0;
  for (const entry of fs.readdirSync(examplesDir)) {
    const schemaId = schemaForExampleFilename(entry);
    if (!schemaId) continue;

    const filePath = path.join(examplesDir, entry);
    const res = validateOne(ajv, schemaId, filePath);
    if (res.ok) continue;

    failures += 1;
    console.error(`✗ ${path.relative(process.cwd(), filePath)}`);
    for (const err of res.errors) console.error(`  - ${err}`);
  }

  if (failures === 0) {
    console.log("✓ examples/ validate against schemas/");
    return 0;
  }

  console.error(`\n${failures} file(s) failed validation.`);
  return 11;
}
