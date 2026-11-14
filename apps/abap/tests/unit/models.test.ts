import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adaptivePlan,
  allFields,
  applyStageAnswers,
  buildProcess,
  coerceField,
  detectModelKind,
  emptySession,
  gapsOf,
  getTemplate,
  orgModelSchema,
  progressOf,
  TEMPLATES,
  toMermaid,
} from "~/domain/models";

const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const t = getTemplate("diagnostico-processos")!;

describe("Feature: interface template 'Diagnóstico de processos' (bundle v1.1)", () => {
  it("GIVEN the template file THEN it has 9 stages A–I and 18 fields with unique ids", () => {
    expect(TEMPLATES).toHaveLength(1);
    expect(t.questionnaire.stages.map((s) => s.id).join("")).toBe("ABCDEFGHI");
    const ids = allFields(t).map((f) => f.id);
    expect(ids).toHaveLength(18);
    expect(new Set(ids).size).toBe(18);
    expect(t.questionnaire.field_count).toBe(18);
  });

  it("GIVEN a new session WHEN created THEN only the company is filled and it is 'a validar'", () => {
    const s = emptySession("ACME", "s1", "2026-11-14");
    expect(progressOf(t, s)).toMatchObject({ answered: 1, total: 18 });
    expect(s.questionnaire.answers.company_name).toMatchObject({ value: "ACME", verification: "needs_review" });
  });

  it("coerces field values by type", () => {
    const f = (type: "number" | "url" | "boolean" | "text") => ({ id: "x", label: "x", type, required: false });
    expect(coerceField(f("number"), "12,5")).toBe(12.5);
    expect(coerceField(f("number"), "-3")).toBeUndefined();
    expect(coerceField(f("url"), "acme.com")).toBe("https://acme.com");
    expect(coerceField(f("boolean"), "on")).toBe(true);
    expect(coerceField(f("text"), "  ")).toBeUndefined();
  });

  it("GIVEN answers in stage E WHEN the process is built THEN start → activities (with actor) → end, in order", () => {
    let s = emptySession("ACME", "s1", "2026-11-14");
    s = applyStageAnswers(s, t, "C", { trigger: "Pedido do cliente", deliverable: "Serviço faturado" }, "2026-11-14");
    s = applyStageAnswers(s, t, "E", { activities: "1. Receber pedido — Comercial\n2. Executar\n3. Faturar — Financeiro" }, "2026-11-14");
    const p = buildProcess(s);
    expect(p.nodes.map((n) => n.type)).toEqual(["start", "task", "task", "task", "end"]);
    expect(p.nodes[1]).toMatchObject({ label: "Receber pedido", actor: "Comercial", verification: "unverified" });
    expect(p.nodes[0]!.label).toBe("Pedido do cliente");
    expect(p.edges).toHaveLength(4);
    expect(toMermaid(p)).toContain('N_start(["Pedido do cliente"])');
  });

  it("an emptied field removes the answer; confirmation=true is 'confirmed'", () => {
    let s = applyStageAnswers(emptySession("ACME", "s1", "d"), t, "A", { company_name: "" }, "d");
    expect(s.questionnaire.answers.company_name).toBeUndefined();
    s = applyStageAnswers(s, t, "I", { confirmation: "on" }, "d");
    expect(s.questionnaire.answers.confirmation).toMatchObject({ value: true, verification: "confirmed" });
  });

  it("gaps list missing required fields; the adaptive plan puts required questions first", () => {
    const s = emptySession("ACME", "s1", "d");
    const gaps = gapsOf(t, s);
    expect(gaps.filter((g) => g.kind === "required").length).toBe(allFields(t).filter((f) => f.required).length - 1);
    const plan = adaptivePlan(t, s);
    expect(plan[0]!.required).toBe(true);
    expect(plan.findIndex((p) => !p.required)).toBeGreaterThan(plan.findLastIndex((p) => p.required));
  });

  it("detects the kind of an imported document", () => {
    expect(detectModelKind({ session_id: "x", questionnaire: {} })).toBe("diagnostic");
    expect(detectModelKind(read("tests/fixtures/org.sample.json"))).toBe("org");
    expect(detectModelKind(read("tests/fixtures/flow.sample.json"))).toBe("flow");
    expect(detectModelKind({ foo: 1 })).toBeNull();
  });

  it("single design system: department colours from imported material are discarded", () => {
    const org = orgModelSchema.parse(read("tests/fixtures/org.sample.json"));
    expect(org.departments.every((d) => !("color" in d))).toBe(true);
  });
});

describe("Feature: imported sessions", () => {
  it("normalises escaped line breaks in answers", async () => {
    const { diagnosticSessionSchema } = await import("~/domain/models");
    const s = diagnosticSessionSchema.parse({ session_id: "x", organization: { name: "A" }, questionnaire: { answers: { activities: { value: "01. A\\n02. B" } } } });
    expect(s.questionnaire.answers.activities!.value).toBe("01. A\n02. B");
  });
});
