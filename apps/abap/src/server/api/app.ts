import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "../db/client";
import type { AuthVariables } from "../auth/middleware";
import type { Fetch } from "../auth/google";
import { GovernanceService, NotFoundError, systemClock, type Clock } from "../governance-service";
import { projectOf } from "./project-context";
import { registerProjectRoutes } from "./projects-routes";
import { registerSheetsRoutes } from "./sheets-routes";
import { actorOf } from "./actor";
import { activityIdSchema, evidenceInputSchema, statusChangeSchema } from "./schemas";

type Bindings = { DB: D1Database };
const issues = (e: z.ZodError) => e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));

/**
 * Versioned HTTP API. Authentication happens in the Worker gate (src/server/auth/middleware.ts);
 * mutations record the signed-in e-mail as actor (X-Actor only in the local development bypass).
 */
export function createApi(clock: Clock = systemClock, deps: { fetch?: Fetch } = {}) {
  const api = new Hono<{ Bindings: Bindings; Variables: Partial<AuthVariables> }>().basePath("/api/v1");
  // Every governance endpoint works on one project: ?project=<id>, else the current-project cookie, else "default".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = async (c: any) => new GovernanceService(getDb(c.env.DB), clock, (await projectOf(c, clock)).id);

  api.onError((err, c) => {
    if (err instanceof NotFoundError) return c.json({ ok: false, error: "not_found", message: err.message }, 404);
    console.error(err);
    return c.json({ ok: false, error: "internal_error" }, 500);
  });

  api.get("/health", async (c) => {
    try {
      await getDb(c.env.DB).run(sql`SELECT 1`);
      return c.json({ ok: true, db: "up", at: clock().toISOString() });
    } catch {
      return c.json({ ok: false, db: "down" }, 503);
    }
  });

  api.get("/activities", async (c) => c.json({ ok: true, activities: await (await svc(c)).listEvaluated() }));

  api.get("/activities/:id", async (c) => {
    const id = activityIdSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ ok: false, error: "invalid_id", issues: issues(id.error) }, 400);
    return c.json({ ok: true, ...(await (await svc(c)).getActivity(id.data)) });
  });

  api.patch("/activities/:id/status", async (c) => {
    const id = activityIdSchema.safeParse(c.req.param("id"));
    const body = statusChangeSchema.safeParse(await c.req.json().catch(() => null));
    if (!id.success) return c.json({ ok: false, error: "invalid_id", issues: issues(id.error) }, 400);
    if (!body.success) return c.json({ ok: false, error: "invalid_body", issues: issues(body.error) }, 400);
    return c.json({ ok: true, ...(await (await svc(c)).changeStatus(id.data, body.data.status, actorOf(c))) });
  });

  api.post("/activities/:id/evidence", async (c) => {
    const id = activityIdSchema.safeParse(c.req.param("id"));
    const body = evidenceInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!id.success) return c.json({ ok: false, error: "invalid_id", issues: issues(id.error) }, 400);
    if (!body.success) return c.json({ ok: false, error: "invalid_body", issues: issues(body.error) }, 400);
    return c.json({ ok: true, ...(await (await svc(c)).addEvidence(id.data, body.data, actorOf(c))) }, 201);
  });

  api.get("/evidence", async (c) => c.json({ ok: true, evidence: await (await svc(c)).listEvidence() }));

  api.get("/dashboard", async (c) => c.json({ ok: true, dashboard: await (await svc(c)).dashboard() }));

  registerProjectRoutes(api, clock);
  registerSheetsRoutes(api, clock, deps.fetch);

  api.notFound((c) => c.json({ ok: false, error: "not_found" }, 404));

  return api;
}
