import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { fixtureSchema } from "~/domain/governance";
import { createApi } from "~/server/api/app";
import { buildSeedSql } from "~/server/db/seed";
import { ProjectService } from "~/server/projects";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
const clock = () => new Date("2026-11-14T10:00:00Z");

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false });
  const db = proxy.env.DB;
  for (const file of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
    const stmts = readFileSync(`migrations/${file}`, "utf8").split("--> statement-breakpoint");
    await db.batch(stmts.map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
  }
  const fixture = fixtureSchema.parse(JSON.parse(readFileSync("data/seed/activities.v1.json", "utf8")));
  await db.batch(buildSeedSql(fixture, clock().toISOString()).map((s) => db.prepare(s)));
  await new ProjectService(db, clock).create({ code: "PRJ-07", name: "Exemplo", id: "prj-07-exemplo" }, "owner@example.com");
});
afterAll(async () => proxy?.dispose());

const req = (path: string, init: RequestInit = {}) => createApi(clock).request(`/api/v1${path}`, init, { DB: proxy.env.DB });
const post = (path: string, body: unknown) => req(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const flow = JSON.parse(readFileSync("tests/fixtures/flow.sample.json", "utf8"));

describe("Feature: project models (ADR-008)", () => {
  it("lists the available interface templates", async () => {
    const body = (await (await req("/templates")).json()) as { templates: { id: string; stages: number; fields: number }[] };
    expect(body.templates).toEqual([expect.objectContaining({ id: "diagnostico-processos", stages: 9, fields: 18 })]);
  });

  it("GIVEN a project WHEN a diagnostic is created from the template THEN it is DIAG-01, then DIAG-02, and audited", async () => {
    const a = (await (await post("/projects/prj-07-exemplo/models", { template: "diagnostico-processos" })).json()) as { model: { id: string; kind: string; data: { organization: { name: string } } } };
    expect(a.model).toMatchObject({ id: "DIAG-01", kind: "diagnostic", data: { organization: { name: "Exemplo" } } });
    const b = (await (await post("/projects/prj-07-exemplo/models", { template: "diagnostico-processos" })).json()) as { model: { id: string } };
    expect(b.model.id).toBe("DIAG-02");
    const events = await new ProjectService(proxy.env.DB, clock).events("prj-07-exemplo");
    expect(events[0]).toMatchObject({ action: "model.created" });
  });

  it("imports a flow; a second import conflicts unless replace=true; models stay inside their project", async () => {
    expect((await post("/projects/prj-07-exemplo/models", { import: flow, source: "import:flow.json" })).status).toBe(201);
    expect((await post("/projects/prj-07-exemplo/models", { import: flow })).status).toBe(409);
    expect((await post("/projects/prj-07-exemplo/models", { import: { ...flow, title: "v2" }, replace: true })).status).toBe(201);
    const m = (await (await req("/projects/prj-07-exemplo/models/FLW-01")).json()) as { model: { title: string; source: string } };
    expect(m.model.title).toBe("v2");
    expect((await req("/projects/default/models/FLW-01")).status).toBe(404);
    const list = (await (await req("/projects/prj-07-exemplo/models")).json()) as { models: { id: string; dataJson?: string }[] };
    expect(list.models.map((x) => x.id)).toEqual(["DIAG-01", "DIAG-02", "FLW-01"]);
    expect(list.models[0]).not.toHaveProperty("dataJson");
  });

  it("rejects unknown formats and templates", async () => {
    expect((await post("/projects/prj-07-exemplo/models", { import: { foo: 1 } })).status).toBe(400);
    expect((await post("/projects/prj-07-exemplo/models", { template: "nope" })).status).toBe(400);
    expect((await post("/projects/prj-99-nope/models", { template: "diagnostico-processos" })).status).toBe(404);
  });
});
