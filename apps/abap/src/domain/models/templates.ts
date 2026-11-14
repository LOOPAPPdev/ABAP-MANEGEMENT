/** Interface templates available when creating a project (ADR-008). Source: the bundle's data contract. */
import diagnostico from "../../../templates/diagnostico-processos/template.json";
import { templateSchema, type Template } from "./schemas";

export const TEMPLATES: readonly Template[] = [templateSchema.parse(diagnostico)];
export const getTemplate = (id: string | null | undefined) => TEMPLATES.find((t) => t.id === id) ?? null;
export const DIAGNOSTIC_TEMPLATE = "diagnostico-processos";
