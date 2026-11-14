/**
 * Project model formats (pure, Zod). Three kinds, all stored per project:
 *  - diagnostic: a session of the "Diagnóstico de processos" template (questionnaire answers + AS-IS process)
 *  - org: organisation chart (ORG-xx)
 *  - flow: operational flow (FLW-xx)
 * Visual attributes from imported material (e.g. department colours) are DISCARDED: the ABAP design
 * system is the only one applied (ADR-007).
 */
import { z } from "zod";

// ---------- Template (questionnaire definition) ----------
export const FIELD_TYPES = ["text", "url", "textarea", "number", "boolean"] as const;
export const templateFieldSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  type: z.enum(FIELD_TYPES),
  required: z.boolean(),
});
export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  templateVersion: z.string(),
  source: z.object({ artifact: z.string(), sha256: z.string() }).loose(),
  outputs: z.array(z.string()),
  questionnaire: z.object({
    version: z.string(),
    visible_stage_count: z.number().int(),
    field_count: z.number().int(),
    description: z.string(),
    stages: z.array(z.object({ id: z.string().regex(/^[A-Z]$/), title: z.string(), description: z.string(), fields: z.array(templateFieldSchema).min(1) })).min(1),
  }),
});
export type Template = z.infer<typeof templateSchema>;
export type TemplateField = z.infer<typeof templateFieldSchema>;

// ---------- Diagnostic session ----------
export const ORIGINS = ["customer_document", "consultant", "client_interview", "public_research"] as const;
export const VERIFICATIONS = ["confirmed", "needs_review", "unverified"] as const;
export const answerSchema = z.object({
  // Some exports store line breaks as the two characters "\n": normalise to real line breaks.
  value: z.union([z.string().transform((v) => v.replace(/\\n/g, "\n")), z.number(), z.boolean()]),
  origin: z.string().default("consultant"),
  verification: z.string().default("needs_review"),
  updated_at: z.string().optional(),
});
export type Answer = z.infer<typeof answerSchema>;

export const processNodeSchema = z
  .object({
    id: z.string(),
    type: z.enum(["start", "end", "task", "decision"]),
    label: z.string(),
    actor: z.string().optional(),
    verification: z.string().optional(),
    origin: z.string().optional(),
    source_ref: z.string().optional(),
  })
  .loose();
export const processEdgeSchema = z
  .object({ id: z.string(), source: z.string(), target: z.string(), kind: z.string().default("sequence"), label: z.string().optional() })
  .loose();
export const processSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    version: z.number().int().default(1),
    status: z.string().default("draft"),
    nodes: z.array(processNodeSchema),
    edges: z.array(processEdgeSchema),
    risks: z.array(z.string()).default([]),
  })
  .loose();
export type Process = z.infer<typeof processSchema>;

export const diagnosticSessionSchema = z
  .object({
    schema_version: z.string().default("1.0.0"),
    session_id: z.string(),
    organization: z.object({ name: z.string() }).loose(),
    questionnaire: z.object({ current_stage: z.string().default("A"), answers: z.record(z.string(), answerSchema) }).loose(),
    research: z.object({ state: z.string(), suggestions: z.array(z.unknown()) }).loose().optional(),
    process: processSchema.optional(),
    sources: z.array(z.object({ type: z.string(), ref: z.string() }).loose()).default([]),
  })
  .loose();
export type DiagnosticSession = z.infer<typeof diagnosticSessionSchema>;

// ---------- Org chart ----------
const person = z.object({ id: z.string(), name: z.string(), role: z.string().default(""), source: z.string().optional() }).loose();
const departmentBase = z
  .object({
    id: z.string(),
    name: z.string(),
    leader: z.string().nullable().optional(),
    leader_status: z.string().optional(),
    members: z.array(person).default([]),
    activities: z.array(z.string()).default([]),
    sources: z.array(z.string()).default([]),
  })
  .loose();
/** Department; any `color` from the source is dropped (single design system, ADR-007). */
const departmentSchema = departmentBase.transform((d): z.infer<typeof departmentBase> => {
  const rest: Record<string, unknown> = { ...d };
  delete rest.color;
  return rest as z.infer<typeof departmentBase>;
});
export const orgModelSchema = z
  .object({
    id: z.string().regex(/^ORG-\d{2}$/),
    title: z.string(),
    version: z.string().default("1.0"),
    type: z.string().default("AS-IS"),
    status: z.string().default("rascunho"),
    company: z.string(),
    port: z.string().optional(),
    governance: z.array(z.object({ id: z.string(), name: z.string(), role: z.string(), areas: z.array(z.string()).default([]), scope: z.string().optional(), sources: z.array(z.string()).default([]) }).loose()).default([]),
    departments: z.array(departmentSchema).default([]),
    external_parties: z.array(z.string()).default([]),
    notes: z.array(z.string()).default([]),
  })
  .loose();
export type OrgModel = z.infer<typeof orgModelSchema>;

// ---------- Flow ----------
export const flowModelSchema = z
  .object({
    id: z.string().regex(/^FLW-\d{2}$/),
    title: z.string(),
    version: z.string().default("1.0"),
    type: z.string().default("AS-IS"),
    status: z.string().default("rascunho"),
    context: z.record(z.string(), z.unknown()).default({}),
    phases: z.array(z.object({ id: z.string(), name: z.string(), span: z.tuple([z.number(), z.number()]), tag: z.string().optional() }).loose()).default([]),
    steps: z
      .array(
        z
          .object({
            id: z.string(),
            number: z.number().int(),
            title: z.string(),
            detail: z.string().default(""),
            owner: z.string().default(""),
            output: z.string().default(""),
            source: z.string().default(""),
            area: z.string().default(""),
            phase: z.string().optional(),
          })
          .loose(),
      )
      .min(1),
    decision: z.object({ id: z.string(), after: z.string(), question: z.string(), yes: z.string(), no: z.string(), status: z.string().default(""), source: z.string().optional() }).loose().optional(),
    documents: z.array(z.object({ id: z.string(), name: z.string(), handling: z.string().optional(), source: z.string().optional() }).loose()).default([]),
    assumptions: z.array(z.string()).default([]),
    outstanding: z.array(z.string()).default([]),
  })
  .loose();
export type FlowModel = z.infer<typeof flowModelSchema>;

export const MODEL_KINDS = ["diagnostic", "org", "flow"] as const;
export type ModelKind = (typeof MODEL_KINDS)[number];

/** Detects the kind of an imported JSON document. */
export function detectModelKind(raw: unknown): ModelKind | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if ("questionnaire" in o && "session_id" in o) return "diagnostic";
  if ("departments" in o || "governance" in o) return "org";
  if ("steps" in o && "phases" in o) return "flow";
  return null;
}

export const modelIdSchema = z.string().regex(/^(DIAG|ORG|FLW)-\d{2}$/, "use DIAG-NN, ORG-NN ou FLW-NN");
