import fs from "node:fs";
import path from "node:path";
import { readYamlFile } from "./workspace.js";

export type ProfileStep = {
  workflowId: string;
  mode: "advisory" | "supervised" | "autonomous";
  since?: string;
};

export type Profile = {
  apiVersion: "mar21/profile-v1";
  id: string;
  steps: ProfileStep[];
};

export function loadProfile(profilePath: string): Profile {
  if (!fs.existsSync(profilePath)) {
    const err = new Error(`profile not found: ${profilePath}`);
    (err as Error & { exitCode?: number }).exitCode = 10;
    throw err;
  }
  const doc = readYamlFile(profilePath) as any;
  if (!doc || doc.apiVersion !== "mar21/profile-v1" || !Array.isArray(doc.steps)) {
    const err = new Error(`invalid profile file: ${profilePath}`);
    (err as Error & { exitCode?: number }).exitCode = 11;
    throw err;
  }
  const steps = (doc.steps as any[]).map((s) => ({
    workflowId: String(s.workflowId ?? "").trim(),
    mode: s.mode as ProfileStep["mode"],
    since: s.since ? String(s.since) : undefined
  }));
  if (!steps.length || steps.some((s) => !s.workflowId)) {
    const err = new Error(`profile has no valid steps: ${profilePath}`);
    (err as Error & { exitCode?: number }).exitCode = 11;
    throw err;
  }
  return { apiVersion: "mar21/profile-v1", id: String(doc.id ?? ""), steps };
}

export function profilePathFor(wsRoot: string, profileId: string): string {
  return path.join(wsRoot, "profiles", `${profileId}.yaml`);
}

