import type { Hono } from "hono";
import type { BlankSchema } from "hono/types";
import { z } from "zod";
import { newProjectSchema, parseDriveFolderId, parseSpreadsheetId, projectIdSchema } from "~/domain/projects";
import type { AuthVariables } from "../auth/middleware";
import type { Clock } from "../governance-service";
import { ProjectExistsError, ProjectService } from "../projects";
import { actorOf } from "./actor";

type Env = { Bindings: { DB: D1Database }; Variables: Partial<AuthVariables> };

const linksBody = z.object({
  driveFolder: z.string().max(500).nullable().optional(),
  spreadsheet: z.string().max(500).nullable().optional(),
});

/**
 * Projects (one per client):
 *  GET /projects · POST /projects · GET /projects/:id · PUT /projects/:id/links
 * Google IDs are stored in D1 only. Link changes are audited in project_events.
 */
export function registerProjectRoutes(api: Hono<Env, BlankSchema, "/api/v1">, clock: Clock) {
  const svc = (env: Env["Bindings"]) => new ProjectService(env.DB, clock);

  api.get("/projects", async (c) => c.json({ ok: true, projects: await svc(c.env).list() }));

  api.post("/projects", async (c) => {
    const body = newProjectSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ ok: false, error: "invalid_body", issues: body.error.issues }, 400);
    try {
      return c.json({ ok: true, project: await svc(c.env).create(body.data, actorOf(c)) }, 201);
    } catch (e) {
      if (e instanceof ProjectExistsError) return c.json({ ok: false, error: "project_exists", message: e.message }, 409);
      throw e;
    }
  });

  api.get("/projects/:id", async (c) => {
    const id = projectIdSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ ok: false, error: "invalid_id" }, 400);
    const p = await svc(c.env).get(id.data);
    return p ? c.json({ ok: true, project: p }) : c.json({ ok: false, error: "not_found" }, 404);
  });

  api.put("/projects/:id/links", async (c) => {
    const id = projectIdSchema.safeParse(c.req.param("id"));
    const body = linksBody.safeParse(await c.req.json().catch(() => null));
    if (!id.success || !body.success) return c.json({ ok: false, error: "invalid_body" }, 400);
    const links: { driveFolderId?: string | null; spreadsheetId?: string | null } = {};
    if (body.data.driveFolder !== undefined) {
      links.driveFolderId = body.data.driveFolder ? parseDriveFolderId(body.data.driveFolder) : null;
      if (body.data.driveFolder && !links.driveFolderId) return c.json({ ok: false, error: "invalid_drive_folder" }, 400);
    }
    if (body.data.spreadsheet !== undefined) {
      links.spreadsheetId = body.data.spreadsheet ? parseSpreadsheetId(body.data.spreadsheet) : null;
      if (body.data.spreadsheet && !links.spreadsheetId) return c.json({ ok: false, error: "invalid_spreadsheet" }, 400);
    }
    const s = svc(c.env);
    if (!(await s.get(id.data))) return c.json({ ok: false, error: "not_found" }, 404);
    return c.json({ ok: true, project: await s.setLinks(id.data, links, actorOf(c)) });
  });
}
