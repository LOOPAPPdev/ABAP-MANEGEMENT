import { and, asc, eq } from "drizzle-orm";
import {
  applyStageAnswers,
  buildProcess,
  detectModelKind,
  DIAGNOSTIC_TEMPLATE,
  diagnosticSessionSchema,
  emptySession,
  flowModelSchema,
  getTemplate,
  orgModelSchema,
  type DiagnosticSession,
  type FlowModel,
  type ModelKind,
  type OrgModel,
} from "~/domain/models";
import { getDb } from "./db/client";
import { projectEvents, projectModels } from "./db/schema";
import type { Clock } from "./governance-service";

export class ModelError extends Error {
  constructor(
    readonly code: "invalid_model" | "model_exists" | "not_found" | "unknown_template" | "wrong_kind",
    message: string,
  ) {
    super(message);
  }
}

type Row = typeof projectModels.$inferSelect;
export type ModelSummary = Omit<Row, "dataJson">;
export type StoredModel =
  | (ModelSummary & { kind: "diagnostic"; data: DiagnosticSession })
  | (ModelSummary & { kind: "org"; data: OrgModel })
  | (ModelSummary & { kind: "flow"; data: FlowModel });

const parseByKind = (kind: ModelKind, raw: unknown) =>
  kind === "diagnostic" ? diagnosticSessionSchema.safeParse(raw) : kind === "org" ? orgModelSchema.safeParse(raw) : flowModelSchema.safeParse(raw);

function hydrate(r: Row): StoredModel {
  const { dataJson, ...rest } = r;
  const parsed = parseByKind(r.kind as ModelKind, JSON.parse(dataJson));
  if (!parsed.success) throw new ModelError("invalid_model", `${r.id}: dados armazenados inválidos`);
  return { ...rest, data: parsed.data } as StoredModel;
}

/** Project models (diagnostic sessions, org charts, flows). Every write is audited in project_events. */
export class ModelService {
  private readonly db;
  constructor(
    d1: D1Database,
    private readonly clock: Clock,
    private readonly projectId: string,
  ) {
    this.db = getDb(d1);
  }

  async list(): Promise<ModelSummary[]> {
    const rows = await this.db.select().from(projectModels).where(eq(projectModels.projectId, this.projectId)).orderBy(asc(projectModels.id));
    return rows.map(({ dataJson: _d, ...r }) => r);
  }

  async listFull(): Promise<StoredModel[]> {
    const rows = await this.db.select().from(projectModels).where(eq(projectModels.projectId, this.projectId)).orderBy(asc(projectModels.id));
    return rows.flatMap((r) => {
      try {
        return [hydrate(r)];
      } catch {
        return [];
      }
    });
  }

  async get(id: string): Promise<StoredModel | null> {
    const [r] = await this.db.select().from(projectModels).where(and(eq(projectModels.projectId, this.projectId), eq(projectModels.id, id)));
    return r ? hydrate(r) : null;
  }

  private async nextDiagnosticId(): Promise<string> {
    const ids = (await this.list()).map((m) => m.id).filter((i) => i.startsWith("DIAG-"));
    const n = ids.reduce((max, i) => Math.max(max, Number(i.slice(5))), 0) + 1;
    return `DIAG-${String(n).padStart(2, "0")}`;
  }

  private write(row: Omit<Row, "createdAt" | "updatedAt" | "updatedBy">, actor: string, action: string, detail: string, insert: boolean) {
    const now = this.clock().toISOString();
    const audit = this.db.insert(projectEvents).values({ projectId: this.projectId, actor, action, detail, at: now });
    const op = insert
      ? this.db.insert(projectModels).values({ ...row, createdAt: now, updatedAt: now, updatedBy: actor })
      : this.db
          .update(projectModels)
          .set({ title: row.title, status: row.status, dataJson: row.dataJson, updatedAt: now, updatedBy: actor })
          .where(and(eq(projectModels.projectId, this.projectId), eq(projectModels.id, row.id)));
    return this.db.batch([op, audit]);
  }

