import { fetchWithRetry } from "../runtime/retry.js";
import { dateRangeFromSinceDays, parseSinceDurationDays } from "./dates.js";

export type GscSearchAnalyticsQueryArgs = {
  accessToken: string;
  siteUrl: string;
  since: string; // ISO 8601 duration; v0.1 supports PnD
  dimensions: Array<"query" | "page" | "country" | "device">;
  rowLimit?: number;
};

export async function gscSearchAnalyticsQuery(args: GscSearchAnalyticsQueryArgs): Promise<unknown> {
  const sinceDays = parseSinceDurationDays(args.since);
  const { startDate, endDate } = dateRangeFromSinceDays(sinceDays);

  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    args.siteUrl
  )}/searchAnalytics/query`;

  const body = {
    startDate,
    endDate,
    dimensions: args.dimensions,
    rowLimit: args.rowLimit ?? 250
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
    const err = new Error(`gsc query failed: ${res.status} ${raw}`) as Error & { exitCode?: number };
    err.exitCode = 20;
    throw err;
  }
  return JSON.parse(raw) as unknown;
}

