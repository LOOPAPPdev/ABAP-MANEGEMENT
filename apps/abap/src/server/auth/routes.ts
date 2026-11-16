import { Hono } from "hono";
import { getDb } from "../db/client";
import { homeFor } from "~/domain/studio";
import { storeSheetsCredential } from "../sheets/sources";
import { acceptInvites, accessOf } from "../studio";
import { randomToken, sha256b64url, signJson, verifyJson } from "./crypto";
import { tokenMatches } from "./middleware";
import { buildAuthUrl, exchangeCode, GoogleError, readIdToken, SCOPE_DRIVE, SCOPE_LOGIN, SCOPE_SHEETS, type Fetch } from "./google";
import type { AuthVariables } from "./middleware";
import { clearCookie, cookie, createSession, OAUTH_COOKIE, readCookie, safeReturnTo, SESSION_COOKIE, SESSION_TTL_S, type OAuthState } from "./session";

const STATE_TTL_S = 600;

/**
 * OAuth routes:
 *  POST /auth/password/login → password-only sign-in (no Google dependency)
 *  GET  /auth/login           → Google sign-in (openid email profile; optional)
 *  GET  /auth/sheets/connect  → incremental consent for Sheets (read) + Drive (read/write), offline refresh token
 *  GET  /auth/google/callback → verifies state + PKCE, checks the allow-list, sets the session
 *  POST /auth/logout
 */