  /** New diagnostic session from a template (company name prefilled, marked "a validar"). */
  async createFromTemplate(templateId: string, company: string, actor: string): Promise<StoredModel> {
    const t = getTemplate(templateId);
    if (!t) throw new ModelError("unknown_template", `modelo ${templateId} não existe`);
    const id = await this.nextDiagnosticId();
    const now = this.clock().toISOString();
    const session = emptySession(company, `${this.projectId}-${id}`.toLowerCase(), now.slice(0, 10));
    await this.write(
      { projectId: this.projectId, id, kind: "diagnostic", templateId: t.id, title: `${t.name} · ${company}`, status: "rascunho", dataJson: JSON.stringify(session), source: `template:${t.id}@${t.templateVersion}` },
      actor,
      "model.created",
      `${id} a partir do modelo ${t.name} v${t.templateVersion}`,
      true,
    );
    return (await this.get(id))!;
  }

  /** Imports a JSON document (bundle session, ORG-xx, FLW-xx). `replace` overwrites an existing model with the same id. */
  async importModel(raw: unknown, source: string, actor: string, replace = false): Promise<StoredModel> {
    const kind = detectModelKind(raw);
    if (!kind) throw new ModelError("invalid_model", "formato não reconhecido: esperado sessão de diagnóstico, organograma (ORG-xx) ou fluxo (FLW-xx)");
    const parsed = parseByKind(kind, raw);
    if (!parsed.success) throw new ModelError("invalid_model", parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const data = parsed.data;
    let id: string;
    let title: string;
    let status: string;
    if (kind === "diagnostic") {
      const s = data as DiagnosticSession;
      id = replace && typeof (raw as { model_id?: unknown }).model_id === "string" ? String((raw as { model_id: string }).model_id) : await this.nextDiagnosticId();
      title = `Diagnóstico de processos · ${s.organization.name}`;
      status = s.process?.status ?? "rascunho";
    } else {
      const m = data as OrgModel | FlowModel;
      id = m.id;
      title = m.title;
      status = m.status;
    }
    const exists = await this.get(id);
    if (exists && !replace) throw new ModelError("model_exists", `${id} já existe neste projeto`);
    if (exists && exists.kind !== kind) throw new ModelError("wrong_kind", `${id} já existe com outro tipo`);
    await this.write(
      { projectId: this.projectId, id, kind, templateId: kind === "diagnostic" ? DIAGNOSTIC_TEMPLATE : null, title, status, dataJson: JSON.stringify(data), source: source.slice(0, 200) },
      actor,
      exists ? "model.replaced" : "model.imported",
      `${id} (${kind}) de ${source.slice(0, 120)}`,
      !exists,
    );
    return (await this.get(id))!;
  }

  private async diagnostic(id: string) {
    const m = await this.get(id);
    if (!m) throw new ModelError("not_found", `${id} não existe`);
    if (m.kind !== "diagnostic") throw new ModelError("wrong_kind", `${id} não é um diagnóstico`);
    const t = getTemplate(m.templateId ?? DIAGNOSTIC_TEMPLATE);
    if (!t) throw new ModelError("unknown_template", `modelo ${m.templateId} não existe`);
    return { m, t };
  }

  /** Saves the answers of one questionnaire stage. */
  async saveStage(id: string, stage: string, form: Record<string, string | undefined>, actor: string): Promise<StoredModel> {
    const { m, t } = await this.diagnostic(id);
    const today = this.clock().toISOString().slice(0, 10);
    const next = applyStageAnswers(m.data, t, stage, form, today);
    await this.write(
      { projectId: this.projectId, id, kind: "diagnostic", templateId: m.templateId, title: `${t.name} · ${next.organization.name}`, status: m.status, dataJson: JSON.stringify(next), source: m.source },
      actor,
      "model.answers",
      `${id} etapa ${stage}`,
      false,
    );
    return (await this.get(id))!;
  }

  /** Replaces the stored AS-IS process with the one derived from the current answers. */
  async regenerateProcess(id: string, actor: string): Promise<StoredModel> {
    const { m } = await this.diagnostic(id);
    const process = buildProcess(m.data);
    const next = { ...m.data, process };
    await this.write(
      { projectId: this.projectId, id, kind: "diagnostic", templateId: m.templateId, title: m.title, status: process.status, dataJson: JSON.stringify(next), source: m.source },
      actor,
      "model.process",
      `${id} diagrama gerado das respostas (${process.nodes.length} nós)`,
      false,
    );
    return (await this.get(id))!;
  }
}
