import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { fixtureSchema } from "~/domain/governance";
import { createApi } from "~/server/api/app";
import { parseConfig } from "~/server/config";
import { getDb } from "~/server/db/client";
import { buildSeedSql } from "~/server/db/seed";
import { GovernanceService } from "~/server/governance-service";
import { ProjectService } from "~/server/projects";
import { spreadsheetIdFor, syncServiceFor } from "~/server/sheets/factory";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
const clock = () => new Date("2026-11-14T10:00:00Z");
const FOLDER = "1FolderIdForTestsAbcdefghijklmnop";
const SHEET = "1SheetIdForTestsAbcdefghijklmnopqr";

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false });
  const db = proxy.env.DB;
  for (const file of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
    const stmts = readFileSync(`migrations/${file}`, "utf8").split("--> statement-breakpoint");
    await db.batch(stmts.map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
  }
  const fixture = fixtureSchema.parse(JSON.parse(readFileSync("data/seed/activities.v1.json", "utf8")));
  await db.batch(buildSeedSql(fixture, clock().toISOString()).map((s) => db.prepare(s)));
});
afterAll(async () => proxy?.dispose());

const api = () => createApi(clock);
const req = (path: string, init: RequestInit = {}) => api().request(`/api/v1${path}`, init, { DB: proxy.env.DB });
const json = (method: string, body: unknown) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("Feature: multi-project (D-007)", () => {
  it("GIVEN a new client WHEN the project is created THEN it gets the 14 governance activities and an audit event", async () => {
    const res = await req("/projects", json("POST", { code: "PRJ-01", name: "CleanSea", id: "prj-01-cleansea" }));
    expect(res.status).toBe(201);
    const acts = (await (await req("/activities?project=prj-01-cleansea")).json()) as { activities: { id: string }[] };
    expect(acts.activities).toHaveLength(14);
    const events = await new ProjectService(proxy.env.DB, clock).events("prj-01-cleansea");
    expect(events[0]).toMatchObject({ action: "project.created", detail: "PRJ-01 CleanSea" });
  });

  it("rejects duplicates and invalid ids", async () => {
    expect((await req("/projects", json("POST", { code: "PRJ-01", name: "CleanSea", id: "prj-01-cleansea" }))).status).toBe(409);
    expect((await req("/projects", json("POST", { code: "PRJ-02", name: "X", id: "prj-09-x" }))).status).toBe(400);
  });

  it("keeps projects isolated: a change in one project does not touch another", async () => {
    const client = new GovernanceService(getDb(proxy.env.DB), clock, "prj-01-cleansea");
    await client.changeStatus("ACT-01", "IN PROGRESS", "tester");
    const platform = new GovernanceService(getDb(proxy.env.DB), clock, "default");
    expect((await platform.getActivity("ACT-01")).activity.status).toBe("NOT STARTED");
    expect((await client.getActivity("ACT-01")).activity.status).toBe("IN PROGRESS");
    // The API honours ?project= and the cookie.
    const viaCookie = (await (await api().request("/api/v1/activities/ACT-01", { headers: { cookie: "gs_project=prj-01-cleansea" } }, { DB: proxy.env.DB })).json()) as { activity: { status: string } };
    expect(viaCookie.activity.status).toBe("IN PROGRESS");
  });

  it("an unknown project falls back to the default project", async () => {
    const r = (await (await req("/activities/ACT-01?project=prj-99-nobody")).json()) as { activity: { status: string } };
    expect(r.activity.status).toBe("NOT STARTED");
  });

  it("links a Drive folder and spreadsheet from pasted URLs, audited, IDs stored in D1", async () => {
    const res = await req("/projects/prj-01-cleansea/links", json("PUT", { driveFolder: `https://drive.google.com/drive/folders/${FOLDER}?usp=sharing`, spreadsheet: `https://docs.google.com/spreadsheets/d/${SHEET}/edit` }));
    expect(res.status).toBe(200);
    const p = await new ProjectService(proxy.env.DB, clock).get("prj-01-cleansea");
    expect(p).toMatchObject({ driveFolderId: FOLDER, spreadsheetId: SHEET });
    expect((await req("/projects/prj-01-cleansea/links", json("PUT", { driveFolder: "https://example.com" }))).status).toBe(400);
    const events = await new ProjectService(proxy.env.DB, clock).events("prj-01-cleansea");
    expect(events[0]).toMatchObject({ action: "project.links", detail: "pasta do Drive vinculada; planilha vinculada" });
  });

  it("each project reads its own spreadsheet; only the default may use the SPREADSHEET_ID secret", async () => {
    const cfg = parseConfig({ SPREADSHEET_ID: "1ServerSecretSheetAbcdefghijklmnop" });
    expect(spreadsheetIdFor(cfg, { id: "default", spreadsheetId: null })).toBe("1ServerSecretSheetAbcdefghijklmnop");
    expect(spreadsheetIdFor(cfg, { id: "prj-01-cleansea", spreadsheetId: SHEET })).toBe(SHEET);
    expect(spreadsheetIdFor(cfg, { id: "prj-02-acme", spreadsheetId: null })).toBeNull();
  });

  it("sync mode is per project", async () => {
    const cfg = parseConfig({});
    const a = syncServiceFor(cfg, proxy.env.DB, clock, { id: "prj-01-cleansea", spreadsheetId: null });
    const b = syncServiceFor(cfg, proxy.env.DB, clock, { id: "default", spreadsheetId: null });
    await a.setMode("preview", "tester");
    expect(await a.getMode()).toBe("preview");
    expect(await b.getMode()).toBe("auto");
  });

  it("dashboards are computed per project", async () => {
    const d1 = (await (await req("/dashboard?project=prj-01-cleansea")).json()) as { dashboard: { byStatus: Record<string, number> } };
    const d0 = (await (await req("/dashboard?project=default")).json()) as { dashboard: { byStatus: Record<string, number> } };
    expect(d1.dashboard.byStatus["IN PROGRESS"]).toBe(1);
    expect(d0.dashboard.byStatus["IN PROGRESS"]).toBe(0);
  });
});
