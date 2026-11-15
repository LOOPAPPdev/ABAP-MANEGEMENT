import { Hono } from "hono";
import type { BlankSchema } from "hono/types";
import { projectIdSchema } from "~/domain/projects";
import { artifactPathSchema, artifactSlugSchema, emailSchema, inviteSchema, publishSchema } from "~/domain/studio";
import type { AppUser, AuthVariables } from "../auth/middleware";
import type { AppConfig } from "../config";
import { parseConfig } from "../config";
import type { Clock } from "../governance-service";
import { ProjectService } from "../projects";
import { signGrant, StudioError, StudioService, verifyGrant, type StudioArtifact } from "../studio";
import { actorOf } from "./actor";

type Env = { Bindings: { DB: D1Database }; Variables: Partial<AuthVariables> };

/** Secret for signed artifact URLs. The local development bypass has no session secret: it uses a fixed local value. */
export function grantSecret(cfg: AppConfig): string | null {
  return cfg.sessionSecret ?? (cfg.auth === "dev-bypass" ? "local-development-studio-secret-only" : null);
}

/** Signed URL of the artifact entry file, for the sandboxed iframe. */
export async function artifactUrl(cfg: AppConfig, a: Pick<StudioArtifact, "projectId" | "slug" | "entry">, nowMs: number): Promise<string | null> {
  const secret = grantSecret(cfg);
  if (!secret) return null;
  const token = await signGrant({ p: a.projectId, a: a.slug }, secret, nowMs);
  return `/studio/raw/${token}/${a.entry.split("/").map(encodeURIComponent).join("/")}`;
}

const isStaff = (u: AppUser | null | undefined) => u?.access?.kind === "staff" && u.mode !== "token" && u.mode !== "machine";

/**
 * Studio API (ADR-011):
 *  GET    /studio/:projectId                     artifacts (+ members for staff)
 *  POST   /studio/:projectId/members             invite { email, role }        staff session only
 *  DELETE /studio/:projectId/members/:email      revoke                        staff session only
 *  POST   /studio/:projectId/artifacts           publish (publishSchema)       staff session only
 *  POST   /studio/:projectId/artifacts/:slug/archive                           staff session only
 * Invitations and revocations are human-only (no MCP tool, no token). Publishing by token goes through /mcp.
 */
