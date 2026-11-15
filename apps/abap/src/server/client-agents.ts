import { and, desc, eq } from "drizzle-orm";
import { buildClientPlugin, contentFingerprint, GENERATOR_VERSION, type PluginFile } from "~/domain/agents";
import { getDb } from "./db/client";
import { clientPlugins, projectEvents } from "./db/schema";
import { GovernanceService, type Clock } from "./governance-service";
import { ModelService } from "./models";
import type { Project } from "./projects";
import { hashToken as sha256 } from "./tokens";

export interface ClientAgent {
  projectId: string;
  revision: number;
  name: string;
  version: string;
  hash: string;
  generator: string;
  createdAt: string;
  createdBy: string;
  files: PluginFile[];
}
export type ClientAgentSummary = Omit<ClientAgent, "files">;

/** Agent factory: generates and stores the client's plugin from the project's current data. Audited. */
export class ClientAgentService {
  private readonly db;
  constructor(
    private readonly d1: D1Database,
    private readonly clock: Clock,
    private readonly project: Pick<Project, "id" | "code" | "name">,
  ) {
    this.db = getDb(d1);
  }

  async history(): Promise<ClientAgentSummary[]> {
    const rows = await this.db.select().from(clientPlugins).where(eq(clientPlugins.projectId, this.project.id)).orderBy(desc(clientPlugins.revision));
    return rows.map(({ filesJson: _f, ...r }) => r);
  }

  async get(revision?: number): Promise<ClientAgent | null> {
    const where = revision === undefined ? eq(clientPlugins.projectId, this.project.id) : and(eq(clientPlugins.projectId, this.project.id), eq(clientPlugins.revision, revision));
    const [r] = await this.db.select().from(clientPlugins).where(where).orderBy(desc(clientPlugins.revision)).limit(1);
    if (!r) return null;
    const { filesJson, ...rest } = r;
    return { ...rest, files: JSON.parse(filesJson) as PluginFile[] };
  }

  /** Builds the plugin from the current data. A new revision is stored only when the content changed. */
  async generate(actor: string): Promise<{ agent: ClientAgent; changed: boolean }> {
    const latest = await this.get();
    const models = await new ModelService(this.d1, this.clock, this.project.id).listFull();
    const activities = await new GovernanceService(this.db, this.clock, this.project.id).listEvaluated();
    const revision = (latest?.revision ?? 0) + 1;
    const plugin = buildClientPlugin({
      project: this.project,
      revision,
      org: models.flatMap((m) => (m.kind === "org" ? [{ id: m.id, data: m.data }] : [])),
      flows: models.flatMap((m) => (m.kind === "flow" ? [{ id: m.id, data: m.data }] : [])),
      diagnostics: models.flatMap((m) => (m.kind === "diagnostic" ? [{ id: m.id, templateId: m.templateId, data: m.data }] : [])),
      activities: activities.map((a) => ({ id: a.id, title: a.title, status: a.status, flag: a.flag, effectivelyDone: a.effectivelyDone, dependencyId: a.dependencyId, deliverable: a.deliverable })),
    });
    const hash = await sha256(contentFingerprint(plugin));
    if (latest && latest.hash === hash) return { agent: latest, changed: false };
    const now = this.clock().toISOString();
    const row = { projectId: this.project.id, revision, name: plugin.name, version: plugin.version, hash, filesJson: JSON.stringify(plugin.files), generator: GENERATOR_VERSION, createdAt: now, createdBy: actor };
    await this.db.batch([
      this.db.insert(clientPlugins).values(row),
      this.db.insert(projectEvents).values({ projectId: this.project.id, actor, action: "agent.generated", detail: `${plugin.name} v${plugin.version} (${plugin.files.length} arquivos, ${models.length} modelos)`, at: now }),
    ]);
    return { agent: (await this.get(revision))!, changed: true };
  }
}

/** Paths that differ between two revisions (added, removed, changed). */
export function diffFiles(prev: PluginFile[] | undefined, next: PluginFile[]) {
  const a = new Map((prev ?? []).map((f) => [f.path, f.content]));
  const b = new Map(next.map((f) => [f.path, f.content]));
  return {
    added: [...b.keys()].filter((p) => !a.has(p)),
    removed: [...a.keys()].filter((p) => !b.has(p)),
    changed: [...b.keys()].filter((p) => a.has(p) && a.get(p) !== b.get(p)),
  };
}
