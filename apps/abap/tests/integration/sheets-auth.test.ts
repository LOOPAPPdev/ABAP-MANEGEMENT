import { readdirSync, readFileSync } from "node:fs";
import { Hono } from "hono";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { fixtureSchema } from "~/domain/governance";
import { createApi } from "~/server/api/app";
import { authGate, type AuthVariables } from "~/server/auth/middleware";
import { createAuthRoutes } from "~/server/auth/routes";
import { fakeIdToken } from "~/server/auth/google";
import { createSession } from "~/server/auth/session";
import { parseConfig } from "~/server/config";
import { getDb } from "~/server/db/client";
import { buildSeedSql } from "~/server/db/seed";
import { GovernanceService } from "~/server/governance-service";
import { SheetSyncService } from "~/server/sheets/sync-service";
import { GoogleSheetSource, storeSheetsCredential, type SheetSource } from "~/server/sheets/sources";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
let t = Date.parse("2026-11-12T12:00:00Z");
const clock = () => new Date(t);
const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
const SECRET = "k".repeat(40);
const ENV = {
  ENVIRONMENT: "production",
  GOOGLE_CLIENT_ID: "cid.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "client-secret",
  SESSION_SECRET: SECRET,
  TOKEN_ENCRYPTION_KEY: KEY,
  ALLOWED_EMAILS: "owner@example.com",
  SPREADSHEET_ID: "1TestSpreadsheetIdAbcdefghijklmnopqrstuvwx",
};

const HEADER = ["ID", "Phase", "Area", "Activity", "Objective", "Tutorial", "Knowledge", "Tool", "Deliverable", "Dependency", "Acceptance", "Reference", "Status", "Priority", "Owner", "Due", "Evidence", "Notes"];
const fixture = fixtureSchema.parse(JSON.parse(readFileSync("data/seed/activities.v1.json", "utf8")));
/** Mutable fake of the Google sheet. */
let cells: Record<string, Record<string, string>> = {};
const sheetValues = () => [["title"], [], HEADER, ...fixture.activities.map((a) => HEADER.map((h) => cells[a.ID]?.[h] ?? (a as Record<string, string>)[h] ?? ""))];
const fakeSource: SheetSource = { kind: "google", label: "fake", read: async () => sheetValues() };

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false });
  const db = proxy.env.DB;
  for (const file of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
    const stmts = readFileSync(`migrations/${file}`, "utf8").split("--> statement-breakpoint");
    await db.batch(stmts.map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
  }
  await db.batch(buildSeedSql(fixture, clock().toISOString()).map((s) => db.prepare(s)));
});
afterAll(async () => proxy?.dispose());
beforeEach(() => {
  t += 60_000;
});

