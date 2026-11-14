import { readdirSync, readFileSync } from "node:fs";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { fixtureSchema } from "~/domain/governance";
import { createApi } from "~/server/api/app";
import { authGate, machineMayCall, tokenMatches, type AuthVariables } from "~/server/auth/middleware";
import { SCOPE_DRIVE, SCOPE_SHEETS } from "~/server/auth/google";
import { parseConfig } from "~/server/config";
import { getDb } from "~/server/db/client";
import { buildSeedSql } from "~/server/db/seed";
import { ProjectService } from "~/server/projects";
import { storeSheetsCredential } from "~/server/sheets/sources";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
const clock = () => new Date("2026-11-14T12:00:00Z");
const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(5)));
const API_TOKEN = "t".repeat(48);
const ENV = {
  ENVIRONMENT: "production",
  GOOGLE_CLIENT_ID: "cid.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "client-secret",
  SESSION_SECRET: "s".repeat(40),
  TOKEN_ENCRYPTION_KEY: KEY,
  ALLOWED_EMAILS: "owner@example.com",
  ABAP_API_TOKEN: API_TOKEN,
};
const ROOT = "1RootFolderIdAbcdefghijklmnopqrst";
const SUB = "1SubFolderIdAbcdefghijklmnopqrstu";

/** Fake Google: token endpoint + Drive v3 (list, export, multipart upload). Records calls. */
const calls: { url: string; init?: RequestInit }[] = [];
const fakeGoogle = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push({ url, init });
  if (url.includes("oauth2.googleapis.com/token")) return Response.json({ access_token: "ya29.fake", expires_in: 3600, scope: "x" });
  if (url.startsWith("https://www.googleapis.com/upload/drive/v3/files")) return Response.json({ id: "1NewDocId", name: "Charter", webViewLink: "https://docs.google.com/document/d/1NewDocId/edit" });
  if (url.includes("/export?")) return new Response(url.includes("1DocA") ? "# Briefing\n\nPorto de Santos" : "# Pipeline\n\n23 atividades");
  const q = new URL(url).searchParams.get("q") ?? "";
  if (q.includes(ROOT))
    return Response.json({ files: [
      { id: "1DocA", name: "Briefing", mimeType: "application/vnd.google-apps.document", modifiedTime: "2026-11-13T09:00:00Z" },
      { id: SUB, name: "Operação", mimeType: "application/vnd.google-apps.folder", modifiedTime: "2026-11-13T09:00:00Z" },
      { id: "1Sheet", name: "PRJ-01 Governança", mimeType: "application/vnd.google-apps.spreadsheet", modifiedTime: "2026-11-13T09:00:00Z" },
    ] });
  if (q.includes(SUB)) return Response.json({ files: [{ id: "1DocB", name: "Pipeline Completo", mimeType: "application/vnd.google-apps.document", modifiedTime: "2026-11-12T09:00:00Z" }, { id: "1Pdf", name: "Manifesto.pdf", mimeType: "application/pdf", modifiedTime: "2026-11-12T09:00:00Z" }] });
  return new Response("unexpected " + url, { status: 500 });
}) as typeof fetch;

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
  await projects.create({ code: "PRJ-01", name: "CleanSea", id: "prj-01-cleansea" }, "owner@example.com");
  await projects.setLinks("prj-01-cleansea", { driveFolderId: ROOT }, "owner@example.com");
  await storeSheetsCredential(getDb(db), parseConfig(ENV), { email: "owner@example.com", scope: `openid ${SCOPE_SHEETS} ${SCOPE_DRIVE}`, refreshToken: "1//rt" }, clock().toISOString());
});
afterAll(async () => proxy?.dispose());

const app = () => {
  const a = new Hono<{ Bindings: { DB: D1Database }; Variables: AuthVariables }>();
  a.use("*", authGate());
  a.route("/", createApi(clock, { fetch: fakeGoogle }));
  return a;
};
const asOwner = async (path: string, init: RequestInit = {}) => {
  // Session cookie for an allowed account (same signer as production).
  const { createSession } = await import("~/server/auth/session");
  const token = await createSession({ email: "owner@example.com" }, ENV.SESSION_SECRET, clock().getTime());
  return app().request(`https://abap.test/api/v1${path}`, { ...init, headers: { ...(init.headers ?? {}), cookie: `gs_session=${encodeURIComponent(token)}` } }, { ...ENV, DB: proxy.env.DB });
};
const asMachine = (path: string, init: RequestInit = {}, token = API_TOKEN, env: object = ENV) =>
  app().request(`https://abap.test/api/v1${path}`, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } }, { ...env, DB: proxy.env.DB });