export function registerStudioRoutes(api: Hono<Env, BlankSchema, "/api/v1">, clock: Clock) {
  const project = async (c: { env: Env["Bindings"]; req: { param: (k: string) => string } }) => {
    const id = projectIdSchema.safeParse(c.req.param("projectId"));
    return id.success ? new ProjectService(c.env.DB, clock).get(id.data) : null;
  };

  api.get("/studio/:projectId", async (c) => {
    const p = await project(c);
    if (!p) return c.json({ ok: false, error: "not_found" }, 404);
    const cfg = c.get("cfg") ?? parseConfig(c.env);
    const svc = new StudioService(c.env.DB, clock, p.id);
    const artifacts = await Promise.all((await svc.artifacts()).map(async (a) => ({ ...a, url: await artifactUrl(cfg, a, clock().getTime()) })));
    const user = c.get("user");
    return c.json({ ok: true, project: { id: p.id, code: p.code, name: p.name }, artifacts, members: user?.access?.kind === "staff" ? await svc.members() : undefined });
  });

  api.post("/studio/:projectId/members", async (c) => {
    if (!isStaff(c.get("user"))) return c.json({ ok: false, error: "forbidden", message: "Só a equipe convida pessoas, pelo app." }, 403);
    const p = await project(c);
    if (!p) return c.json({ ok: false, error: "not_found" }, 404);
    const body = inviteSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ ok: false, error: "invalid_body", issues: body.error.issues }, 400);
    const cfg = c.get("cfg") ?? parseConfig(c.env);
    try {
      return c.json({ ok: true, member: await new StudioService(c.env.DB, clock, p.id).invite(body.data.email, body.data.role, actorOf(c), cfg.allowedEmails) }, 201);
    } catch (e) {
      if (e instanceof StudioError) return c.json({ ok: false, error: e.code, message: e.message }, 409);
      throw e;
    }
  });

  api.delete("/studio/:projectId/members/:email", async (c) => {
    if (!isStaff(c.get("user"))) return c.json({ ok: false, error: "forbidden" }, 403);
    const p = await project(c);
    const email = emailSchema.safeParse(decodeURIComponent(c.req.param("email")));
    if (!p || !email.success) return c.json({ ok: false, error: "not_found" }, 404);
    try {
      await new StudioService(c.env.DB, clock, p.id).revoke(email.data, actorOf(c));
      return c.json({ ok: true });
    } catch (e) {
      if (e instanceof StudioError) return c.json({ ok: false, error: e.code, message: e.message }, e.code === "not_found" ? 404 : 409);
      throw e;
    }
  });

  api.post("/studio/:projectId/artifacts", async (c) => {
    if (!isStaff(c.get("user"))) return c.json({ ok: false, error: "forbidden" }, 403);
    const p = await project(c);
    if (!p) return c.json({ ok: false, error: "not_found" }, 404);
    const body = publishSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ ok: false, error: "invalid_body", issues: body.error.issues.slice(0, 20) }, 400);
    const r = await new StudioService(c.env.DB, clock, p.id).publish(body.data, actorOf(c));
    return c.json({ ok: true, ...r }, r.changed ? 201 : 200);
  });

  api.post("/studio/:projectId/artifacts/:slug/archive", async (c) => {
    if (!isStaff(c.get("user"))) return c.json({ ok: false, error: "forbidden" }, 403);
    const p = await project(c);
    const slug = artifactSlugSchema.safeParse(c.req.param("slug"));
    if (!p || !slug.success) return c.json({ ok: false, error: "not_found" }, 404);
    try {
      await new StudioService(c.env.DB, clock, p.id).archive(slug.data, actorOf(c));
      return c.json({ ok: true });
    } catch (e) {
      if (e instanceof StudioError) return c.json({ ok: false, error: e.code, message: e.message }, 404);
      throw e;
    }
  });
}

/** Content-Security-Policy of artifact files: sandboxed (opaque origin, no app cookies, no API access). */
export const ARTIFACT_CSP = [
  "sandbox allow-scripts allow-forms allow-popups allow-modals",
  "default-src 'self' data: blob:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://unpkg.com https://cdn.jsdelivr.net",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

/**
 * GET /studio/raw/:token/<path> — files of a published artifact. Public path: the signed token (12 h) is the access
 * check, because the sandboxed iframe sends no session cookie. Archived artifacts are not served.
 */
export function createStudioRawRoute(clock: Clock) {
  const raw = new Hono<{ Bindings: { DB: D1Database }; Variables: Partial<AuthVariables> }>();
  raw.get("/studio/raw/:token/*", async (c) => {
    const cfg = c.get("cfg") ?? parseConfig(c.env);
    const secret = grantSecret(cfg);
    const grant = secret ? await verifyGrant(c.req.param("token"), secret, clock().getTime()) : null;
    if (!grant) return c.text("Link expirado ou inválido. Abra o artefato de novo pelo Studio.", 403);
    const prefix = `/studio/raw/${c.req.param("token")}/`;
    const rel = decodeURIComponent(new URL(c.req.url).pathname.slice(prefix.length));
    const path = artifactPathSchema.safeParse(rel);
    if (!path.success) return c.text("Not found", 404);
    const svc = new StudioService(c.env.DB, clock, grant.p);
    const a = await svc.artifact(grant.a);
    const f = a && a.status === "published" ? await svc.file(grant.a, path.data) : null;
    if (!f) return c.text("Not found", 404);
    return c.body(f.content, 200, {
      "Content-Type": f.contentType,
      "Content-Security-Policy": ARTIFACT_CSP,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, max-age=300",
      // The sandboxed frame has an opaque origin ("null"); the prototype fetches its own files. No credentials are involved.
      "Access-Control-Allow-Origin": "*",
      ETag: `"${f.sha256}"`,
    });
  });
  return raw;
}
