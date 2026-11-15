import { readdirSync, readFileSync } from "node:fs";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { fixtureSchema } from "~/domain/governance";
import { createApi } from "~/server/api/app";
import { authGate, type AuthVariables } from "~/server/auth/middleware";
import { buildSeedSql } from "~/server/db/seed";
import { createMcpRoute } from "~/server/mcp/route";
import { ProjectService } from "~/server/projects";
import { hashToken, TokenService } from "~/server/tokens";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
const clock = () => new Date("2026-11-15T10:00:00Z");
const LEGACY = "legacy-machine-token-0123456789abcdef";
const ENV = {
  ENVIRONMENT: "production",
  GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "x".repeat(24),
  SESSION_SECRET: "s".repeat(40),
  TOKEN_ENCRYPTION_KEY: "k".repeat(44),
  ALLOWED_EMAILS: "owner@example.com",
  ABAP_API_TOKEN: LEGACY,
};
let READ = "";
let WRITE = "";
let writeId = "";
const P = "prj-07-exemplo";

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false });
  const db = proxy.env.DB;
  for (const file of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
    const stmts = readFileSync(`migrations/${file}`, "utf8").split("--> statement-breakpoint");
    await db.batch(stmts.map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
  }
  const fixture = fixtureSchema.parse(JSON.parse(readFileSync("data/seed/activities.v1.json", "utf8")));
  await db.batch(buildSeedSql(fixture, clock().toISOString()).map((s) => db.prepare(s)));
  await new ProjectService(db, clock).create({ code: "PRJ-07", name: "Exemplo", id: P }, "owner@example.com");
  const tokens = new TokenService(db, clock);
  READ = (await tokens.create({ name: "ana-leitura", role: "read" }, "owner@example.com")).token;
  const w = await tokens.create({ name: "ana-laptop", role: "write" }, "owner@example.com");
  WRITE = w.token;
  writeId = w.info.id;
});
afterAll(async () => proxy?.dispose());

const app = () => {
  const a = new Hono<{ Bindings: { DB: D1Database }; Variables: AuthVariables }>();
  a.use("*", authGate());
  a.route("/", createApi(clock));
  a.route("/", createMcpRoute(clock));
  return a;
};
const env = () => ({ ...ENV, DB: proxy.env.DB });
let rpcId = 0;
async function rpc(token: string | null, method: string, params: unknown = {}) {
  const res = await app().request(
    "/mcp",
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    },
    env(),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}
async function call(token: string, name: string, args: Record<string, unknown> = {}) {
  const { body } = await rpc(token, "tools/call", { name, arguments: args });
  const r = body.result;
  return { isError: Boolean(r?.isError), text: String(r?.content?.[0]?.text ?? ""), data: r?.structuredContent?.result, rpcError: body.error };
}

describe("Feature: personal API tokens (ADR-009)", () => {
  it("stores only the hash; the plaintext has the abap_ prefix and 256 bits", async () => {
    expect(WRITE).toMatch(/^abap_[A-Za-z0-9_-]{43}$/);
    const rows = await proxy.env.DB.prepare("SELECT * FROM api_tokens").all<Record<string, string>>();
    expect(JSON.stringify(rows.results)).not.toContain(WRITE);
    expect(rows.results.map((r) => r.hash)).toContain(await hashToken(WRITE));
  });
});