describe("Feature: Google Sheets → app sync (criterion G)", () => {
  const svc = () => new SheetSyncService(getDb(proxy.env.DB), fakeSource, clock);
  const gov = () => new GovernanceService(getDb(proxy.env.DB), clock);

  it("GIVEN the sheet equals the app WHEN synced THEN nothing changes and snapshots are stored", async () => {
    const r = await svc().sync({ mode: "auto", actor: "owner@example.com" });
    expect(r.applied).toEqual({ changes: 0, evidence: 0 });
    expect(r.rowCount).toBe(14);
  });

  it("GIVEN a cell is changed in the sheet WHEN the dashboard opens (auto) THEN the app shows the new value with audit", async () => {
    cells = { "ACT-01": { Status: "DONE", Evidence: "https://docs.example.org/charter-v0.1", Owner: "Ana" } };
    const auto = await svc().autoSyncIfDue("owner@example.com");
    expect(auto?.result?.applied).toEqual({ changes: 2, evidence: 1 });
    const { activity, events, evidence } = await gov().getActivity("ACT-01");
    expect(activity).toMatchObject({ status: "DONE", owner: "Ana", effectivelyDone: true });
    expect(evidence[0]).toMatchObject({ kind: "link", ref: "https://docs.example.org/charter-v0.1" });
    expect(events.map((e) => e.actor)).toContain("owner@example.com (sheets auto)");
    expect((await gov().dashboard()).overall.done).toBe(1);
  });

  it("auto sync is throttled to 30 s unless forced", async () => {
    await svc().sync({ mode: "auto", actor: "x" });
    expect(await svc().autoSyncIfDue("x")).toBeNull();
    expect(await svc().autoSyncIfDue("x", true)).not.toBeNull();
  });

  it("GIVEN the app changed a field the sheet did not WHEN auto sync runs THEN the app value is kept", async () => {
    await gov().changeStatus("ACT-02", "IN PROGRESS", "owner@example.com");
    const r = await svc().sync({ mode: "auto", actor: "x" });
    expect(r.applied.changes).toBe(0);
    expect((await gov().getActivity("ACT-02")).activity.status).toBe("IN PROGRESS");
  });

  it("GIVEN both sides changed WHEN auto THEN conflict is not applied; WHEN manual with resolve THEN sheet wins", async () => {
    cells["ACT-02"] = { Status: "BLOCKED" };
    const auto = await svc().sync({ mode: "auto", actor: "x" });
    expect(auto.skippedConflicts.map((c) => `${c.activityId}:${c.field}`)).toEqual(["ACT-02:status"]);
    expect((await gov().getActivity("ACT-02")).activity.status).toBe("IN PROGRESS");
    // The conflict stays visible on the next read (base not advanced).
    expect((await svc().preview()).plan.conflicts).toHaveLength(1);
    const manual = await svc().sync({ mode: "manual", actor: "owner@example.com", resolve: ["ACT-02:status"] });
    expect(manual.applied.changes).toBe(1);
    expect((await gov().getActivity("ACT-02")).activity.status).toBe("BLOCKED");
  });

  it("reports invalid cells and does not apply them", async () => {
    cells["ACT-03"] = { Status: "FINISHED", Evidence: "ok" };
    const p = await svc().preview();
    expect(p.plan.issues.map((i) => `${i.id}:${i.field}`)).toContain("ACT-03:Status");
    expect(p.invalidEvidence.map((e) => e.activityId)).toEqual(["ACT-03"]);
    await svc().sync({ mode: "manual", actor: "x" });
    expect((await svc().preview()).invalidEvidence).toHaveLength(1); // still reported until fixed
  });

  it("stores the sync mode", async () => {
    await svc().setMode("preview", "owner@example.com");
    expect(await svc().getMode()).toBe("preview");
    expect(await svc().autoSyncIfDue("x", true)).toBeNull(); // preview mode: never writes on open
    await svc().setMode("auto", "owner@example.com");
  });

  it("GoogleSheetSource refreshes the token and calls the Sheets API with it", async () => {
    const cfg = parseConfig(ENV);
    await storeSheetsCredential(getDb(proxy.env.DB), cfg, { email: "owner@example.com", scope: "s", refreshToken: "1//rt" }, clock().toISOString());
    const calls: string[] = [];
    const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("oauth2.googleapis.com/token")) {
        expect(String(init?.body)).toContain("refresh_token=1%2F%2Frt");
        return Response.json({ access_token: "ya29.token", expires_in: 3600, scope: "s" });
      }
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer ya29.token");
      return Response.json({ values: [["ID", "Status"]] });
    }) as typeof fetch;
    const values = await new GoogleSheetSource(getDb(proxy.env.DB), cfg, cfg.spreadsheetId ?? null, f).read();
    expect(values).toEqual([["ID", "Status"]]);
    expect(calls[1]).toContain(`/spreadsheets/${ENV.SPREADSHEET_ID}/values/DATA_Activities!A1%3AR200`);
  });
});

