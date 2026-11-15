import { and, asc, eq, ne } from "drizzle-orm";
import {
  accessFor,
  ARTIFACT_URL_TTL_S,
  contentTypeFor,
  type Access,
  type ArtifactGrant,
  type MemberRole,
  type MemberStatus,
  type PublishInput,
} from "~/domain/studio";
import { sha256b64url, signJson, verifyJson } from "./auth/crypto";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "./db/client";
import { projectEvents, studioArtifacts, studioFiles, studioMembers } from "./db/schema";
import type { Clock } from "./governance-service";

export type StudioMember = typeof studioMembers.$inferSelect;
export type StudioArtifact = typeof studioArtifacts.$inferSelect;
export class StudioError extends Error {
  constructor(
    readonly code: "not_found" | "is_staff" | "revoked" | "exists",
    message: string,
  ) {
    super(message);
  }
}

/** Access of a verified e-mail across all projects (staff list + studio memberships). */
export async function accessOf(d1: D1Database, email: string, staffEmails: readonly string[]): Promise<Access> {
  const e = email.trim().toLowerCase();
  if (staffEmails.includes(e)) return { kind: "staff" };
  const rows = await getDb(d1).select({ projectId: studioMembers.projectId, status: studioMembers.status }).from(studioMembers).where(eq(studioMembers.email, e));
  return accessFor(e, staffEmails, rows.map((r) => ({ projectId: r.projectId, status: r.status as MemberStatus })));
}

