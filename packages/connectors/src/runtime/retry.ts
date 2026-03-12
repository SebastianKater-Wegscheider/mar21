export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: RetryOptions = {}
): Promise<Response> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const maxDelayMs = opts.maxDelayMs ?? 10_000;

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        if (attempt === maxAttempts) return res;
        const retryAfter = res.headers.get("retry-after");
        const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : NaN;
        const backoff = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
        const delay = Number.isFinite(retryAfterMs) ? Math.min(maxDelayMs, retryAfterMs) : backoff;
        await sleep(delay);
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt === maxAttempts) break;
      const backoff = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
      await sleep(backoff);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

