import type { MiddlewareHandler } from "hono";
import { parseConfig, type AppConfig } from "../config";
import { readCookie, readSession, SESSION_COOKIE } from "./session";

export interface AppUser {
  email: string;
  name?: string;
  /** "dev" = local bypass (development without Google configured). */
  mode: "google" | "dev";
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

/** Authentication gate for the whole Worker (API + pages). Fails closed in production. */
export function authGate(): MiddlewareHandler<{ Bindings: object; Variables: AuthVariables }> {
  return async (c, next) => {
    const cfg = parseConfig(c.env);
    c.set("cfg", cfg);
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
