import type { Context, Hono } from "hono";
import type { BlankSchema } from "hono/types";
import { projectIdSchema } from "~/domain/projects";
import type { Fetch } from "../auth/google";
import type { AuthVariables } from "../auth/middleware";
import { parseConfig } from "../config";
import { DriveService, DriveUnavailableError, newDocumentSchema } from "../drive/service";
import type { Clock } from "../governance-service";
import { ProjectService } from "../projects";
import { actorOf } from "./actor";

type Env = { Bindings: { DB: D1Database }; Variables: Partial<AuthVariables> };

/**
 * Drive endpoints of a project (its linked folder):
 *  GET  /projects/:id/drive/files               list (machine token allowed)
 *  GET  /projects/:id/drive/files/:fileId       one file + Markdown when it is a Google Doc
 *  GET  /projects/:id/drive/export              files + Markdown of every Google Doc (machine token allowed)
 *  POST /projects/:id/drive/documents           create a Google Doc (requires confirm: true; audited)
 *  POST /projects/:id/drive/detect-spreadsheet  link the governance spreadsheet found in the folder
 */
export function registerDriveRoutes(api: Hono<Env, BlankSchema, "/api/v1">, clock: Clock, f?: Fetch) {
  const drive = async (c: Context<Env>) => {
    const id = projectIdSchema.safeParse(c.req.param("id"));
    if (!id.success) return null;
    const project = await new ProjectService(c.env.DB, clock).get(id.data);
    return project ? new DriveService(c.env.DB, c.get("cfg") ?? parseConfig(c.env), project, clock, f) : null;
  };
  const fail = (c: Context<Env>, e: unknown) => {
    if (e instanceof DriveUnavailableError) return c.json({ ok: false, error: `drive_${e.reason}`, message: e.message }, e.reason === "not_linked" ? 404 : 409);
    console.error("drive error", e instanceof Error ? e.message : e);
    return c.json({ ok: false, error: "drive_failed", message: e instanceof Error ? e.message : String(e) }, 502);
  };

  api.get("/projects/:id/drive/files", async (c) => {
    const d = await drive(c);
    if (!d) return c.json({ ok: false, error: "not_found" }, 404);
    try {
      return c.json({ ok: true, files: await d.list() });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.get("/projects/:id/drive/files/:fileId", async (c) => {
    const d = await drive(c);
    if (!d) return c.json({ ok: false, error: "not_found" }, 404);
    try {
      return c.json({ ok: true, ...(await d.read(c.req.param("fileId"))) });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.get("/projects/:id/drive/export", async (c) => {
    const d = await drive(c);
    if (!d) return c.json({ ok: false, error: "not_found" }, 404);
    try {
      return c.json({ ok: true, ...(await d.exportAll()) });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post("/projects/:id/drive/documents", async (c) => {
    const d = await drive(c);
    if (!d) return c.json({ ok: false, error: "not_found" }, 404);
    const body = newDocumentSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ ok: false, error: "invalid_body", issues: body.error.issues }, 400);
    try {
      return c.json({ ok: true, document: await d.createDocument(body.data, actorOf(c)) }, 201);
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post("/projects/:id/drive/detect-spreadsheet", async (c) => {
    const d = await drive(c);
    if (!d) return c.json({ ok: false, error: "not_found" }, 404);
    try {
      return c.json({ ok: true, ...(await d.detectSpreadsheet(actorOf(c))) });
    } catch (e) {
      return fail(c, e);
    }
  });
}
