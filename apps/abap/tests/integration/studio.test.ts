import { readdirSync, readFileSync } from "node:fs";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { fixtureSchema } from "~/domain/governance";
import { createApi } from "~/server/api/app";
import { ARTIFACT_CSP, createStudioRawRoute } from "~/server/api/studio-routes";
import { signJson } from "~/server/auth/crypto";
import { authGate, type AuthVariables } from "~/server/auth/middleware";
import { createSession, SESSION_COOKIE } from "~/server/auth/session";
import { buildSeedSql } from "~/server/db/seed";
import { ProjectService } from "~/server/projects";
import { acceptInvites, StudioService } from "~/server/studio";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
const clock = () => new Date("2026-11-15T12:00:00Z");
const SECRET = "s".repeat(40);
const ENV = {
  ENVIRONMENT: "production",
  PUBLIC_ACCESS: "true",
  GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "x".repeat(24),
  SESSION_SECRET: SECRET,
  TOKEN_ENCRYPTION_KEY: "k".repeat(43) + "=",
  ALLOWED_EMAILS: "owner@example.com",
};
const P = "prj-07-exemplo";
const OTHER = "prj-08-outro";

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false });
  const db = proxy.env.DB;
  for (const file of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
    const stmts = readFileSync(`migrations/${file}`, "utf8").split("--> statement-breakpoint");
    await db.batch(stmts.map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
  }
  const fixture = fixtureSchema.parse(JSON.parse(readFileSync("data/seed/activities.v1.json", "utf8")));
  await db.batch(buildSeedSql(fixture, clock().toISOString()).map((s) => db.prepare(s)));
  const projects = new ProjectService(db, clock);
  await projects.create({ code: "PRJ-07", name: "Exemplo", id: P }, "owner@example.com");
  await projects.create({ code: "PRJ-08", name: "Outro", id: OTHER }, "owner@example.com");
});
afterAll(async () => proxy?.dispose());

/** The Worker as deployed: gate → API → raw artifact route. */
function worker() {
  const app = new Hono<{ Bindings: { DB: D1Database }; Variables: AuthVariables }>();
  app.use("*", authGate());
  app.route("/", createApi(clock));
  app.route("/", createStudioRawRoute(clock));
  app.all("*", (c) => c.text("page", 200));
  return app;
}
const session = async (email: string) => `${SESSION_COOKIE}=${encodeURIComponent(await createSession({ email }, SECRET, clock().getTime()))}`;
const call = async (path: string, email: string | null, init: RequestInit = {}) =>
  worker().request(path, { ...init, headers: { ...(init.headers ?? {}), ...(email ? { cookie: await session(email) } : {}), "content-type": "application/json" } }, { ...ENV, DB: proxy.env.DB });
const ARTIFACT = {
  slug: "prototipo-app",
  title: "Protótipo do app",
  notice: "Protótipo — dados simulados",
  entry: "index.html",
  files: [
    { path: "index.html", content: '<script src="./app.js"></script><p>ok</p>' },
    { path: "app.js", content: "console.log(1)" },
  ],
};

