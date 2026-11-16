import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { authGate, type AuthVariables } from "~/server/auth/middleware";
import { createAuthRoutes } from "~/server/auth/routes";
import { createSession } from "~/server/auth/session";
import { parseConfig } from "~/server/config";

const ORIGIN = "https://gov.example.workers.dev";
const SECRET = "s".repeat(48);
const PASSWORD = "p".repeat(32);
const ENV = { ENVIRONMENT: "production", SESSION_SECRET: SECRET, ABAP_ACCESS_PASSWORD: PASSWORD };

function testApp() {
  const app = new Hono<{ Bindings: { DB: D1Database }; Variables: AuthVariables }>();
  app.use("*", authGate());
  app.route("/", createAuthRoutes());
  app.get("/api/v1/private", (c) => c.json({ email: c.get("user")?.email, mode: c.get("user")?.mode }));
  app.get("/dashboard", (c) => c.text(c.get("user")?.mode ?? "none"));
  return app;
}

function request(path: string, init: RequestInit = {}, env: object = ENV) {
  return testApp().request(`${ORIGIN}${path}`, init, { ...env, DB: {} as D1Database });
}

function submit(password: string, returnTo = "/dashboard", origin = ORIGIN): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin },
    body: new URLSearchParams({ password, returnTo }).toString(),
  };
}

describe("Feature: password authentication without Google", () => {
  it("GIVEN PUBLIC_ACCESS=true WHEN production has no secrets THEN dashboard and API are accessible", async () => {
    const env = { ENVIRONMENT: "production", PUBLIC_ACCESS: "true" };
    expect(parseConfig(env).auth).toBe("public");
    const page = await request("/dashboard", {}, env);
    expect(page.status).toBe(200);
    expect(await page.text()).toBe("public");
    const api = await request("/api/v1/private", {}, env);
    expect(api.status).toBe(200);
    expect(await api.json()).toMatchObject({ email: "public@abap.local", mode: "public" });
  });

  it("GIVEN PUBLIC_ACCESS=false WHEN production has no password THEN access remains blocked", async () => {
    const env = { ENVIRONMENT: "production", PUBLIC_ACCESS: "false" };
    expect(parseConfig(env).auth).toBe("misconfigured");
    expect((await request("/api/v1/private", {}, env)).status).toBe(503);
  });

  it("GIVEN a strong password and a session secret WHEN configured THEN Google is not required", () => {
    const cfg = parseConfig(ENV);
    expect(cfg.auth).toBe("password");
    expect(cfg.google).toBeUndefined();
    expect(cfg.missing).toEqual([]);
  });

  it("GIVEN production with only a session secret WHEN no password is configured THEN access stays blocked", async () => {
    expect(parseConfig({ ENVIRONMENT: "production", SESSION_SECRET: SECRET }).auth).toBe("misconfigured");
    expect((await request("/api/v1/private", {}, { ENVIRONMENT: "production", SESSION_SECRET: SECRET })).status).toBe(503);
  });

  it("GIVEN a weak password WHEN configured THEN production fails closed", () => {
    const cfg = parseConfig({ ...ENV, ABAP_ACCESS_PASSWORD: "short" });
    expect(cfg.auth).toBe("misconfigured");
    expect(cfg.missing).toContain("ABAP_ACCESS_PASSWORD (mínimo 24 caracteres)");
  });

  it("GIVEN no session WHEN requesting protected data THEN deny access", async () => {
    expect((await request("/api/v1/private")).status).toBe(401);
    expect((await request("/dashboard")).headers.get("location")).toBe("/login?returnTo=%2Fdashboard");
  });

  it("GIVEN a correct password WHEN submitting the form THEN set an HTTP-only session and grant access", async () => {
    const login = await request("/auth/password/login", submit(PASSWORD, "/dashboard"));
    expect(login.status).toBe(303);
    expect(login.headers.get("location")).toBe("/dashboard");
    const cookie = login.headers.get("set-cookie")!;
    expect(cookie).toContain("gs_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(await (await request("/api/v1/private", { headers: { cookie: cookie.split(";")[0]! } })).json())
      .toMatchObject({ email: "admin@abap.local", mode: "password" });
  });

  it("GIVEN an incorrect password WHEN submitted THEN reject it without setting a session", async () => {
    const login = await request("/auth/password/login", submit("invalid"));
    expect(login.status).toBe(303);
    expect(login.headers.get("location")).toContain("error=invalid_credentials");
    expect(login.headers.get("set-cookie")).toBeNull();
  });

  it("GIVEN a cross-origin form POST WHEN submitted THEN reject it", async () => {
    const login = await request("/auth/password/login", submit(PASSWORD, "/dashboard", "https://attacker.example"));
    expect(login.status).toBe(403);
  });

  it("GIVEN an external return URL WHEN password login succeeds THEN redirect to the safe local dashboard", async () => {
    const login = await request("/auth/password/login", submit(PASSWORD, "//attacker.example"));
    expect(login.headers.get("location")).toBe("/dashboard");
  });

  it("GIVEN a signed Google session WHEN password mode is on THEN it cannot access protected endpoints", async () => {
    const token = await createSession({ email: "owner@example.com", provider: "google" }, SECRET);
    const res = await request("/api/v1/private", { headers: { cookie: `gs_session=${encodeURIComponent(token)}` } });
    expect(res.status).toBe(401);
  });

  it("GIVEN a signed session WHEN the administrator rotates the password THEN the old session is revoked", async () => {
    const login = await request("/auth/password/login", submit(PASSWORD));
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    const rotated = { ...ENV, ABAP_ACCESS_PASSWORD: "n".repeat(32) };
    const res = await request("/api/v1/private", { headers: { cookie } }, rotated);
    expect(res.status).toBe(401);
  });

  it("GIVEN the password is removed from production WHEN a signed password session exists THEN access is revoked", async () => {
    const login = await request("/auth/password/login", submit(PASSWORD));
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    const res = await request("/api/v1/private", { headers: { cookie } }, { ENVIRONMENT: "production", SESSION_SECRET: SECRET });
    expect(res.status).toBe(503);
  });
});
