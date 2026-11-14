import type { Context, Hono } from "hono";
import type { BlankSchema } from "hono/types";
import { z } from "zod";
import { SYNC_MODES } from "~/domain/governance";
import type { Fetch } from "../auth/google";
import type { AuthVariables } from "../auth/middleware";
import { parseConfig } from "../config";
import { getDb } from "../db/client";
import { appSettings } from "../db/schema";
import type { Clock } from "../governance-service";
import { syncServiceFor } from "../sheets/factory";
import { DEV_SHEET_OVERRIDES, sheetsConnection, SheetsNotConnectedError } from "../sheets/sources";
import { actorOf } from "./actor";

type Env = { Bindings: { DB: D1Database }; Variables: Partial<AuthVariables> };

const syncBody = z.object({ resolve: z.array(z.string().regex(/^ACT-\d{2}:(status|priority|owner|due|notes)$/)).max(200).default([]) });
const modeBody = z.object({ mode: z.enum(SYNC_MODES) });
const overridesBody = z.object({
  overrides: z.record(z.string().regex(/^ACT-\d{2}$/), z.partialRecord(z.enum(["Status", "Priority", "Owner", "Due", "Evidence", "Notes"]), z.string().max(2000))),
});

/**
 * Google Sheets endpoints (read-only towards Google):
 *  GET  /me · GET /sheets/status · GET /sheets/preview · POST /sheets/sync · PUT /sheets/mode
 *  POST /dev/sheet-overrides (development bypass only: simulates a cell edit in the fixture source)
 */
export function registerSheetsRoutes(api: Hono<Env, BlankSchema, "/api/v1">, clock: Clock, f?: Fetch) {
  const cfgOf = (c: Context<Env>) => c.get("cfg") ?? parseConfig(c.env);
  const svc = (c: Context<Env>) => syncServiceFor(cfgOf(c), c.env.DB, clock, f);
  const notConnected = (c: Context<Env>, e: unknown) =>
    e instanceof SheetsNotConnectedError ? c.json({ ok: false, error: "sheets_not_connected", message: e.message }, 409) : null;

  api.get("/me", (c) => c.json({ ok: true, user: c.get("user") ?? null, auth: cfgOf(c).auth }));

  api.get("/sheets/status", async (c) => {
    const cfg = cfgOf(c);
    const s = svc(c);
    return c.json({
      ok: true,
      mode: await s.getMode(),
      source: cfg.auth === "dev-bypass" ? "fixture" : "google",
      spreadsheetConfigured: Boolean(cfg.spreadsheetId),
      connection: await sheetsConnection(getDb(c.env.DB)),
      lastRun: await s.lastRun(),
    });
  });

  api.get("/sheets/preview", async (c) => {
    try {
      return c.json({ ok: true, preview: await svc(c).preview() });
    } catch (e) {
      return notConnected(c, e) ?? c.json({ ok: false, error: "sheets_read_failed", message: e instanceof Error ? e.message : String(e) }, 502);
    }
  });

  api.post("/sheets/sync", async (c) => {
    const body = syncBody.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ ok: false, error: "invalid_body", issues: body.error.issues }, 400);
    const s = svc(c);
    try {
      return c.json({ ok: true, result: await s.sync({ mode: "manual", actor: actorOf(c), resolve: body.data.resolve }) });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await s.recordFailure("manual", actorOf(c), message);
      return notConnected(c, e) ?? c.json({ ok: false, error: "sheets_sync_failed", message }, 502);
    }
  });

  api.put("/sheets/mode", async (c) => {
    const body = modeBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ ok: false, error: "invalid_body", issues: body.error.issues }, 400);
    await svc(c).setMode(body.data.mode, actorOf(c));
    return c.json({ ok: true, mode: body.data.mode });
  });

  api.post("/dev/sheet-overrides", async (c) => {
    if (cfgOf(c).auth !== "dev-bypass") return c.json({ ok: false, error: "not_found" }, 404);
    const body = overridesBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ ok: false, error: "invalid_body", issues: body.error.issues }, 400);
    const row = { key: DEV_SHEET_OVERRIDES, value: JSON.stringify(body.data.overrides), updatedAt: clock().toISOString(), updatedBy: "dev" };
    await getDb(c.env.DB).insert(appSettings).values(row).onConflictDoUpdate({ target: appSettings.key, set: row });
    return c.json({ ok: true });
  });
}
