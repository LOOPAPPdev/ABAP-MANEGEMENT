import { asc, desc, eq } from "drizzle-orm";
import fixtureJson from "../../data/seed/activities.v1.json";
import { DEFAULT_PROJECT, type newProjectSchema } from "~/domain/projects";
import { fixtureSchema } from "~/domain/governance";
import type { z } from "zod";
import { getDb } from "./db/client";
import { deletedProjects, projectEvents, projects } from "./db/schema";
import { buildSeedSql, q } from "./db/seed";
import type { Clock } from "./governance-service";

export type Project = typeof projects.$inferSelect;
export class ProjectExistsError extends Error {}
export class ProjectDeleteError extends Error {
  constructor(
    readonly code: "protected" | "not_found" | "confirm_mismatch",
    message: string,
  ) {
    super(message);
  }
}

/** Tables holding rows of a project, in the order they must be deleted (children first). */
export const PROJECT_TABLES = ["evidence", "activity_events", "sheet_snapshots", "sync_runs", "client_plugins", "project_models", "project_events", "activities"] as const;
export type ProjectImpact = Record<(typeof PROJECT_TABLES)[number], number>;

const fixture = fixtureSchema.parse(fixtureJson);

/** Projects = one per client (slug = clients/<slug>) plus the platform's own "default" project. */
export class ProjectService {
  private readonly db;
  constructor(
    private readonly d1: D1Database,
    private readonly clock: Clock,
  ) {
    this.db = getDb(d1);
  }

  list(): Promise<Project[]> {
    return this.db.select().from(projects).orderBy(asc(projects.code), asc(projects.id));
  }

  async get(id: string): Promise<Project | null> {
    const [p] = await this.db.select().from(projects).where(eq(projects.id, id));
    return p ?? null;
  }

  /** Resolves the requested project, falling back to the default one. */
  async resolve(id: string | null | undefined): Promise<Project> {
    const p = (id && (await this.get(id))) || (await this.get(DEFAULT_PROJECT));
    if (!p) throw new Error("default project missing: run the seed");
    return p;
  }

  /** Creates the project with the 14 activities of the governance model, in one atomic batch. */
  async create(input: z.infer<typeof newProjectSchema>, actor: string): Promise<Project> {
    if (await this.get(input.id)) throw new ProjectExistsError(`projeto ${input.id} já existe`);
    const now = this.clock().toISOString();
    const stmts = buildSeedSql(fixture, now, input.name, input.id, input.code).map((s) => s.replace("INSERT OR IGNORE", "INSERT"));
    stmts.push(
      `INSERT INTO project_events (project_id, actor, action, detail, at) VALUES (${q(input.id)}, ${q(actor)}, 'project.created', ${q(`${input.code} ${input.name}`)}, ${q(now)});`,
    );
    await this.d1.batch(stmts.map((s) => this.d1.prepare(s)));
    return (await this.get(input.id))!;
  }

  /** Links the project's Drive folder and/or spreadsheet. `null` unlinks. Audited. */
  async setLinks(id: string, links: { driveFolderId?: string | null; spreadsheetId?: string | null }, actor: string) {
    const current = await this.get(id);
    if (!current) throw new Error(`projeto ${id} não existe`);
    const now = this.clock().toISOString();
    const set: Partial<Project> = { updatedAt: now };
    const changed: string[] = [];
    if (links.driveFolderId !== undefined && links.driveFolderId !== current.driveFolderId) {
      set.driveFolderId = links.driveFolderId;
      changed.push(links.driveFolderId ? "pasta do Drive vinculada" : "pasta do Drive desvinculada");
    }
    if (links.spreadsheetId !== undefined && links.spreadsheetId !== current.spreadsheetId) {
      set.spreadsheetId = links.spreadsheetId;
      changed.push(links.spreadsheetId ? "planilha vinculada" : "planilha desvinculada");
    }
    if (changed.length === 0) return current;
    await this.db.batch([
      this.db.update(projects).set(set).where(eq(projects.id, id)),
      this.db.insert(projectEvents).values({ projectId: id, actor, action: "project.links", detail: changed.join("; "), at: now }),
    ]);
    return (await this.get(id))!;
  }

  events(id: string, limit = 50) {
    return this.db.select().from(projectEvents).where(eq(projectEvents.projectId, id)).orderBy(desc(projectEvents.id)).limit(limit);
  }

  /** What deleting the project would remove (row counts per table). */
  async impact(id: string): Promise<ProjectImpact> {
    const rows = await this.d1.batch(PROJECT_TABLES.map((t) => this.d1.prepare(`SELECT count(*) AS n FROM ${t} WHERE project_id = ?`).bind(id)));
    return Object.fromEntries(PROJECT_TABLES.map((t, i) => [t, Number((rows[i]!.results[0] as { n: number }).n)])) as ProjectImpact;
  }

  /**
   * Permanently deletes a project and everything it holds, atomically (one D1 batch), and records who did it in
   * deleted_projects. The platform project is protected: the app needs it as the fallback project.
   * The caller must pass the project id as `confirm` (typed confirmation). Google Drive and Sheets are never touched.
   */
  async delete(id: string, confirm: string, actor: string): Promise<{ counts: ProjectImpact }> {
    if (id === DEFAULT_PROJECT) throw new ProjectDeleteError("protected", "O projeto da plataforma (default) não pode ser excluído: o app precisa dele como projeto de reserva.");
    const p = await this.get(id);
    if (!p) throw new ProjectDeleteError("not_found", `Projeto ${id} não existe.`);
    if (confirm.trim() !== p.id) throw new ProjectDeleteError("confirm_mismatch", `Para confirmar, digite o identificador do projeto: ${p.id}`);
    const counts = await this.impact(id);
    const now = this.clock().toISOString();
    await this.d1.batch([
      ...PROJECT_TABLES.map((t) => this.d1.prepare(`DELETE FROM ${t} WHERE project_id = ?`).bind(id)),
      this.d1.prepare("DELETE FROM app_settings WHERE key = ?").bind(`sheets.syncMode:${id}`),
      this.d1.prepare("DELETE FROM projects WHERE id = ?").bind(id),
      this.d1.prepare("INSERT INTO deleted_projects (project_id, code, name, deleted_by, deleted_at, counts_json) VALUES (?, ?, ?, ?, ?, ?)").bind(p.id, p.code, p.name, actor, now, JSON.stringify(counts)),
    ]);
    return { counts };
  }

  /** Permanent record of deleted projects, newest first. */
  async deletions(limit = 20) {
    return this.db.select().from(deletedProjects).orderBy(desc(deletedProjects.id)).limit(limit);
  }

  logEvent(id: string, actor: string, action: string, detail: string) {
    return this.db.insert(projectEvents).values({ projectId: id, actor, action, detail, at: this.clock().toISOString() });
  }
}
