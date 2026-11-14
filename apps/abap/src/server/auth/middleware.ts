import type { MiddlewareHandler } from "hono";
import { parseConfig, type AppConfig } from "../config";
import { readCookie, readSession, SESSION_COOKIE } from "./session";

export interface AppUser {
  email: string;
  name?: string;
  /** "dev" = local bypass (development without Google configured); "machine" = ABAP_API_TOKEN (read-only automation). */
  mode: "google" | "dev" | "machine";
}

export type AuthVariables = { user: AppUser | null; cfg: AppConfig };

/** Paths reachable without a session. Everything else requires login. */
const PUBLIC = [/^\/login\/?$/, /^\/auth\//, /^\/api\/v1\/health$/, /^\/assets\//, /^\/favicon\.ico$/, /^\/__manifest/];
export const isPublicPath = (path: string) => PUBLIC.some((r) => r.test(path));

export async function resolveUser(cfg: AppConfig, cookieHeader: string | undefined | null): Promise<AppUser | null> {
  if (cfg.auth === "dev-bypass") return { email: "local-dev", mode: "dev" };
  if (cfg.auth !== "google" || !cfg.sessionSecret) return null;
  const s = await readSession(readCookie(cookieHeader, SESSION_COOKIE), cfg.sessionSecret);
  // The allow-list is checked on every request: removing an e-mail revokes access immediately.
  return s && cfg.allowedEmails.includes(s.email.toLowerCase()) ? { ...s, mode: "google" } : null;
}

/** Read-only endpoints the machine token may call (used by `npm run docs:pull`). */
const MACHINE_ALLOWED = [/^\/api\/v1\/projects\/?$/, /^\/api\/v1\/projects\/[a-z0-9-]+\/?$/, /^\/api\/v1\/projects\/[a-z0-9-]+\/drive\/(export|files)\/?$/, /^\/api\/v1\/projects\/[a-z0-9-]+\/models(\/[A-Z]+-\d{2})?\/?$/];
export const machineMayCall = (method: string, path: string) => method === "GET" && MACHINE_ALLOWED.some((r) => r.test(path));

async function digest(s: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}
/** Constant-time comparison (compares fixed-length digests). */
export async function tokenMatches(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** Authentication gate for the whole Worker (API + pages). Fails closed in production. */
export function authGate(): MiddlewareHandler<{ Bindings: object; Variables: AuthVariables }> {
  return async (c, next) => {
    const cfg = parseConfig(c.env);
    c.set("cfg", cfg);
    const bearer = c.req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (bearer && new URL(c.req.url).pathname.startsWith("/api/")) {
      if (!cfg.apiToken || !(await tokenMatches(bearer, cfg.apiToken))) return c.json({ ok: false, error: "invalid_token" }, 401);
      if (!machineMayCall(c.req.method, new URL(c.req.url).pathname)) return c.json({ ok: false, error: "forbidden_for_token" }, 403);
      c.set("user", { email: "machine:api-token", mode: "machine" });
      return next();
    }
    const user = await resolveUser(cfg, c.req.header("cookie"));
    c.set("user", user);
    const path = new URL(c.req.url).pathname;
    if (isPublicPath(path)) return next();
    const isApi = path.startsWith("/api/");
    if (cfg.auth === "misconfigured") {
      const body = { ok: false, error: "auth_not_configured", missing: cfg.missing };
      return isApi ? c.json(body, 503) : c.redirect("/login?error=not_configured", 302);
    }
    if (!user) {
      if (isApi) return c.json({ ok: false, error: "unauthenticated" }, 401);
      const returnTo = path + new URL(c.req.url).search;
      return c.redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`, 302);
    }
    return next();
  };
}
