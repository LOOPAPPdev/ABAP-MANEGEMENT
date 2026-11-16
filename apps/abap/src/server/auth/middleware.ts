import type { MiddlewareHandler } from "hono";
import { parseConfig, type AppConfig } from "../config";
import { guestMayAccess, homeFor, type Access } from "~/domain/studio";
import { TokenService, type TokenRole } from "../tokens";
import { readCookie, readSession, SESSION_COOKIE } from "./session";
import { sha256b64url } from "./crypto";

export interface AppUser {
  email: string;
  name?: string;
  /**
   * "dev" = local bypass (development without Google configured); "machine" = ABAP_API_TOKEN (read-only automation);
   * "token" = personal API token (ADR-009), used by the MCP endpoint.
   */
  mode: "public" | "password" | "dev" | "machine" | "token";
  /** Permission for token callers (MCP tools check it). Sessions and the dev bypass act as "write". */
  role?: TokenRole;
  /** Studio access (ADR-011): staff (ALLOWED_EMAILS) or guest limited to the studio of invited projects. */
  access?: Access;
}

export type AuthVariables = { user: AppUser | null; cfg: AppConfig };

/** Paths reachable without a session. Everything else requires login. */
export const MCP_PATH = "/mcp";
const PUBLIC = [/^\/studio\/raw\//, /^\/login\/?$/, /^\/auth\//, /^\/api\/v1\/health$/, /^\/assets\//, /^\/favicon\.ico$/, /^\/__manifest/];
export const isPublicPath = (path: string) => PUBLIC.some((r) => r.test(path));

export async function resolveUser(cfg: AppConfig, cookieHeader: string | undefined | null, _db?: D1Database): Promise<AppUser | null> {
  if (cfg.auth === "public") return { email: "public@abap.local", name: "Acesso público", mode: "public", access: { kind: "staff" } };
  if (cfg.auth === "dev-bypass") return { email: "local-dev", mode: "dev", access: { kind: "staff" } };
  if (cfg.auth !== "password" || !cfg.sessionSecret) return null;
  const s = await readSession(readCookie(cookieHeader, SESSION_COOKIE), cfg.sessionSecret);
  if (!s) return null;
  if (cfg.auth === "password") {
    if (s.provider !== "password" || s.email !== "admin@abap.local" || !s.credentialVersion || !cfg.accessPassword) return null;
    const currentVersion = await sha256b64url(`${cfg.sessionSecret}:${cfg.accessPassword}`);
    return await tokenMatches(s.credentialVersion, currentVersion)
      ? { email: s.email, name: "Administrador", mode: "password", access: { kind: "staff" } }
      : null;
  }

}

export const isGuest = (u: AppUser | null | undefined): u is AppUser & { access: { kind: "guest"; projects: readonly string[] } } => u?.access?.kind === "guest";

/** Read-only endpoints the machine token may call (used by `npm run docs:pull`). */
const MACHINE_ALLOWED = [/^\/api\/v1\/projects\/?$/, /^\/api\/v1\/projects\/[a-z0-9-]+\/?$/, /^\/api\/v1\/projects\/[a-z0-9-]+\/drive\/(export|files)\/?$/, /^\/api\/v1\/projects\/[a-z0-9-]+\/models(\/[A-Z]+-\d{2})?\/?$/, /^\/api\/v1\/projects\/[a-z0-9-]+\/agent\/?$/, /^\/api\/v1\/studio\/[a-z0-9-]+\/?$/];
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
    const path0 = new URL(c.req.url).pathname;
    const bearer = c.req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    const isMcp = path0 === MCP_PATH;
    if (bearer && (isMcp || path0.startsWith("/api/"))) {
      let user: AppUser | null = null;
      if (cfg.apiToken && (await tokenMatches(bearer, cfg.apiToken))) user = { email: "machine:api-token", mode: "machine", role: "read" };
      else {
        const db = (c.env as { DB?: D1Database }).DB;
        const t = db ? await new TokenService(db, () => new Date()).verify(bearer) : null;
        if (t) user = { email: `token:${t.name} (${t.owner})`, name: t.name, mode: "token", role: t.role as TokenRole };
      }
      if (!user) return c.json({ ok: false, error: "invalid_token" }, 401, { "WWW-Authenticate": 'Bearer realm="abap"' });
      // REST with a token: read-only allow-list (docs:pull, models:pull). Writes by token go through /mcp only.
      if (!isMcp && !machineMayCall(c.req.method, path0)) return c.json({ ok: false, error: "forbidden_for_token" }, 403);
      c.set("user", user);
      return next();
    }
    if (isMcp && cfg.auth !== "dev-bypass" && cfg.auth !== "public")
      return c.json({ ok: false, error: "token_required", message: "Crie um token pessoal em Settings → Tokens de API" }, 401, { "WWW-Authenticate": 'Bearer realm="abap"' });
    const user = await resolveUser(cfg, c.req.header("cookie"), (c.env as { DB?: D1Database }).DB);
    c.set("user", user);
    const path = new URL(c.req.url).pathname;
    if (isPublicPath(path)) return next();
    // Guests (ADR-011) reach only the studio of their projects; everything else is denied.
    if (isGuest(user) && !guestMayAccess(c.req.method, path, user.access.projects)) {
      if (path.startsWith("/api/")) return c.json({ ok: false, error: "forbidden_for_guest" }, 403);
      return c.redirect(homeFor(user.access), 302);
    }
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
