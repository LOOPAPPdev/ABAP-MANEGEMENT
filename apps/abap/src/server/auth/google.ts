/**
 * Google OAuth 2.0 (authorization code + PKCE) and Sheets API v4 read client.
 * `fetch` is injectable for tests.
 */
import { b64url, fromB64url, sha256b64url } from "./crypto";

export const SCOPE_LOGIN = "openid email profile";
export const SCOPE_SHEETS = "https://www.googleapis.com/auth/spreadsheets.readonly";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type Fetch = typeof fetch;

export class GoogleError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function buildAuthUrl(p: {
  clientId: string;
  redirectUri: string;
  state: string;
  verifier: string;
  scope: string;
  offline: boolean;
  loginHint?: string;
}): Promise<string> {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: p.scope,
    state: p.state,
    code_challenge: await sha256b64url(p.verifier),
    code_challenge_method: "S256",
    include_granted_scopes: "true",
    prompt: p.offline ? "consent" : "select_account",
  });
  if (p.offline) q.set("access_type", "offline");
  if (p.loginHint) q.set("login_hint", p.loginHint);
  return `${AUTH_URL}?${q}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

async function tokenRequest(body: Record<string, string>, f: Fetch): Promise<TokenResponse> {
  const res = await f(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new GoogleError(`token endpoint: ${String(json.error ?? res.status)}`, res.status, String(json.error ?? ""));
  return json as unknown as TokenResponse;
}

export function exchangeCode(p: { code: string; verifier: string; redirectUri: string; clientId: string; clientSecret: string }, f: Fetch = fetch) {
  return tokenRequest(
    { grant_type: "authorization_code", code: p.code, code_verifier: p.verifier, redirect_uri: p.redirectUri, client_id: p.clientId, client_secret: p.clientSecret },
    f,
  );
}

export async function refreshAccessToken(p: { refreshToken: string; clientId: string; clientSecret: string }, f: Fetch = fetch): Promise<string> {
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: p.refreshToken, client_id: p.clientId, client_secret: p.clientSecret }, f);
  return t.access_token;
}

/**
 * Reads the identity claims of an ID token. The token comes straight from Google's token endpoint
 * over TLS in the code flow, so the transport authenticates the issuer (OpenID Connect Core §3.1.3.7);
 * we still check issuer, audience and expiry.
 */
export function readIdToken(idToken: string, clientId: string, now = Date.now()): { email: string; emailVerified: boolean; name?: string } {
  const [, payload] = idToken.split(".");
  if (!payload) throw new GoogleError("malformed id_token");
  const c = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Record<string, unknown>;
  if (c.iss !== "https://accounts.google.com" && c.iss !== "accounts.google.com") throw new GoogleError("id_token issuer");
  if (c.aud !== clientId) throw new GoogleError("id_token audience");
  if (typeof c.exp !== "number" || c.exp * 1000 < now) throw new GoogleError("id_token expired");
  if (typeof c.email !== "string") throw new GoogleError("id_token without email");
  return { email: c.email.toLowerCase(), emailVerified: c.email_verified === true, name: typeof c.name === "string" ? c.name : undefined };
}

export async function fetchSheetValues(p: { accessToken: string; spreadsheetId: string; range: string }, f: Fetch = fetch): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(p.spreadsheetId)}/values/${encodeURIComponent(p.range)}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`;
  const res = await f(url, { headers: { authorization: `Bearer ${p.accessToken}` } });
  const json = (await res.json().catch(() => ({}))) as { values?: string[][]; error?: { message?: string; status?: string } };
  if (!res.ok) throw new GoogleError(`Sheets API: ${json.error?.status ?? res.status} ${json.error?.message ?? ""}`.trim(), res.status, json.error?.status);
  return json.values ?? [];
}

/** Test helper: builds an unsigned ID token with the given claims. */
export function fakeIdToken(claims: Record<string, unknown>): string {
  const part = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  return `${part({ alg: "none" })}.${part(claims)}.`;
}
