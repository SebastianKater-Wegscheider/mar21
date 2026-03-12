import fs from "node:fs";
import path from "node:path";
import process from "node:process";

export function resolveRepoRoot(startDir: string = process.cwd()): string {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 25; i += 1) {
    const marker = path.join(dir, "pnpm-workspace.yaml");
    const pkg = path.join(dir, "package.json");
    const packagesDir = path.join(dir, "packages");
    const workspacesDir = path.join(dir, "workspaces");
    if (fs.existsSync(marker) && fs.existsSync(pkg) && fs.existsSync(packagesDir) && fs.existsSync(workspacesDir)) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return path.resolve(startDir);
}

