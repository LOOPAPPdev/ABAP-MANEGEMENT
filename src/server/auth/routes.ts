import { Hono } from "hono";
import { getDb } from "../db/client";
import { storeSheetsCredential } from "../sheets/sources";
import { randomToken, signJson, verifyJson } from "./crypto";
import { buildAuthUrl, exchangeCode, GoogleError, readIdToken, SCOPE_LOGIN, SCOPE_SHEETS, type Fetch } from "./google";
import type { AuthVariables } from "./middleware";
import { clearCookie, cookie, createSession, OAUTH_COOKIE, readCookie, safeReturnTo, SESSION_COOKIE, SESSION_TTL_S, type OAuthState } from "./session";

const STATE_TTL_S = 600;

/**
 * OAuth routes:
 *  GET  /auth/login           → Google sign-in (openid email profile)
 *  GET  /auth/sheets/connect  → incremental consent for spreadsheets.readonly (offline, refresh token)
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
        scope: purpose === "login" ? SCOPE_LOGIN : `${SCOPE_LOGIN} ${SCOPE_SHEETS}`,
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
      if (!id.emailVerified || !cfg.allowedEmails.includes(id.email)) return fail("not_allowed");
      if (st.purpose === "sheets") {
        if (!tokens.refresh_token || !tokens.scope.split(" ").includes(SCOPE_SHEETS)) return fail("sheets_scope");
        await storeSheetsCredential(getDb(c.env.DB), cfg, { email: id.email, scope: SCOPE_SHEETS, refreshToken: tokens.refresh_token }, new Date(now()).toISOString());
      }
      c.header("Set-Cookie", clearCookie(OAUTH_COOKIE), { append: true });
      c.header("Set-Cookie", cookie(SESSION_COOKIE, await createSession({ email: id.email, name: id.name }, cfg.sessionSecret, now()), SESSION_TTL_S), { append: true });
      const target = st.purpose === "sheets" ? `${st.returnTo}${st.returnTo.includes("?") ? "&" : "?"}connected=1` : st.returnTo;
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
