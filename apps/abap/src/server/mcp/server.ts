/**
 * ABAP MCP server (ADR-009). Stateless Streamable HTTP on the Worker at /mcp.
 * Tools call the same services as the app; every write records the caller as actor.
 * Guardrails: never sets DONE/VERIFIED (the owner does it with evidence); Drive writes need confirm=true;
 * write tools need a token with role "write".
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { EVIDENCE_KINDS, STATUSES, type Status } from "~/domain/governance";
import {
  adaptivePlan,
  DIAGNOSTIC_TEMPLATE,
  gapsOf,
  getTemplate,
  modelIdSchema,
  processOf,
  progressOf,
  TEMPLATES,
  toMermaid,
} from "~/domain/models";
import { driveFolderUrl, newProjectSchema, parseDriveFolderId, parseSpreadsheetId, projectIdSchema, spreadsheetUrl } from "~/domain/projects";
import { evidenceInputSchema } from "../api/schemas";
import type { Fetch } from "../auth/google";
import type { AppUser } from "../auth/middleware";
import type { AppConfig } from "../config";
import { getDb } from "../db/client";
import { DriveService } from "../drive/service";
import { GovernanceService, type Clock } from "../governance-service";
import { ModelService } from "../models";
import { ProjectService, type Project } from "../projects";
import { syncServiceFor } from "../sheets/factory";

export interface McpContext {
  db: D1Database;
  cfg: AppConfig;
  clock: Clock;
  user: AppUser;
  fetch?: Fetch;
}

export const MCP_VERSION = "1.0.0";
/** Completion statuses reserved for the owner (with evidence). */
export const OWNER_ONLY_STATUSES: readonly Status[] = ["DONE", "VERIFIED"];

class ToolError extends Error {}
const ok = (data: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: { result: data } as Record<string, unknown> });
const fail = (message: string): CallToolResult => ({ isError: true, content: [{ type: "text", text: message }] });

const project = z.string().describe("Identificador do projeto (ex.: prj-01-cleansea). Use abap_list_projects.");
const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