describe("Feature: access control (production)", () => {
  const googleFake = (email: string, refresh = true) =>
    (async (input: RequestInfo | URL) => {
      if (String(input).includes("/token"))
        return Response.json({
          access_token: "a",
          expires_in: 3600,
          scope: `openid email https://www.googleapis.com/auth/spreadsheets.readonly`,
          refresh_token: refresh ? "1//new" : undefined,
          id_token: fakeIdToken({ iss: "https://accounts.google.com", aud: ENV.GOOGLE_CLIENT_ID, exp: 4e9, email, email_verified: true }),
        });
      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;

  const appWith = (f: typeof fetch) => {
    const app = new Hono<{ Bindings: { DB: D1Database }; Variables: AuthVariables }>();
    app.use("*", authGate());
    app.route("/", createAuthRoutes({ fetch: f, now: () => t }));
    app.route("/", createApi(clock));
    app.get("*", (c) => c.text("page"));
    return app;
  };
  const req = (app: ReturnType<typeof appWith>, path: string, init: RequestInit = {}, env: object = ENV) =>
    app.request(`https://gov.example.workers.dev${path}`, init, { ...env, DB: proxy.env.DB });
  const cookiesOf = (res: Response) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

  it("blocks API (401) and pages (redirect to /login) without a session; health stays public", async () => {
    const app = appWith(googleFake("owner@example.com"));
    expect((await req(app, "/api/v1/activities")).status).toBe(401);
    const page = await req(app, "/dashboard");
    expect(page.status).toBe(302);
    expect(page.headers.get("location")).toBe("/login?returnTo=%2Fdashboard");
    expect((await req(app, "/api/v1/health")).status).toBe(200);
  });

  it("fails closed when production secrets are missing", async () => {
    const app = appWith(googleFake("x"));
    const res = await req(app, "/api/v1/activities", {}, { ENVIRONMENT: "production" });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "auth_not_configured" });
  });

  async function login(app: ReturnType<typeof appWith>, path = "/auth/login") {
    const start = await req(app, path);
    expect(start.status).toBe(302);
    const google = new URL(start.headers.get("location")!);
    expect(google.origin).toBe("https://accounts.google.com");
    expect(google.searchParams.get("redirect_uri")).toBe("https://gov.example.workers.dev/auth/google/callback");
    const state = google.searchParams.get("state")!;
    return req(app, `/auth/google/callback?code=abc&state=${state}`, { headers: { cookie: cookiesOf(start) } });
  }

  it("GIVEN an allowed account WHEN it signs in THEN it gets a session and mutations record its e-mail", async () => {
    const app = appWith(googleFake("owner@example.com"));
    const cb = await login(app);
    expect(cb.headers.get("location")).toBe("/dashboard");
    const session = cookiesOf(cb).split("; ").find((c) => c.startsWith("gs_session="))!;
    expect(await (await req(app, "/api/v1/me", { headers: { cookie: session } })).json()).toMatchObject({ user: { email: "owner@example.com" } });
    const patch = await req(app, "/api/v1/activities/ACT-04/status", {
      method: "PATCH",
      headers: { cookie: session, "content-type": "application/json", "x-actor": "spoofed" },
      body: JSON.stringify({ status: "PREPARED" }),
    });
    expect(patch.status).toBe(200);
    const body = (await patch.json()) as { events: { actor: string }[] };
    expect(body.events[0]!.actor).toBe("owner@example.com"); // X-Actor is ignored when logged in
  });

  it("GIVEN an account outside the list WHEN it signs in THEN access is refused", async () => {
    const cb = await login(appWith(googleFake("intruder@example.com")));
    expect(cb.headers.get("location")).toBe("/login?error=not_allowed");
    expect(cookiesOf(cb)).not.toContain("gs_session=e");
  });

  it("rejects a callback with a forged state", async () => {
    const app = appWith(googleFake("owner@example.com"));
    const start = await req(app, "/auth/login");
    const cb = await req(app, "/auth/google/callback?code=abc&state=forged", { headers: { cookie: cookiesOf(start) } });
    expect(cb.headers.get("location")).toBe("/login?error=state");
  });

  it("revokes access when an e-mail is removed from the list", async () => {
    const token = await createSession({ email: "owner@example.com" }, SECRET, t);
    const app = appWith(googleFake("x"));
    const res = await req(app, "/api/v1/me", { headers: { cookie: `gs_session=${encodeURIComponent(token)}` } }, { ...ENV, ALLOWED_EMAILS: "other@example.com" });
    expect(res.status).toBe(401);
  });

  it("connect Sheets stores an encrypted refresh token, never the plain value", async () => {
    const app = appWith(googleFake("owner@example.com"));
    const session = cookiesOf(await login(app)).split("; ").find((c) => c.startsWith("gs_session="))!;
    const start = await req(app, "/auth/sheets/connect", { headers: { cookie: session } });
    const google = new URL(start.headers.get("location")!);
    expect(google.searchParams.get("access_type")).toBe("offline");
    const cb = await req(app, `/auth/google/callback?code=c&state=${google.searchParams.get("state")}`, { headers: { cookie: `${session}; ${cookiesOf(start)}` } });
    expect(cb.headers.get("location")).toBe("/sheets?connected=1");
    const row = await proxy.env.DB.prepare("SELECT ciphertext, email FROM google_credentials WHERE id = 'sheets'").first<{ ciphertext: string; email: string }>();
    expect(row?.email).toBe("owner@example.com");
    expect(row?.ciphertext).not.toContain("1//new");
  });
});

describe("Feature: development fixture source", () => {
  it("accepts partial cell overrides and only in the local bypass", async () => {
    const api = createApi(clock);
    const body = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ overrides: { "ACT-11": { Owner: "Dev" } } }) };
    expect((await api.request("/api/v1/dev/sheet-overrides", body, { DB: proxy.env.DB })).status).toBe(200);
    const bad = { ...body, body: JSON.stringify({ overrides: { "ACT-11": { Phase: "x" } } }) };
    expect((await api.request("/api/v1/dev/sheet-overrides", bad, { DB: proxy.env.DB })).status).toBe(400);
    expect((await api.request("/api/v1/dev/sheet-overrides", body, { ...ENV, DB: proxy.env.DB })).status).toBe(404);
    const preview = (await (await api.request("/api/v1/sheets/preview", {}, { DB: proxy.env.DB })).json()) as { preview: { source: { kind: string }; plan: { changes: { activityId: string; to: string }[] } } };
    expect(preview.preview.source.kind).toBe("fixture");
    expect(preview.preview.plan.changes).toContainEqual(expect.objectContaining({ activityId: "ACT-11", to: "Dev" }));
  });
});

