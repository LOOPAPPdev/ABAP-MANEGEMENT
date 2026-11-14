import type { Hono } from "hono";
import type { BlankSchema } from "hono/types";
import { z } from "zod";
import { getTemplate, modelIdSchema, TEMPLATES } from "~/domain/models";
import { projectIdSchema } from "~/domain/projects";
import type { AuthVariables } from "../auth/middleware";
import type { Clock } from "../governance-service";
import { ModelError, ModelService } from "../models";
import { ProjectService } from "../projects";
import { actorOf } from "./actor";

type Env = { Bindings: { DB: D1Database }; Variables: Partial<AuthVariables> };

const createBody = z.union([
  z.object({ template: z.string().max(60) }),
  z.object({ import: z.unknown(), source: z.string().max(200).default("api"), replace: z.boolean().default(false) }),
]);
const STATUS: Record<ModelError["code"], 400 | 404 | 409> = { invalid_model: 400, unknown_template: 400, wrong_kind: 400, model_exists: 409, not_found: 404 };

/**
 * Project models (ADR-008):
 *  GET /templates · GET /projects/:id/models · POST /projects/:id/models · GET /projects/:id/models/:modelId
 * GETs are also open to the read-only machine token (docs:pull exports models to the client area).
 */
export function registerModelRoutes(api: Hono<Env, BlankSchema, "/api/v1">, clock: Clock) {
  api.get("/templates", (c) => c.json({ ok: true, templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name, version: t.templateVersion, outputs: t.outputs, stages: t.questionnaire.stages.length, fields: t.questionnaire.field_count })) }));
  api.get("/templates/:id", (c) => {
    const t = getTemplate(c.req.param("id"));
    return t ? c.json({ ok: true, template: t }) : c.json({ ok: false, error: "not_found" }, 404);
  });

  const scope = async (c: { env: Env["Bindings"]; req: { param: (k: string) => string } }) => {
    const id = projectIdSchema.safeParse(c.req.param("id"));
    if (!id.success) return null;
    const project = await new ProjectService(c.env.DB, clock).get(id.data);
    return project ? { project, svc: new ModelService(c.env.DB, clock, project.id) } : null;
  };

  api.get("/projects/:id/models", async (c) => {
    const s = await scope(c);
    return s ? c.json({ ok: true, models: await s.svc.list() }) : c.json({ ok: false, error: "not_found" }, 404);
  });

  api.get("/projects/:id/models/:modelId", async (c) => {
    const s = await scope(c);
    const mid = modelIdSchema.safeParse(c.req.param("modelId"));
    if (!s || !mid.success) return c.json({ ok: false, error: "not_found" }, 404);
    const m = await s.svc.get(mid.data);
    return m ? c.json({ ok: true, model: m }) : c.json({ ok: false, error: "not_found" }, 404);
  });

  api.post("/projects/:id/models", async (c) => {
    const s = await scope(c);
    if (!s) return c.json({ ok: false, error: "not_found" }, 404);
    const body = createBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ ok: false, error: "invalid_body" }, 400);
    try {
      const m =
        "template" in body.data
          ? await s.svc.createFromTemplate(body.data.template, s.project.name, actorOf(c))
          : await s.svc.importModel(body.data.import, body.data.source, actorOf(c), body.data.replace);
      return c.json({ ok: true, model: m }, 201);
    } catch (e) {
      if (e instanceof ModelError) return c.json({ ok: false, error: e.code, message: e.message }, STATUS[e.code]);
      throw e;
    }
  });
}
