import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { fixtureSchema } from "~/domain/governance";
import { createApi } from "~/server/api/app";
import { buildSeedSql } from "~/server/db/seed";

/** Local D1 via Miniflare (in-memory, no remote resources). */
let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
const clock = () => new Date("2026-11-12T12:00:00Z");
const api = createApi(clock);

const call = (path: string, init?: RequestInit) => api.request(`/api/v1${path}`, init, proxy.env);
const json = (method: string, body: unknown, headers: Record<string, string> = {}) => ({
  method,
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});

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

afterAll(async () => {
  await proxy?.dispose();
});

describe("Feature: API /api/v1", () => {
  it("GIVEN a local D1 WHEN GET /health THEN db is up", async () => {
    const res = await call("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, db: "up" });
  });

  it("lists the 14 seeded activities with evaluated flags", async () => {
    const body = (await (await call("/activities")).json()) as { activities: { id: string; flag: string | null }[] };
    expect(body.activities).toHaveLength(14);
    expect(body.activities.every((a) => a.flag === null)).toBe(true);
  });

  it("returns 404 for an unknown activity and 400 for a malformed ID", async () => {
    expect((await call("/activities/ACT-99")).status).toBe(404);
    expect((await call("/activities/xyz")).status).toBe(400);
  });

  it("rejects an invalid status with 400 and does not write", async () => {
    const res = await call("/activities/ACT-01/status", json("PATCH", { status: "FINISHED" }));
    expect(res.status).toBe(400);
    const detail = (await (await call("/activities/ACT-01")).json()) as { events: unknown[] };
    expect(detail.events).toHaveLength(0);
  });

  it("rejects invalid evidence (link that is not a URL) with 400", async () => {
    const res = await call("/activities/ACT-01/evidence", json("POST", { kind: "link", ref: "not a url" }));
    expect(res.status).toBe(400);
  });

  it("Scenario: DONE without evidence is flagged, evidence completes it, progress is recalculated", async () => {
    // GIVEN ACT-01 is NOT STARTED WHEN set to DONE without evidence
    let res = await call("/activities/ACT-01/status", json("PATCH", { status: "DONE" }, { "x-actor": "tester" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { warnings: string[]; activity: { flag: string; effectivelyDone: boolean } };
    // THEN it is flagged and not counted
    expect(body.warnings).toEqual(["NO EVIDENCE"]);
    expect(body.activity).toMatchObject({ flag: "NO EVIDENCE", effectivelyDone: false });
    let dash = (await (await call("/dashboard")).json()) as { dashboard: { overall: { done: number } } };
    expect(dash.dashboard.overall.done).toBe(0);

    // WHEN valid evidence is attached
    res = await call(
      "/activities/ACT-01/evidence",
      json("POST", { kind: "file", ref: "docs/product/01_project-charter_v0.1.md" }, { "x-actor": "tester" }),
    );
    expect(res.status).toBe(201);
    const after = (await res.json()) as { activity: { flag: string | null; effectivelyDone: boolean }; events: { actor: string; action: string; fromValue: string | null; toValue: string }[] };
    // THEN it is effectively done, the audit trail has both events, and progress is 1/14
    expect(after.activity).toMatchObject({ flag: null, effectivelyDone: true });
    expect(after.events.map((e) => e.action)).toEqual(["evidence.added", "status.changed"]);
    expect(after.events[1]).toMatchObject({ actor: "tester", fromValue: "NOT STARTED", toValue: "DONE" });
    dash = (await (await call("/dashboard")).json()) as { dashboard: { overall: { done: number; total: number } } };
    expect(dash.dashboard.overall).toMatchObject({ done: 1, total: 14 });
  });

  it("Scenario: starting a dependent before its predecessor is done raises DEP PENDING", async () => {
    const res = await call("/activities/ACT-03/status", json("PATCH", { status: "IN PROGRESS" }));
    const body = (await res.json()) as { warnings: string[]; activity: { flag: string } };
    expect(body.warnings).toEqual(["DEP PENDING"]); // ACT-02 is not done
    expect(body.activity.flag).toBe("DEP PENDING");
  });
});
