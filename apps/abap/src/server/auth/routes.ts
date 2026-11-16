import { Hono } from "hono";
import { getDb } from "../db/client";
import { homeFor } from "~/domain/studio";
import { storeSheetsCredential } from "../sheets/sources";
import { acceptInvites, accessOf } from "../studio";
import { randomToken, signJson, verifyJson } from "./crypto";
import { buildAuthUrl, exchangeCode, GoogleError, readIdToken, SCOPE_DRIVE, SCOPE_LOGIN, SCOPE_SHEETS, type Fetch } from "./google";
import { tokenMatches, type AuthVariables } from "./middleware";
import { clearCookie, cookie, createSession, OAUTH_COOKIE, readCookie, safeReturnTo, SESSION_COOKIE, SESSION_TTL_S, type OAuthState } from "./session";

const STATE_TTL_S = 600;

/**
 * OAuth routes:
 *  GET  /auth/login           → Google sign-in (openid email profile)
 *  GET  /auth/sheets/connect  → incremental consent for Sheets (read) + Drive (read/write), offline refresh token
 *  GET  /auth/google/callback → verifies state + PKCE, checks the allow-list, sets the session
 *  POST /auth/logout
 */
export function createAuthRoutes(deps: { fetch?: Fetch; now?: () => number } = {}) {
  const f = deps.fetch ?? ((...a: Parameters<Fetch>) => fetch(...a));
  const now = deps.now ?? Date.now;
  const auth = new Hono<{ Bindings: { DB: D1Database }; Variables: AuthVariables }>().basePath("/auth");
  const redirectUri = (url: string) => `${new URL(url).origin}/auth/google/callback`;

  const start = (purpose: OAuthState["purpose"]) =>
    auth.get(purpose === "login" ? "/login" : "/sheets/connect", async (c) => {
      const cfg = c.get("cfg");
      if (cfg.auth !== "google" || !cfg.google || !cfg.sessionSecret) return c.redirect("/login?error=not_configured", 302);
      if (purpose === "sheets" && !c.get("user")) return c.redirect("/login?returnTo=%2Fsettings", 302);
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
        loginHint: purpose === "sheets" ? c.get("user")?.email : undefined,
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
    if (cfg.auth !== "google" || !cfg.google || !cfg.sessionSecret) return fail("not_configured");
    if (c.req.query("error")) return fail("denied");
    const st = await verifyJson<OAuthState>(readCookie(c.req.header("cookie"), OAUTH_COOKIE), cfg.sessionSecret);
    if (!st || st.exp * 1000 < now() || st.state !== c.req.query("state")) return fail("state");
    const code = c.req.query("code");
    if (!code) return fail("denied");
    try {
      const tokens = await exchangeCode({ code, verifier: st.verifier, redirectUri: redirectUri(c.req.url), ...cfg.google }, f);
      if (!tokens.id_token) return fail("oauth");
      const id = readIdToken(tokens.id_token, cfg.google.clientId, now());
      if (!id.emailVerified) return fail("not_allowed");
      // Staff (allow-list) or a guest invited to a project studio (ADR-011).
      const access = await accessOf(c.env.DB, id.email, cfg.allowedEmails);
      if (access.kind === "none") return fail("not_allowed");
      if (access.kind === "guest" && st.purpose !== "login") return fail("not_allowed");
      if (access.kind === "guest") await acceptInvites(c.env.DB, id.email, new Date(now()).toISOString());
      if (st.purpose === "sheets") {
        if (!tokens.refresh_token || !tokens.scope.split(" ").includes(SCOPE_SHEETS)) return fail("sheets_scope");
        // Store the scopes Google actually granted (the user may untick Drive on the consent screen).
        await storeSheetsCredential(getDb(c.env.DB), cfg, { email: id.email, scope: tokens.scope, refreshToken: tokens.refresh_token }, new Date(now()).toISOString());
      }
      c.header("Set-Cookie", clearCookie(OAUTH_COOKIE), { append: true });
      c.header("Set-Cookie", cookie(SESSION_COOKIE, await createSession({ email: id.email, name: id.name }, cfg.sessionSecret, now()), SESSION_TTL_S), { append: true });
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

  // Explicit owner-only login for deployments without Google OAuth.
  // OWNER_ACCESS_CODE must be a high-entropy Cloudflare secret (48+ characters).
  auth.post("/owner", async (c) => {
    const cfg = c.get("cfg");
    c.header("Cache-Control", "no-store");
    if (cfg.auth !== "owner-code" || !cfg.owner || !cfg.sessionSecret) {
      return c.redirect("/login?error=not_configured", 303);
    }
    // A same-origin form is mandatory. Tokens never enter URLs or logs.
    const origin = c.req.header("origin");
    if (origin !== new URL(c.req.url).origin) return c.text("Forbidden", 403);
    if (!c.req.header("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
      return c.text("Unsupported Media Type", 415);
    }
    const form = await c.req.parseBody();
    const code = form.code;
    if (typeof code !== "string" || code.length < 48 || code.length > 1024 ||
        !(await tokenMatches(code, cfg.owner.code))) {
      return c.redirect("/login?error=invalid_code", 303);
    }
    const ttl = 12 * 60 * 60; // Shorter owner sessions; rotate SESSION_SECRET to revoke.
    const session = await createSession({ email: cfg.owner.email }, cfg.sessionSecret, now(), ttl);
    c.header("Set-Cookie", cookie(SESSION_COOKIE, session, ttl));
    return c.redirect(safeReturnTo(typeof form.returnTo === "string" ? form.returnTo : null), 303);
  });

  auth.post("/logout", (c) => {
    c.header("Set-Cookie", clearCookie(SESSION_COOKIE));
    return c.redirect("/login?loggedOut=1", 302);
  });

  return auth;
}