export function buildMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer(
    { name: "abap", version: MCP_VERSION },
    {
      instructions:
        "ABAP é a plataforma de serviços da consultoria: projetos de clientes, 14 atividades de governança (ACT-01…ACT-14), modelos (DIAG/ORG/FLW) e pasta do Drive de cada cliente. " +
        "Regras: não marque atividades DONE/VERIFIED (o owner faz com evidência); não invente fatos do cliente; dados 'não validado' continuam marcados; " +
        "antes de publicar no Drive do cliente, mostre o conteúdo ao usuário e peça confirmação.",
    },
  );
  const projects = new ProjectService(ctx.db, ctx.clock);
  const actor = ctx.user.email;
  const canWrite = ctx.user.role !== "read";

  const getProject = async (id: string): Promise<Project> => {
    const p = projectIdSchema.safeParse(id);
    const found = p.success ? await projects.get(p.data) : null;
    if (!found) throw new ToolError(`Projeto "${id}" não existe. Use abap_list_projects.`);
    return found;
  };
  const gov = (p: Project) => new GovernanceService(getDb(ctx.db), ctx.clock, p.id);
  const models = (p: Project) => new ModelService(ctx.db, ctx.clock, p.id);
  const drive = (p: Project) => new DriveService(ctx.db, ctx.cfg, p, ctx.clock, ctx.fetch);

  type Shape = Record<string, z.ZodType>;
  const tool = <S extends Shape>(
    name: string,
    meta: { title: string; description: string; write?: boolean; annotations?: Record<string, boolean> },
    shape: S,
    run: (args: z.infer<z.ZodObject<S>>) => Promise<unknown>,
  ) =>
    server.registerTool(
      name,
      { title: meta.title, description: meta.description, inputSchema: shape, annotations: { title: meta.title, ...(meta.write ? WRITE : READ), ...meta.annotations } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (async (args: any) => {
        if (meta.write && !canWrite) return fail("Este token é só de leitura (role read). Crie um token com role write em Settings → Tokens de API.");
        try {
          return ok(await run(args));
        } catch (e) {
          if (e instanceof ToolError) return fail(e.message);
          return fail(e instanceof Error ? e.message : String(e));
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    );

  // ---------- Projects ----------
  tool("abap_whoami", { title: "Quem sou eu", description: "Mostra a identidade e a permissão (read/write) desta conexão." }, {}, async () => ({ actor, mode: ctx.user.mode, role: canWrite ? "write" : "read" }));

  tool("abap_list_projects", { title: "Listar projetos", description: "Lista os projetos (um por cliente) com código, nome e se a pasta do Drive e a planilha estão vinculadas." }, {}, async () =>
    (await projects.list()).map((p) => ({ id: p.id, code: p.code, name: p.name, status: p.status, driveLinked: Boolean(p.driveFolderId), spreadsheetLinked: Boolean(p.spreadsheetId) })),
  );

  tool("abap_get_project", { title: "Ver projeto", description: "Dados do projeto, links do Drive/planilha e últimos eventos do histórico." }, { project }, async ({ project: id }) => {
    const p = await getProject(id);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
      driveUrl: p.driveFolderId ? driveFolderUrl(p.driveFolderId) : null,
      spreadsheetUrl: p.spreadsheetId ? spreadsheetUrl(p.spreadsheetId) : null,
      history: await projects.events(p.id, 20),
    };
  });

  tool(
    "abap_create_project",
    { title: "Criar projeto", description: "Cria o projeto de um cliente com as 14 atividades. template='diagnostico-processos' cria também o DIAG-01.", write: true },
    { code: z.string().describe("PRJ-NN"), name: z.string(), id: z.string().describe("prj-NN-nome (igual a clients/<id>)"), template: z.enum(["diagnostico-processos"]).optional() },
    async ({ code, name, id, template }) => {
      const input = newProjectSchema.safeParse({ code, name, id });
      if (!input.success) throw new ToolError(input.error.issues.map((i) => i.message).join("; "));
      const p = await projects.create(input.data, actor);
      const model = template ? await models(p).createFromTemplate(template, p.name, actor) : null;
      return { project: { id: p.id, code: p.code, name: p.name }, model: model ? { id: model.id, title: model.title } : null };
    },
  );

  tool(
    "abap_link_project",
    { title: "Vincular pasta e planilha", description: "Vincula (ou desvincula com string vazia) a pasta do Google Drive e/ou a planilha de governança do projeto. Aceita link ou ID.", write: true },
    { project, driveFolder: z.string().optional(), spreadsheet: z.string().optional() },
    async ({ project: id, driveFolder, spreadsheet }) => {
      const p = await getProject(id);
      const links: { driveFolderId?: string | null; spreadsheetId?: string | null } = {};
      if (driveFolder !== undefined) {
        links.driveFolderId = driveFolder ? parseDriveFolderId(driveFolder) : null;
        if (driveFolder && !links.driveFolderId) throw new ToolError("Link da pasta do Drive inválido.");
      }
      if (spreadsheet !== undefined) {
        links.spreadsheetId = spreadsheet ? parseSpreadsheetId(spreadsheet) : null;
        if (spreadsheet && !links.spreadsheetId) throw new ToolError("Link da planilha inválido.");
      }
      const u = await projects.setLinks(p.id, links, actor);
      return { driveLinked: Boolean(u.driveFolderId), spreadsheetLinked: Boolean(u.spreadsheetId) };
    },
  );

  // ---------- Governance ----------
  tool("abap_dashboard", { title: "Painel de governança", description: "Progresso (DONE com evidência), bloqueios e alertas das 14 atividades do projeto." }, { project }, async ({ project: id }) => gov(await getProject(id)).dashboard());

  tool("abap_list_activities", { title: "Listar atividades", description: "As 14 atividades com status, flag, dependência, responsável, prazo e evidências." }, { project }, async ({ project: id }) => gov(await getProject(id)).listEvaluated());

  tool("abap_get_activity", { title: "Ver atividade", description: "Uma atividade (ACT-nn) com critérios de aceite, entregável, evidências e histórico." }, { project, activity: z.string().regex(/^ACT-\d{2}$/) }, async ({ project: id, activity }) => gov(await getProject(id)).getActivity(activity));

  tool(
    "abap_change_status",
    { title: "Mudar status", description: `Muda o status de uma atividade. Nunca ${OWNER_ONLY_STATUSES.join("/")}: esses ficam com o owner, com evidência.`, write: true },
    { project, activity: z.string().regex(/^ACT-\d{2}$/), status: z.enum(STATUSES) },
    async ({ project: id, activity, status }) => {
      if (OWNER_ONLY_STATUSES.includes(status)) throw new ToolError(`${status} é reservado ao owner, com evidência verificada. Sugira ao usuário marcar no app ou na planilha.`);
      return gov(await getProject(id)).changeStatus(activity, status, actor);
    },
  );

  tool(
    "abap_add_evidence",
    { title: "Registrar evidência", description: "Registra evidência verificável numa atividade: link http(s), SHA de commit, caminho de arquivo do repositório ou texto (≥10 caracteres).", write: true },
    { project, activity: z.string().regex(/^ACT-\d{2}$/), kind: z.enum(EVIDENCE_KINDS), ref: z.string(), note: z.string().optional() },
    async ({ project: id, activity, kind, ref, note }) => {
      const input = evidenceInputSchema.safeParse({ kind, ref, note });
      if (!input.success) throw new ToolError(input.error.issues.map((i) => i.message).join("; "));
      return gov(await getProject(id)).addEvidence(activity, input.data, actor);
    },
  );

  // ---------- Templates and models ----------
  tool("abap_list_templates", { title: "Modelos de interface", description: "Modelos de interface disponíveis para projetos (ex.: Diagnóstico de processos)." }, {}, async () =>
    TEMPLATES.map((t) => ({ id: t.id, name: t.name, version: t.templateVersion, stages: t.questionnaire.stages.map((s) => ({ id: s.id, title: s.title, fields: s.fields.map((f) => ({ id: f.id, label: f.label, type: f.type, required: f.required })) })) })),
  );

  tool("abap_list_models", { title: "Listar modelos do projeto", description: "Diagnósticos (DIAG-NN), organogramas (ORG-NN) e fluxos (FLW-NN) do projeto." }, { project }, async ({ project: id }) => models(await getProject(id)).list());

  tool(
    "abap_get_model",
    { title: "Ver modelo", description: "Um modelo com os dados. Para diagnósticos inclui progresso, diagrama Mermaid, lacunas e plano adaptativo (próximas perguntas)." },
    { project, model: modelIdSchema },
    async ({ project: id, model }) => {
      const m = await models(await getProject(id)).get(model);
      if (!m) throw new ToolError(`${model} não existe neste projeto.`);
      if (m.kind !== "diagnostic") return m;
      const t = getTemplate(m.templateId ?? DIAGNOSTIC_TEMPLATE)!;
      return { ...m, progress: progressOf(t, m.data), mermaid: toMermaid(processOf(m.data)), gaps: gapsOf(t, m.data), adaptivePlan: adaptivePlan(t, m.data) };
    },
  );

  tool("abap_create_diagnostic", { title: "Novo diagnóstico", description: "Cria um diagnóstico (DIAG-NN) a partir do modelo de interface.", write: true }, { project, template: z.enum(["diagnostico-processos"]).default("diagnostico-processos") }, async ({ project: id, template }) => {
    const p = await getProject(id);
    const m = await models(p).createFromTemplate(template, p.name, actor);
    return { id: m.id, title: m.title };
  });

  tool(
    "abap_save_diagnostic_stage",
    { title: "Salvar etapa do diagnóstico", description: "Salva as respostas de uma etapa (A–I). answers = {campo: valor}; campo vazio apaga a resposta; booleano 'true'/'false'. Respostas alteradas ficam 'a validar com o cliente'.", write: true },
    { project, model: modelIdSchema, stage: z.string().regex(/^[A-I]$/), answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])) },
    async ({ project: id, model, stage, answers }) => {
      const form = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, typeof v === "boolean" ? (v ? "on" : "") : String(v)]));
      const m = await models(await getProject(id)).saveStage(model, stage, form, actor);
      const t = getTemplate(m.templateId ?? DIAGNOSTIC_TEMPLATE)!;
      return m.kind === "diagnostic" ? { id: m.id, progress: progressOf(t, m.data), gaps: gapsOf(t, m.data).length } : { id: m.id };
    },
  );

  tool("abap_regenerate_process", { title: "Gerar diagrama do diagnóstico", description: "Substitui o diagrama AS-IS guardado pelo derivado das respostas atuais.", write: true }, { project, model: modelIdSchema }, async ({ project: id, model }) => {
    const m = await models(await getProject(id)).regenerateProcess(model, actor);
    return m.kind === "diagnostic" ? { id: m.id, nodes: m.data.process?.nodes.length ?? 0, mermaid: toMermaid(processOf(m.data)) } : { id: m.id };
  });

  tool(
    "abap_import_model",
    { title: "Importar modelo", description: "Importa um JSON: sessão do Diagnóstico, organograma ORG-NN ou fluxo FLW-NN. Cores e estilos do arquivo são descartados (design system único). replace=true substitui um modelo existente.", write: true, annotations: { destructiveHint: true } },
    { project, document: z.record(z.string(), z.unknown()).describe("O JSON do modelo"), source: z.string().max(200).default("mcp"), replace: z.boolean().default(false) },
    async ({ project: id, document, source, replace }) => {
      const m = await models(await getProject(id)).importModel(document, `mcp:${source}`, actor, replace);
      return { id: m.id, kind: m.kind, title: m.title, status: m.status };
    },
  );

  // ---------- Google Drive ----------
  const DRIVE = { openWorldHint: true } as const;
  tool("abap_drive_list", { title: "Arquivos do Drive", description: "Lista os arquivos da pasta do Drive vinculada ao projeto.", annotations: DRIVE }, { project }, async ({ project: id }) => drive(await getProject(id)).list());

  tool("abap_drive_read", { title: "Ler documento do Drive", description: "Lê um arquivo da pasta do projeto; Google Docs vêm em Markdown.", annotations: DRIVE }, { project, fileId: z.string().regex(/^[A-Za-z0-9_-]{10,}$/) }, async ({ project: id, fileId }) => drive(await getProject(id)).read(fileId));

  tool(
    "abap_drive_create_document",
    {
      title: "Publicar documento no Drive do cliente",
      description: "Cria um Google Doc NOVO na pasta do cliente (nunca sobrescreve). Mostre título e conteúdo ao usuário e só chame com confirm=true depois do 'sim' explícito. Fica no histórico do projeto.",
      write: true,
      annotations: { ...DRIVE, destructiveHint: true },
    },
    { project, title: z.string().min(3).max(120), markdown: z.string().min(1).max(200_000), confirm: z.literal(true).describe("true somente após confirmação explícita do usuário") },
    async ({ project: id, title, markdown, confirm }) => drive(await getProject(id)).createDocument({ title, markdown, confirm }, actor),
  );

  tool("abap_drive_detect_spreadsheet", { title: "Detectar planilha", description: "Procura a planilha de governança na pasta do Drive e a vincula ao projeto.", write: true, annotations: DRIVE }, { project }, async ({ project: id }) => drive(await getProject(id)).detectSpreadsheet(actor));

  // ---------- Google Sheets ----------
  tool("abap_sheets_preview", { title: "Prévia da planilha", description: "Compara a planilha do projeto com o ABAP (sem aplicar): mudanças, conflitos e linhas inválidas.", annotations: DRIVE }, { project }, async ({ project: id }) => {
    const p = await getProject(id);
    return syncServiceFor(ctx.cfg, ctx.db, ctx.clock, p, ctx.fetch).preview();
  });

  tool(
    "abap_sheets_sync",
    { title: "Sincronizar planilha", description: "Aplica as mudanças da planilha no ABAP (merge de três vias). resolve = IDs de conflitos em que a planilha deve vencer.", write: true, annotations: { ...DRIVE, destructiveHint: true } },
    { project, resolve: z.array(z.string().regex(/^ACT-\d{2}$/)).default([]) },
    async ({ project: id, resolve }) => {
      const p = await getProject(id);
      return syncServiceFor(ctx.cfg, ctx.db, ctx.clock, p, ctx.fetch).sync({ mode: "manual", actor, resolve });
    },
  );

  return server;
}
