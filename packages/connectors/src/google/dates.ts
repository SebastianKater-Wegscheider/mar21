function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function utcDateYYYYMMDD(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function parseSinceDurationDays(since: string): number {
  const m = /^P(\d+)D$/i.exec(since.trim());
  if (!m) {
    const err = new Error(`unsupported --since duration (expected PnD): ${since}`) as Error & {
      exitCode?: number;
    };
    err.exitCode = 2;
    throw err;
  }
  return Number(m[1]);
}

export function dateRangeFromSinceDays(sinceDays: number): { startDate: string; endDate: string } {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Use "yesterday" endDate to avoid partial-day reporting.
  end.setUTCDate(end.getUTCDate() - 1);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(1, sinceDays - 1));

  return { startDate: utcDateYYYYMMDD(start), endDate: utcDateYYYYMMDD(end) };
}