export function createAuthRoutes(deps: { fetch?: Fetch; now?: () => number } = {}) {
  const f = deps.fetch ?? ((...a: Parameters<Fetch>) => fetch(...a));
  const now = deps.now ?? Date.now;
  const auth = new Hono<{ Bindings: { DB: D1Database }; Variables: AuthVariables }>().basePath("/auth");
  const redirectUri = (url: string) => `${new URL(url).origin}/auth/google/callback`;

  auth.post("/password/login", async (c) => {
    const cfg = c.get("cfg");
    if (cfg.auth !== "password" || !cfg.accessPassword || !cfg.sessionSecret) return c.text("Not found", 404);
    const expectedOrigin = new URL(c.req.url).origin;
    const origin = c.req.header("origin");
    if ((origin && origin !== expectedOrigin) || c.req.header("sec-fetch-site") === "cross-site") {
      return c.text("Forbidden", 403);
    }
    if (!(c.req.header("content-type") ?? "").startsWith("application/x-www-form-urlencoded")) {
      return c.text("Unsupported Media Type", 415);
    }
    const form = await c.req.raw.formData().catch(() => null);
    const value = form?.get("password");
    const password = typeof value === "string" ? value : "";
    const returnTo = safeReturnTo(typeof form?.get("returnTo") === "string" ? String(form.get("returnTo")) : null);
    if (password.length > 4096 || !(await tokenMatches(password, cfg.accessPassword))) {
      return c.redirect(`/login?error=invalid_credentials&returnTo=${encodeURIComponent(returnTo)}`, 303);
    }
    const session = await createSession(
      { email: "admin@abap.local", name: "Administrador", provider: "password", credentialVersion: await sha256b64url(`${cfg.sessionSecret}:${cfg.accessPassword}`) },
      cfg.sessionSecret, now(),
    );
    c.header("Set-Cookie", cookie(SESSION_COOKIE, session, SESSION_TTL_S));
    c.header("Cache-Control", "no-store");
    return c.redirect(returnTo, 303);
  });

  const start = (purpose: OAuthState["purpose"]) =>
    auth.get(purpose === "login" ? "/login" : "/sheets/connect", async (c) => {
      const cfg = c.get("cfg");
      if (!cfg.google || !cfg.sessionSecret || (purpose === "login" && cfg.auth !== "google")
        || (purpose === "sheets" && !cfg.tokenKey)) return c.redirect("/login?error=not_configured", 302);
      if (purpose === "sheets" && (!c.get("user") || c.get("user")?.access?.kind === "guest"))
        return c.redirect("/login?returnTo=%2Fsettings", 302);
      const st: OAuthState = {
        state: randomToken(),
        verifier: randomToken(48),
        purpose,
        returnTo: safeReturnTo(c.req.query("returnTo") ?? (purpose === "sheets" ? "/sheets" : "/dashboard")),
        exp: Math.floor(now() / 1000) + STATE_TTL_S,
      };
      const url = await buildAuthUrl({
        clientId: cfg.google.clientId,
        redirectUri: redirectUri(c.req.url),
        state: st.state,
        verifier: st.verifier,
        scope: purpose === "login" ? SCOPE_LOGIN : `${SCOPE_LOGIN} ${SCOPE_SHEETS} ${SCOPE_DRIVE}`,
        offline: purpose === "sheets",
        loginHint: purpose === "sheets" && c.get("user")?.mode === "google" ? c.get("user")?.email : undefined,
      });
      c.header("Set-Cookie", cookie(OAUTH_COOKIE, await signJson(st, cfg.sessionSecret), STATE_TTL_S));
      return c.redirect(url, 302);
    });
  start("login");
  start("sheets");

  auth.get("/google/callback", async (c) => {
    const cfg = c.get("cfg");
    const fail = (code: string) => {
      c.header("Set-Cookie", clearCookie(OAUTH_COOKIE), { append: true });
      return c.redirect(`/login?error=${code}`, 302);
    };
    if (!cfg.google || !cfg.sessionSecret || (cfg.auth !== "google" && cfg.auth !== "password")) return fail("not_configured");
    if (c.req.query("error")) return fail("denied");
    const st = await verifyJson<OAuthState>(readCookie(c.req.header("cookie"), OAUTH_COOKIE), cfg.sessionSecret);
    if (!st || st.exp * 1000 < now() || st.state !== c.req.query("state")) return fail("state");
    if (st.purpose === "login" && cfg.auth !== "google") return fail("not_configured");
    if (st.purpose === "sheets" && (!c.get("user") || c.get("user")?.access?.kind === "guest")) return fail("not_allowed");
    const code = c.req.query("code");
    if (!code) return fail("denied");
    try {
      const tokens = await exchangeCode({ code, verifier: st.verifier, redirectUri: redirectUri(c.req.url), ...cfg.google }, f);
      if (!tokens.id_token) return fail("oauth");
      const id = readIdToken(tokens.id_token, cfg.google.clientId, now());
      if (!id.emailVerified) return fail("not_allowed");
      // Staff (allow-list) or a guest invited to a project studio (ADR-011).
      const access = cfg.auth === "password" && st.purpose === "sheets"
        ? ({ kind: "staff" } as const)
        : await accessOf(c.env.DB, id.email, cfg.allowedEmails);
      if (access.kind === "none") return fail("not_allowed");
      if (access.kind === "guest" && st.purpose !== "login") return fail("not_allowed");
      if (access.kind === "guest") await acceptInvites(c.env.DB, id.email, new Date(now()).toISOString());
      if (st.purpose === "sheets") {
        if (!tokens.refresh_token || !tokens.scope.split(" ").includes(SCOPE_SHEETS)) return fail("sheets_scope");
        // Store the scopes Google actually granted (the user may untick Drive on the consent screen).
        await storeSheetsCredential(getDb(c.env.DB), cfg, { email: id.email, scope: tokens.scope, refreshToken: tokens.refresh_token }, new Date(now()).toISOString());
      }
      c.header("Set-Cookie", clearCookie(OAUTH_COOKIE), { append: true });
      // Connecting a Google Sheet MUST NOT replace a password-authenticated session.
      if (cfg.auth === "google") {
        c.header("Set-Cookie", cookie(SESSION_COOKIE, await createSession({ email: id.email, name: id.name, provider: "google" }, cfg.sessionSecret, now()), SESSION_TTL_S), { append: true });
      }
      const target =
        st.purpose === "sheets"
          ? `${st.returnTo}${st.returnTo.includes("?") ? "&" : "?"}connected=1`
          : access.kind === "guest" && !st.returnTo.startsWith("/studio")
            ? homeFor(access)
            : st.returnTo;
      return c.redirect(target, 302);
    } catch (e) {
      console.error("oauth callback failed", e instanceof GoogleError ? e.message : e);
      return fail("oauth");
    }
  });

  auth.post("/logout", (c) => {
    c.header("Set-Cookie", clearCookie(SESSION_COOKIE));
    return c.redirect("/login?loggedOut=1", 302);
  });

  return auth;
}