describe("Feature: MCP endpoint /mcp (ADR-009)", () => {
  it("GIVEN no token or a wrong token THEN 401; a browser session does not open /mcp", async () => {
    expect((await rpc(null, "tools/list")).status).toBe(401);
    expect((await rpc("abap_" + "x".repeat(43), "tools/list")).status).toBe(401);
  });

  it("initialize returns the server info and the operating rules", async () => {
    const { status, body } = await rpc(READ, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
    expect(status).toBe(200);
    expect(body.result.serverInfo.name).toBe("abap");
    expect(body.result.instructions).toContain("DONE");
  });

  it("lists the tools with read/write annotations", async () => {
    const { body } = await rpc(READ, "tools/list");
    const tools = body.result.tools as { name: string; annotations: { readOnlyHint: boolean; destructiveHint?: boolean } }[];
    expect(tools).toHaveLength(27);
    expect(tools.every((t) => t.name.startsWith("abap_"))).toBe(true);
    expect(tools.find((t) => t.name === "abap_list_projects")!.annotations.readOnlyHint).toBe(true);
    expect(tools.find((t) => t.name === "abap_drive_create_document")!.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
  });

  it("GIVEN a read token THEN reads work and writes are refused", async () => {
    const who = await call(READ, "abap_whoami");
    expect(who.data).toMatchObject({ role: "read", actor: "token:ana-leitura (owner@example.com)" });
    const list = await call(READ, "abap_list_projects");
    expect((list.data as { id: string }[]).map((p) => p.id)).toContain(P);
    const w = await call(READ, "abap_create_diagnostic", { project: P });
    expect(w.isError).toBe(true);
    expect(w.text).toContain("só de leitura");
  });

  it("GIVEN a write token WHEN a diagnostic is created and answered THEN it is stored and audited with the token name", async () => {
    const m = await call(WRITE, "abap_create_diagnostic", { project: P });
    expect(m.data).toMatchObject({ id: "DIAG-01" });
    const s = await call(WRITE, "abap_save_diagnostic_stage", { project: P, model: "DIAG-01", stage: "E", answers: { activities: "1. Receber — Comercial\n2. Entregar" } });
    expect(s.isError).toBe(false);
    const g = await call(READ, "abap_get_model", { project: P, model: "DIAG-01" });
    expect((g.data as { mermaid: string }).mermaid).toContain("Receber · Comercial");
    const events = await new ProjectService(proxy.env.DB, clock).events(P);
    expect(events[0]).toMatchObject({ actor: "token:ana-laptop (owner@example.com)", action: "model.answers" });
  });

  it("never sets DONE or VERIFIED; other statuses are allowed", async () => {
    for (const status of ["DONE", "VERIFIED"]) {
      const r = await call(WRITE, "abap_change_status", { project: P, activity: "ACT-01", status });
      expect(r.isError).toBe(true);
      expect(r.text).toContain("reservado ao owner");
    }
    expect((await call(WRITE, "abap_change_status", { project: P, activity: "ACT-01", status: "IN PROGRESS" })).isError).toBe(false);
    const a = await call(READ, "abap_get_activity", { project: P, activity: "ACT-01" });
    expect((a.data as { activity: { status: string } }).activity.status).toBe("IN PROGRESS");
  });

  it("Drive publishing requires confirm=true (schema) and a linked folder", async () => {
    const noConfirm = await call(WRITE, "abap_drive_create_document", { project: P, title: "Relatório", markdown: "# x" });
    expect(noConfirm.isError || noConfirm.rpcError).toBeTruthy();
    const notLinked = await call(WRITE, "abap_drive_create_document", { project: P, title: "Relatório", markdown: "# x", confirm: true });
    expect(notLinked.isError).toBe(true);
  });

  it("unknown project gives a helpful error, not a crash", async () => {
    const r = await call(READ, "abap_list_models", { project: "prj-99-nada" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("abap_list_projects");
  });

  it("the legacy machine token is read-only on MCP", async () => {
    expect((await call(LEGACY, "abap_whoami")).data).toMatchObject({ role: "read", mode: "machine" });
    expect((await call(LEGACY, "abap_create_diagnostic", { project: P })).isError).toBe(true);
  });

  it("REST with a personal token: only the read allow-list", async () => {
    const h = { authorization: `Bearer ${WRITE}` };
    expect((await app().request(`/api/v1/projects/${P}/models`, { headers: h }, env())).status).toBe(200);
    expect((await app().request("/api/v1/activities", { headers: h }, env())).status).toBe(403);
    expect((await app().request(`/api/v1/projects/${P}/models`, { method: "POST", headers: { ...h, "content-type": "application/json" }, body: "{}" }, env())).status).toBe(403);
  });

  it("there is no delete tool, and a write token cannot DELETE a project over REST", async () => {
    const { body } = await rpc(READ, "tools/list");
    expect((body.result.tools as { name: string }[]).filter((t) => /delet|remov|exclu/i.test(t.name))).toEqual([]);
    const res = await app().request(`/api/v1/projects/${P}`, { method: "DELETE", headers: { authorization: `Bearer ${WRITE}`, "content-type": "application/json" }, body: JSON.stringify({ confirm: P }) }, env());
    expect(res.status).toBe(403);
    expect(await new ProjectService(proxy.env.DB, clock).get(P)).not.toBeNull();
  });

  it("GET /mcp is not allowed (stateless)", async () => {
    expect((await app().request("/mcp", { headers: { authorization: `Bearer ${READ}` } }, env())).status).toBe(405);
  });

  it("GIVEN a revoked token THEN it stops working immediately", async () => {
    expect(await new TokenService(proxy.env.DB, clock).revoke(writeId, "owner@example.com")).toBe(true);
    expect((await rpc(WRITE, "tools/list")).status).toBe(401);
    expect(await new TokenService(proxy.env.DB, clock).revoke(writeId, "owner@example.com")).toBe(false);
  });
});

describe("Feature: agent factory through the API and MCP (ADR-010)", () => {
  it("GIVEN a project WHEN the agent is generated twice THEN the second call creates no new revision", async () => {
    // New write token (the earlier one was revoked above).
    const t = (await new TokenService(proxy.env.DB, clock).create({ name: "fabrica", role: "write" }, "owner@example.com")).token;
    const a = await call(t, "abap_generate_client_agent", { project: P });
    expect(a.data).toMatchObject({ changed: true, name: `abap-${P}`, version: "1.1.0", revision: 1 });
    const b = await call(t, "abap_generate_client_agent", { project: P });
    expect(b.data).toMatchObject({ changed: false, revision: 1 });
    const got = await call(READ, "abap_get_client_agent", { project: P });
    expect((got.data as { files: { path: string }[] }).files.map((f) => f.path)).toContain("skills/exemplo-contexto/SKILL.md");
    // A data change produces revision 2.
    await call(t, "abap_change_status", { project: P, activity: "ACT-02", status: "IN PROGRESS" });
    expect((await call(t, "abap_generate_client_agent", { project: P })).data).toMatchObject({ changed: true, version: "1.2.0" });
    // REST read for plugin:pull (token allow-list).
    const res = await app().request(`/api/v1/projects/${P}/agent`, { headers: { authorization: `Bearer ${READ}` } }, env());
    expect(res.status).toBe(200);
    const events = await new ProjectService(proxy.env.DB, clock).events(P);
    expect(events[0]).toMatchObject({ action: "agent.generated", actor: "token:fabrica (owner@example.com)" });
  });
});