describe("Feature: client Drive folder in ABAP", () => {
  it("lists the folder tree (subfolders flattened with their path, folders omitted)", async () => {
    const body = (await (await asOwner("/projects/prj-01-cleansea/drive/files")).json()) as { files: { name: string; path: string }[] };
    expect(body.files.map((f) => `${f.path}|${f.name}`)).toEqual(["|Briefing", "|PRJ-01 Governança", "Operação|Pipeline Completo", "Operação|Manifesto.pdf"]);
  });

  it("reads a Google Doc as Markdown and refuses files outside the project folder", async () => {
    const ok = (await (await asOwner("/projects/prj-01-cleansea/drive/files/1DocB")).json()) as { markdown: string };
    expect(ok.markdown).toContain("23 atividades");
    expect((await asOwner("/projects/prj-01-cleansea/drive/files/1SomeoneElsesFile")).status).toBe(404);
  });

  it("exports every Google Doc with Markdown; other files are listed with markdown = null", async () => {
    const body = (await (await asOwner("/projects/prj-01-cleansea/drive/export")).json()) as { files: { name: string; markdown: string | null }[]; project: string };
    expect(body.project).toBe("prj-01-cleansea");
    expect(body.files.filter((f) => f.markdown !== null).map((f) => f.name)).toEqual(["Briefing", "Pipeline Completo"]);
    expect(body.files.find((f) => f.name === "Manifesto.pdf")?.markdown).toBeNull();
  });

  it("GIVEN no confirmation WHEN publishing THEN nothing is written; WITH confirmation THEN a new Doc is created and audited", async () => {
    const before = calls.filter((c) => c.url.includes("/upload/")).length;
    const bad = await asOwner("/projects/prj-01-cleansea/drive/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Charter", markdown: "# Charter" }) });
    expect(bad.status).toBe(400);
    expect(calls.filter((c) => c.url.includes("/upload/")).length).toBe(before);

    const res = await asOwner("/projects/prj-01-cleansea/drive/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Charter", markdown: "# Charter\n\nTexto", confirm: true }) });
    expect(res.status).toBe(201);
    const upload = calls.filter((c) => c.url.includes("/upload/")).at(-1)!;
    expect(String(upload.init?.body)).toContain(`"parents":["${ROOT}"]`);
    expect(String(upload.init?.body)).toContain("application/vnd.google-apps.document");
    expect(String(upload.init?.body)).toContain("Content-Type: text/markdown");
    const events = await new ProjectService(proxy.env.DB, clock).events("prj-01-cleansea");
    expect(events[0]).toMatchObject({ action: "drive.document.created", actor: "owner@example.com" });
  });

  it("detects and links the governance spreadsheet found in the folder", async () => {
    const body = (await (await asOwner("/projects/prj-01-cleansea/drive/detect-spreadsheet", { method: "POST" })).json()) as { linked: { name: string } };
    expect(body.linked.name).toBe("PRJ-01 Governança");
    expect((await new ProjectService(proxy.env.DB, clock).get("prj-01-cleansea"))?.spreadsheetId).toBe("1Sheet");
  });

  it("explains what is missing: folder not linked, or Drive scope not granted", async () => {
    const r = (await (await asOwner("/projects/default/drive/files")).json()) as { error: string };
    expect(r.error).toBe("drive_not_linked");
    await storeSheetsCredential(getDb(proxy.env.DB), parseConfig(ENV), { email: "owner@example.com", scope: `openid ${SCOPE_SHEETS}`, refreshToken: "1//rt" }, clock().toISOString());
    const s = await asOwner("/projects/prj-01-cleansea/drive/files");
    expect(s.status).toBe(409);
    expect(((await s.json()) as { error: string }).error).toBe("drive_scope_missing");
    await storeSheetsCredential(getDb(proxy.env.DB), parseConfig(ENV), { email: "owner@example.com", scope: `openid ${SCOPE_SHEETS} ${SCOPE_DRIVE}`, refreshToken: "1//rt" }, clock().toISOString());
  });
});

describe("Feature: machine token for docs:pull (read-only)", () => {
  it("may export Drive docs and list projects", async () => {
    expect((await asMachine("/projects/prj-01-cleansea/drive/export")).status).toBe(200);
    expect((await asMachine("/projects")).status).toBe(200);
  });
  it("may not write or read anything else", async () => {
    expect((await asMachine("/projects/prj-01-cleansea/drive/documents", { method: "POST", body: "{}" })).status).toBe(403);
    expect((await asMachine("/activities")).status).toBe(403);
    expect((await asMachine("/projects/prj-01-cleansea/links", { method: "PUT", body: "{}" })).status).toBe(403);
  });
  it("rejects a wrong token, and every token when none is configured", async () => {
    expect((await asMachine("/projects", {}, "x".repeat(48))).status).toBe(401);
    const { ABAP_API_TOKEN: _drop, ...noToken } = ENV;
    void _drop;
    expect((await asMachine("/projects", {}, API_TOKEN, noToken)).status).toBe(401);
  });
  it("helpers: constant-time compare and allow-list", async () => {
    expect(await tokenMatches("abc", "abc")).toBe(true);
    expect(await tokenMatches("abc", "abd")).toBe(false);
    expect(machineMayCall("GET", "/api/v1/projects/prj-01-cleansea/drive/files")).toBe(true);
    expect(machineMayCall("GET", "/api/v1/projects/prj-01-cleansea/drive/files/1DocA")).toBe(false);
    expect(machineMayCall("POST", "/api/v1/projects")).toBe(false);
  });
});