/** First sign-in of an invited person: invited → active (audited). Idempotent. */
export async function acceptInvites(d1: D1Database, email: string, now: string): Promise<void> {
  const db = getDb(d1);
  const e = email.trim().toLowerCase();
  const pending = await db.select().from(studioMembers).where(and(eq(studioMembers.email, e), eq(studioMembers.status, "invited")));
  if (!pending.length) return;
  await db.batch([
    db.update(studioMembers).set({ status: "active", acceptedAt: now }).where(and(eq(studioMembers.email, e), eq(studioMembers.status, "invited"))),
    ...pending.map((m) => db.insert(projectEvents).values({ projectId: m.projectId, actor: e, action: "studio.member.accepted", detail: e, at: now })),
  ] as unknown as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

/** Signs and verifies artifact URLs (the sandboxed iframe sends no cookie). */
export const signGrant = (g: Omit<ArtifactGrant, "exp">, secret: string, nowMs: number) =>
  signJson({ ...g, exp: Math.floor(nowMs / 1000) + ARTIFACT_URL_TTL_S } satisfies ArtifactGrant, secret);
export async function verifyGrant(token: string, secret: string, nowMs: number): Promise<ArtifactGrant | null> {
  const g = await verifyJson<ArtifactGrant>(token, secret);
  return g && typeof g.p === "string" && typeof g.a === "string" && typeof g.exp === "number" && g.exp * 1000 >= nowMs ? g : null;
}

/** Studio of one project: members (guests) and published artifacts. Every change writes project_events in the same batch. */
export class StudioService {
  private readonly db;
  constructor(
    private readonly d1: D1Database,
    private readonly clock: Clock,
    private readonly projectId: string,
  ) {
    this.db = getDb(d1);
  }

  members(): Promise<StudioMember[]> {
    return this.db.select().from(studioMembers).where(eq(studioMembers.projectId, this.projectId)).orderBy(asc(studioMembers.email));
  }

  /** Invites (or re-invites after revocation) a guest. Staff e-mails do not need an invitation. */
  async invite(email: string, role: MemberRole, actor: string, staffEmails: readonly string[]): Promise<StudioMember> {
    const e = email.trim().toLowerCase();
    if (staffEmails.includes(e)) throw new StudioError("is_staff", `${e} já é da equipe (acesso total): não precisa de convite.`);
    const now = this.clock().toISOString();
    const [current] = await this.db.select().from(studioMembers).where(and(eq(studioMembers.projectId, this.projectId), eq(studioMembers.email, e)));
    if (current && current.status !== "revoked") {
      if (current.role === role) throw new StudioError("exists", `${e} já foi convidado(a).`);
      await this.db.batch([
        this.db.update(studioMembers).set({ role }).where(and(eq(studioMembers.projectId, this.projectId), eq(studioMembers.email, e))),
        this.db.insert(projectEvents).values({ projectId: this.projectId, actor, action: "studio.member.role", detail: `${e}: ${current.role} → ${role}`, at: now }),
      ]);
    } else {
      const row = { projectId: this.projectId, email: e, role, status: "invited", invitedBy: actor, invitedAt: now, acceptedAt: null, revokedAt: null, revokedBy: null };
      await this.db.batch([
        current
          ? this.db.update(studioMembers).set(row).where(and(eq(studioMembers.projectId, this.projectId), eq(studioMembers.email, e)))
          : this.db.insert(studioMembers).values(row),
        this.db.insert(projectEvents).values({ projectId: this.projectId, actor, action: "studio.member.invited", detail: `${e} (${role})`, at: now }),
      ]);
    }
    return (await this.members()).find((m) => m.email === e)!;
  }

  /** Revokes a guest. Access ends on the next request (checked on every request). */
  async revoke(email: string, actor: string): Promise<void> {
    const e = email.trim().toLowerCase();
    const [current] = await this.db.select().from(studioMembers).where(and(eq(studioMembers.projectId, this.projectId), eq(studioMembers.email, e)));
    if (!current) throw new StudioError("not_found", `${e} não é membro deste studio.`);
    if (current.status === "revoked") throw new StudioError("revoked", `${e} já está sem acesso.`);
    const now = this.clock().toISOString();
    await this.db.batch([
      this.db.update(studioMembers).set({ status: "revoked", revokedAt: now, revokedBy: actor }).where(and(eq(studioMembers.projectId, this.projectId), eq(studioMembers.email, e))),
      this.db.insert(projectEvents).values({ projectId: this.projectId, actor, action: "studio.member.revoked", detail: e, at: now }),
    ]);
  }

  artifacts(includeArchived = false): Promise<StudioArtifact[]> {
    const where = includeArchived ? eq(studioArtifacts.projectId, this.projectId) : and(eq(studioArtifacts.projectId, this.projectId), ne(studioArtifacts.status, "archived"));
    return this.db.select().from(studioArtifacts).where(where).orderBy(asc(studioArtifacts.title));
  }

  async artifact(slug: string): Promise<StudioArtifact | null> {
    const [a] = await this.db.select().from(studioArtifacts).where(and(eq(studioArtifacts.projectId, this.projectId), eq(studioArtifacts.slug, slug)));
    return a ?? null;
  }

  async files(slug: string) {
    return this.db
      .select({ path: studioFiles.path, contentType: studioFiles.contentType, bytes: studioFiles.bytes, sha256: studioFiles.sha256 })
      .from(studioFiles)
      .where(and(eq(studioFiles.projectId, this.projectId), eq(studioFiles.slug, slug)))
      .orderBy(asc(studioFiles.path));
  }

  async file(slug: string, path: string) {
    const [f] = await this.db.select().from(studioFiles).where(and(eq(studioFiles.projectId, this.projectId), eq(studioFiles.slug, slug), eq(studioFiles.path, path)));
    return f ?? null;
  }

  /**
   * Publishes an artifact (input already validated by publishSchema). Replaces all files of the previous revision
   * atomically and bumps the revision. Unchanged content creates no revision.
   */
  async publish(input: PublishInput, actor: string): Promise<{ artifact: StudioArtifact; changed: boolean }> {
    const files = await Promise.all(
      input.files.map(async (f) => ({ ...f, contentType: contentTypeFor(f.path)!, bytes: new TextEncoder().encode(f.content).length, sha256: await sha256b64url(f.content) })),
    );
    const previous = await this.artifact(input.slug);
    if (previous) {
      const old = await this.files(input.slug);
      const sig = (xs: { path: string; sha256: string }[]) => xs.map((x) => `${x.path}:${x.sha256}`).sort().join("|");
      const same = sig(old) === sig(files) && previous.title === input.title && previous.description === input.description && previous.notice === input.notice && previous.entry === input.entry && previous.status === "published";
      if (same) return { artifact: previous, changed: false };
    }
    const now = this.clock().toISOString();
    const bytes = files.reduce((n, f) => n + f.bytes, 0);
    const meta = { title: input.title, description: input.description, notice: input.notice, entry: input.entry, bytes, status: "published", publishedBy: actor, publishedAt: now };
    const key = and(eq(studioArtifacts.projectId, this.projectId), eq(studioArtifacts.slug, input.slug));
    const revision = (previous?.revision ?? 0) + 1;
    await this.db.batch([
      this.db.delete(studioFiles).where(and(eq(studioFiles.projectId, this.projectId), eq(studioFiles.slug, input.slug))),
      ...files.map((f) =>
        this.db.insert(studioFiles).values({ projectId: this.projectId, slug: input.slug, path: f.path, contentType: f.contentType, content: f.content, bytes: f.bytes, sha256: f.sha256 }),
      ),
      previous ? this.db.update(studioArtifacts).set({ ...meta, revision }).where(key) : this.db.insert(studioArtifacts).values({ projectId: this.projectId, slug: input.slug, revision, ...meta }),
      this.db.insert(projectEvents).values({ projectId: this.projectId, actor, action: "studio.artifact.published", detail: `${input.slug} r${revision} (${files.length} arquivos, ${bytes} bytes)`, at: now }),
    ] as unknown as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
    return { artifact: (await this.artifact(input.slug))!, changed: true };
  }

  /** Hides an artifact from the studio (files are kept; publishing again restores it). */
  async archive(slug: string, actor: string): Promise<void> {
    const a = await this.artifact(slug);
    if (!a) throw new StudioError("not_found", `Artefato ${slug} não existe.`);
    const now = this.clock().toISOString();
    await this.db.batch([
      this.db.update(studioArtifacts).set({ status: "archived" }).where(and(eq(studioArtifacts.projectId, this.projectId), eq(studioArtifacts.slug, slug))),
      this.db.insert(projectEvents).values({ projectId: this.projectId, actor, action: "studio.artifact.archived", detail: slug, at: now }),
    ]);
  }
}