describe("Feature: shared studio with invited guests (ADR-011)", () => {
  it("GIVEN staff WHEN publishing THEN revision 1 is stored, audited, and the same content creates no new revision", async () => {
    const r1 = await call(`/api/v1/studio/${P}/artifacts`, "owner@example.com", { method: "POST", body: JSON.stringify(ARTIFACT) });
    expect(r1.status).toBe(201);
    const r2 = await call(`/api/v1/studio/${P}/artifacts`, "owner@example.com", { method: "POST", body: JSON.stringify(ARTIFACT) });
    expect(r2.status).toBe(200);
    expect(((await r2.json()) as { changed: boolean }).changed).toBe(false);
    const events = await new ProjectService(proxy.env.DB, clock).events(P);
    expect(events.filter((e) => e.action === "studio.artifact.published")).toHaveLength(1);
  });

  it("GIVEN public mode WHEN no cookie is supplied THEN the studio is accessible", async () => {
    const r = await call(`/api/v1/studio/${P}`, null);
    expect(r.status).toBe(200);
    const body = await r.json() as { artifacts: unknown[]; members: unknown[] };
    expect(body.artifacts).toHaveLength(1);
    expect(body.members).toEqual([]);
  });

  it("GIVEN public mode WHEN inviting a client THEN membership is recorded but access is public for every project", async () => {
    const inv = await call(`/api/v1/studio/${P}/members`, null, { method: "POST", body: JSON.stringify({ email: "Cliente@Example.com", role: "client" }) });
    expect(inv.status).toBe(201);
    await acceptInvites(proxy.env.DB, "cliente@example.com", clock().toISOString());
    const own = await call(`/api/v1/studio/${P}`, null);
    expect(own.status).toBe(200);
    const body = await own.json() as { artifacts: { slug: string }[]; members: unknown[] };
    expect(body.artifacts.map((a) => a.slug)).toEqual(["prototipo-app"]);
    expect(body.members).toHaveLength(1);
    expect((await call(`/api/v1/studio/${OTHER}`, null)).status).toBe(200);
    expect((await call("/api/v1/projects", null)).status).toBe(200);
    const member = (await new StudioService(proxy.env.DB, clock, P).members()).find((m) => m.email === "cliente@example.com");
    expect(member).toMatchObject({ status: "active", invitedBy: "public@abap.local" });
  });

  it("GIVEN the signed artifact URL WHEN fetched without a cookie THEN files are served sandboxed; a forged or expired token is refused", async () => {
    const { artifacts } = (await (await call(`/api/v1/studio/${P}`, "owner@example.com")).json()) as { artifacts: { url: string }[] };
    const url = artifacts[0]!.url;
    const entry = await call(url, null);
    expect(entry.status).toBe(200);
    expect(entry.headers.get("content-security-policy")).toBe(ARTIFACT_CSP);
    expect(entry.headers.get("content-type")).toContain("text/html");
    expect(entry.headers.get("access-control-allow-origin")).toBe("*");
    expect(entry.headers.get("access-control-allow-credentials")).toBeNull();
    const js = await call(url.replace(/index\.html$/, "app.js"), null);
    expect(await js.text()).toBe("console.log(1)");
    expect((await call(url.replace(/index\.html$/, "missing.js"), null)).status).toBe(404);
    expect((await call(url.replace(/index\.html$/, "..%2F..%2Fetc"), null)).status).toBe(404);
    const forged = await signJson({ p: OTHER, a: "prototipo-app", exp: 9e9 }, "wrong-secret-".repeat(4));
    expect((await call(`/studio/raw/${forged}/index.html`, null)).status).toBe(403);
    const expired = await signJson({ p: P, a: "prototipo-app", exp: 1 }, SECRET);
    expect((await call(`/studio/raw/${expired}/index.html`, null)).status).toBe(403);
  });

  it("GIVEN public mode WHEN membership is revoked THEN the record changes but public access remains", async () => {
    expect((await call(`/api/v1/studio/${P}/members/${encodeURIComponent("cliente@example.com")}`, null, { method: "DELETE" })).status).toBe(200);
    const member = (await new StudioService(proxy.env.DB, clock, P).members()).find((m) => m.email === "cliente@example.com");
    expect(member?.status).toBe("revoked");
    expect((await call(`/api/v1/studio/${P}`, null)).status).toBe(200);
    const actions = (await new ProjectService(proxy.env.DB, clock).events(P)).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["studio.member.invited", "studio.member.accepted", "studio.member.revoked"]));
  });

  it("GIVEN a personal API token WHEN reading the studio THEN artifacts are listed without members; writes stay closed", async () => {
    const { TokenService } = await import("~/server/tokens");
    const { token } = await new TokenService(proxy.env.DB, clock).create({ name: "ci", role: "write" }, "owner@example.com");
    const auth = { headers: { authorization: `Bearer ${token}` } };
    const r = await worker().request(`/api/v1/studio/${P}`, auth, { ...ENV, DB: proxy.env.DB });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { artifacts: unknown[]; members?: unknown };
    expect(body.artifacts).toHaveLength(1);
    expect(body.members).toBeUndefined();
    const w = await worker().request(`/api/v1/studio/${P}/members`, { method: "POST", headers: { ...auth.headers, "content-type": "application/json" }, body: JSON.stringify({ email: "x@y.com" }) }, { ...ENV, DB: proxy.env.DB });
    expect(w.status).toBe(403);
  });

  it("validates invited emails and deletes studio rows with the project", async () => {
    expect((await call(`/api/v1/studio/${P}/members`, null, { method: "POST", body: JSON.stringify({ email: "not-an-email" }) })).status).toBe(400);
    const svc = new ProjectService(proxy.env.DB, clock);
    const impact = await svc.impact(P);
    expect(impact.studio_files).toBe(2);
    expect(impact.studio_members).toBe(1);
    await svc.delete(P, P, "owner@example.com");
    expect(await new StudioService(proxy.env.DB, clock, P).artifacts(true)).toEqual([]);
  });
});
