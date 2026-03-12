export function requireEnv(name: string): string {
  const v = process.env[name];
  if (v && v.trim().length > 0) return v.trim();
  const err = new Error(`missing required env var: ${name}`) as Error & { exitCode?: number };
  err.exitCode = 20;
  throw err;
}

