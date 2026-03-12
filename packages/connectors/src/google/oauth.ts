import { fetchWithRetry } from "../runtime/retry.js";

export type GoogleOAuthEnv = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

export async function getGoogleAccessToken(env: GoogleOAuthEnv): Promise<{
  accessToken: string;
  expiresIn: number;
  tokenType: string;
  scope?: string;
}> {
  const body = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    refresh_token: env.refreshToken,
    grant_type: "refresh_token"
  });

  const res = await fetchWithRetry("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });

  const raw = await res.text();
  if (!res.ok) {
    const err = new Error(`google oauth token exchange failed: ${res.status} ${raw}`) as Error & {
      exitCode?: number;
    };
    err.exitCode = 20;
    throw err;
  }

  const parsed = JSON.parse(raw) as GoogleTokenResponse;
  if (!parsed?.access_token) {
    const err = new Error(`google oauth token exchange invalid response: ${raw}`) as Error & {
      exitCode?: number;
    };
    err.exitCode = 20;
    throw err;
  }

  return {
    accessToken: parsed.access_token,
    expiresIn: parsed.expires_in,
    tokenType: parsed.token_type,
    scope: parsed.scope
  };
}

