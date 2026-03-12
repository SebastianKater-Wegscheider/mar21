import { fetchWithRetry } from "../runtime/retry.js";
import { dateRangeFromSinceDays, parseSinceDurationDays } from "./dates.js";

export type Ga4RunReportArgs = {
  accessToken: string;
  propertyId: string;
  since: string; // ISO 8601 duration; v0.1 supports PnD
  dimensions: string[];
  metrics: string[];
  limit?: number;
};

export async function ga4RunReport(args: Ga4RunReportArgs): Promise<unknown> {
  const sinceDays = parseSinceDurationDays(args.since);
  const { startDate, endDate } = dateRangeFromSinceDays(sinceDays);

  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(
    args.propertyId
  )}:runReport`;

  const body = {
    dateRanges: [{ startDate, endDate }],
    dimensions: args.dimensions.map((name) => ({ name })),
    metrics: args.metrics.map((name) => ({ name })),
    limit: String(args.limit ?? 1000)
  };

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const raw = await res.text();
  if (!res.ok) {
    const err = new Error(`ga4 runReport failed: ${res.status} ${raw}`) as Error & { exitCode?: number };
    err.exitCode = 20;
    throw err;
  }
  return JSON.parse(raw) as unknown;
}

