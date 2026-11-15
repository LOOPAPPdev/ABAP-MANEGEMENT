/**
 * Studio (ADR-011): a shared area per project where the consultancy and invited client users see the
 * project's artifacts (for example a navigable prototype). Pure rules only: no I/O, no framework types.
 */
import { z } from "zod";

/** Label of an invited person. Every invited person is a guest: studio access only (staff = ALLOWED_EMAILS). */
export const MEMBER_ROLES = ["client", "consultant"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
export const MEMBER_STATUSES = ["invited", "active", "revoked"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "e-mail inválido");

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(MEMBER_ROLES).default("client"),
});

export const artifactSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "use minúsculas, números e hífens")
  .min(2)
  .max(60);

/** Relative file path inside an artifact: no "..", no leading slash, no backslash, safe characters only. */
export const artifactPathSchema = z
  .string()
  .max(200)
  .regex(/^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))[A-Za-z0-9._ \-/]+$/, "caminho inválido")
  .refine((p) => !p.endsWith("/"), "caminho inválido");

/** File types an artifact may hold (static web files only). */
export const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
};
export function contentTypeFor(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? null;
}

/** D1 keeps one value up to 2 MB; the limits stay below it. */
export const MAX_FILE_BYTES = 1_900_000;
export const MAX_ARTIFACT_BYTES = 8_000_000;
export const MAX_FILES = 50;

export const publishSchema = z
  .object({
    slug: artifactSlugSchema,
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).default(""),
    /** Mandatory notice shown above the artifact, e.g. "Protótipo — dados simulados". */
    notice: z.string().trim().min(2).max(200),
    entry: artifactPathSchema,
    files: z
      .array(z.object({ path: artifactPathSchema, content: z.string() }))
      .min(1)
      .max(MAX_FILES),
  })
  .superRefine((a, ctx) => {
    const paths = new Set<string>();
    let total = 0;
    for (const [i, f] of a.files.entries()) {
      if (paths.has(f.path)) ctx.addIssue({ code: "custom", path: ["files", i, "path"], message: "arquivo repetido" });
      paths.add(f.path);
      if (!contentTypeFor(f.path)) ctx.addIssue({ code: "custom", path: ["files", i, "path"], message: "tipo de arquivo não permitido" });
      const size = new TextEncoder().encode(f.content).length;
      if (size > MAX_FILE_BYTES) ctx.addIssue({ code: "custom", path: ["files", i, "content"], message: `arquivo maior que ${MAX_FILE_BYTES} bytes` });
      total += size;
    }
    if (total > MAX_ARTIFACT_BYTES) ctx.addIssue({ code: "custom", path: ["files"], message: `artefato maior que ${MAX_ARTIFACT_BYTES} bytes` });
    if (!paths.has(a.entry)) ctx.addIssue({ code: "custom", path: ["entry"], message: "o arquivo de entrada não está na lista" });
    else if (!a.entry.endsWith(".html")) ctx.addIssue({ code: "custom", path: ["entry"], message: "a entrada deve ser .html" });
  });
export type PublishInput = z.infer<typeof publishSchema>;

/** Who is signed in, for access decisions. Staff = e-mail in ALLOWED_EMAILS. Guests = invited people. */
export type Access = { kind: "staff" } | { kind: "guest"; projects: readonly string[] } | { kind: "none" };

/** Decides the access of a verified e-mail. A revoked membership gives no access. */
export function accessFor(email: string, staffEmails: readonly string[], memberships: readonly { projectId: string; status: MemberStatus }[]): Access {
  const e = email.trim().toLowerCase();
  if (staffEmails.includes(e)) return { kind: "staff" };
  const projects = [...new Set(memberships.filter((m) => m.status !== "revoked").map((m) => m.projectId))].sort();
  return projects.length ? { kind: "guest", projects } : { kind: "none" };
}

const GUEST_PUBLIC = [/^\/auth\/logout\/?$/, /^\/login\/?$/];

/**
 * Paths a guest may open: the studio pages and studio API of their own projects, logout.
 * Everything else (governance, models, Drive, settings, tokens, other projects) is denied.
 */
export function guestMayAccess(method: string, path: string, projects: readonly string[]): boolean {
  if (GUEST_PUBLIC.some((r) => r.test(path))) return true;
  if (path === "/" || path === "/studio" || path === "/studio/") return method === "GET";
  const m = path.match(/^\/(?:api\/v1\/)?studio\/([a-z0-9-]+)(?:\/|$)/);
  if (!m || !projects.includes(m[1]!)) return false;
  // Guests read only; member management and publishing are staff-only.
  return method === "GET" || method === "HEAD";
}

/** First page for a signed-in person: staff → dashboard, guest → the studio of their first project. */
export function homeFor(access: Access): string {
  if (access.kind === "guest") return access.projects.length === 1 ? `/studio/${access.projects[0]}` : "/studio";
  return "/dashboard";
}

/** Signed artifact URLs: the sandboxed iframe has an opaque origin and sends no session cookie. */
export const ARTIFACT_URL_TTL_S = 12 * 3600;
export interface ArtifactGrant {
  p: string; // project id
  a: string; // artifact slug
  exp: number; // unix seconds
}
