import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "../db/client";
import { GovernanceService, NotFoundError, systemClock, type Clock } from "../governance-service";
import { activityIdSchema, actorSchema, evidenceInputSchema, statusChangeSchema } from "./schemas";

type Bindings = { DB: D1Database };

const issues = (e: z.ZodError) => e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));

/**
 * Versioned HTTP API. Authentication is not designed yet (decision log D-006):
 * the actor comes from the X-Actor header and defaults to "local-dev".
 */
export function createApi(clock: Clock = systemClock) {
  const api = new Hono<{ Bindings: Bindings }>().basePath("/api/v1");
  const service = (env: Bindings) => new GovernanceService(getDb(env.DB), clock);

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

  api.get("/activities", async (c) => c.json({ ok: true, activities: await service(c.env).listEvaluated() }));

  api.get("/activities/:id", async (c) => {
    const id = activityIdSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ ok: false, error: "invalid_id", issues: issues(id.error) }, 400);
    return c.json({ ok: true, ...(await service(c.env).getActivity(id.data)) });
  });

  api.patch("/activities/:id/status", async (c) => {
    const id = activityIdSchema.safeParse(c.req.param("id"));
    const body = statusChangeSchema.safeParse(await c.req.json().catch(() => null));
    if (!id.success) return c.json({ ok: false, error: "invalid_id", issues: issues(id.error) }, 400);
    if (!body.success) return c.json({ ok: false, error: "invalid_body", issues: issues(body.error) }, 400);
    const actor = actorSchema.parse(c.req.header("x-actor"));
    return c.json({ ok: true, ...(await service(c.env).changeStatus(id.data, body.data.status, actor)) });
  });

  api.post("/activities/:id/evidence", async (c) => {
    const id = activityIdSchema.safeParse(c.req.param("id"));
    const body = evidenceInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!id.success) return c.json({ ok: false, error: "invalid_id", issues: issues(id.error) }, 400);
    if (!body.success) return c.json({ ok: false, error: "invalid_body", issues: issues(body.error) }, 400);
    const actor = actorSchema.parse(c.req.header("x-actor"));
    return c.json({ ok: true, ...(await service(c.env).addEvidence(id.data, body.data, actor)) }, 201);
  });

  api.get("/evidence", async (c) => c.json({ ok: true, evidence: await service(c.env).listEvidence() }));

  api.get("/dashboard", async (c) => c.json({ ok: true, dashboard: await service(c.env).dashboard() }));

  api.notFound((c) => c.json({ ok: false, error: "not_found" }, 404));

  return api;
}
