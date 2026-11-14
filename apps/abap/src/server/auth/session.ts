import { signJson, verifyJson } from "./crypto";

export const SESSION_COOKIE = "gs_session";
export const OAUTH_COOKIE = "gs_oauth";
export const SESSION_TTL_S = 7 * 24 * 3600;

export interface SessionUser {
  email: string;
  name?: string;
}

interface SessionPayload extends SessionUser {
  exp: number;
}

export interface OAuthState {
  state: string;
  verifier: string;
  purpose: "login" | "sheets";
  returnTo: string;
  exp: number;
}

export function readCookie(header: string | null | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function cookie(name: string, value: string, maxAge: number): string {
  // Secure is honoured on https and on http://localhost by modern browsers.
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export const clearCookie = (name: string) => cookie(name, "", 0);

export async function createSession(user: SessionUser, secret: string, now = Date.now()): Promise<string> {
  return signJson({ ...user, exp: Math.floor(now / 1000) + SESSION_TTL_S } satisfies SessionPayload, secret);
}

export async function readSession(token: string | undefined, secret: string, now = Date.now()): Promise<SessionUser | null> {
  const p = await verifyJson<SessionPayload>(token, secret);
  if (!p || typeof p.email !== "string" || typeof p.exp !== "number" || p.exp * 1000 < now) return null;
  return { email: p.email, name: p.name };
}

/** Only same-site relative paths are allowed as return targets (no open redirect). */
export function safeReturnTo(value: string | null | undefined): string {
  return value && /^\/(?!\/)[^\s\\]*$/.test(value) ? value : "/dashboard";
}
