import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { authGate, type AuthVariables } from "~/server/auth/middleware";
import { createAuthRoutes } from "~/server/auth/routes";
import { readSession } from "~/server/auth/session";

const ORIGIN = "https://abap-manegement.adm-loop-app.workers.dev";
const CODE = "A".repeat(64);
const SECRET = "s".repeat(40);
const ENV = {
  ENVIRONMENT: "production",
  OWNER_ACCESS_EMAIL: "owner@example.com",
  OWNER_ACCESS_CODE: CODE,
  SESSION_SECRET: SECRET,
};

function application() {
  const app = new Hono<{ Bindings: { DB: D1Database }; Variables: AuthVariables }>();
  app.use("*", authGate());
  app.route("/", createAuthRoutes());
  app.get("/dashboard", (c) => c.text("dashboard:" + c.get("user")?.email));
  app.get("/api/v1/data", (c) => c.json({ actor: c.get("user")?.email }));
  return app;
}

const req = (path: string, init: RequestInit = {}, env: object = ENV) =>
  application().request(ORIGIN + path, init, { ...(env as Record<string, unknown>), DB: {} as D1Database });

function submit(code: string, headers: Record<string, string> = {}) {
  return req("/auth/owner", {
    method: "POST",
    headers: {
      origin: ORIGIN,
      "content-type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams({ code, returnTo: "/dashboard" }),
  });
}

describe("Feature: Google-free owner access stays protected", () => {
  it("blocks production when the access code is not configured", async () => {
    expect((await req("/dashboard", {}, { ENVIRONMENT: "production" })).status).toBe(302);
    const partial = { ENVIRONMENT: "production", OWNER_ACCESS_EMAIL: "owner@example.com", SESSION_SECRET: SECRET };
    const res = await req("/api/v1/data", {}, partial);
    expect(res.status).toBe(503);
  });

  it("rejects an invalid access code without creating a session", async () => {
    const response = await submit("B".repeat(64));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/login?error=invalid_code");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects cross-origin and unsupported-content-type requests", async () => {
    expect((await submit(CODE, { origin: "https://evil.example" })).status).toBe(403);
    expect((await submit(CODE, { "content-type": "application/json" })).status).toBe(415);
  });

  it("creates a 12-hour signed cookie for the configured owner and allows the dashboard", async () => {
    const response = await submit(CODE);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/dashboard");
    const setCookie = response.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    expect(setCookie).toMatch(/Max-Age=43200/);
    const cookie = setCookie.split(";")[0]!;
    const token = decodeURIComponent(cookie.split("=")[1]!);
    expect(await readSession(token, SECRET)).toMatchObject({ email: "owner@example.com" });
    const dashboard = await req("/dashboard", { headers: { cookie } });
    expect(dashboard.status).toBe(200);
    expect(await dashboard.text()).toContain("owner@example.com");
    const api = await req("/api/v1/data", { headers: { cookie, "x-actor": "spoof" } });
    expect((await api.json())).toEqual({ actor: "owner@example.com" });
    expect((await req("/dashboard")).status).toBe(302);
  });

  it("rejects a valid former session when the owner e-mail or signing secret changes", async () => {
    const loggedIn = await submit(CODE);
    const cookie = loggedIn.headers.get("set-cookie")!.split(";")[0]!;
    expect((await req("/dashboard", { headers: { cookie } }, { ...ENV, OWNER_ACCESS_EMAIL: "other@example.com" })).status).toBe(302);
    expect((await req("/dashboard", { headers: { cookie } }, { ...ENV, SESSION_SECRET: "n".repeat(40) })).status).toBe(302);
  });

  it("blocks open redirects from a forged return target", async () => {
    const res = await req("/auth/owner", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: CODE, returnTo: "//evil.example" }),
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/dashboard");
  });
});
