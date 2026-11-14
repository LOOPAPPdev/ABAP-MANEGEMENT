import { z } from "zod";

export const FAMILIES = ["Foundations", "Primitives", "Composites", "Layouts", "Diagrams", "Patterns"] as const;
export const COMPONENT_STATUS = ["adopted", "available", "planned"] as const;

/** Metanote contract (ADR-002 D): Nome · Função · Quando utilizar · Dados · Interação · Estado · Regra de UX. */
export const metanoteSchema = z.object({
  name: z.string().min(1),
  function: z.string().min(1),
  whenToUse: z.string().min(1),
  data: z.string().min(1),
  interaction: z.string().min(1),
  state: z.string().min(1),
  uxRule: z.string().min(1),
});
export type Metanote = z.infer<typeof metanoteSchema>;

export const componentSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    family: z.enum(FAMILIES),
    name: z.string(),
    function: z.string(),
    variants: z.array(z.string()),
    props: z.array(z.string()),
    states: z.array(z.string()),
    dependencies: z.array(z.string()),
    usage: z.array(z.string()),
    status: z.enum(COMPONENT_STATUS),
    source: z.string(),
    metanote: metanoteSchema.optional(),
  })
  .refine((c) => c.status !== "adopted" || c.metanote, { message: "adopted components need a metanote" });
export type ComponentEntry = z.infer<typeof componentSchema>;

export const registrySchema = z
  .object({ version: z.string(), components: z.array(componentSchema) })
  .superRefine((r, ctx) => {
    const ids = r.components.map((c) => c.id);
    ids.forEach((id, i) => ids.indexOf(id) !== i && ctx.addIssue({ code: "custom", message: `duplicate id ${id}` }));
    for (const c of r.components)
      for (const d of c.dependencies)
        if (d.startsWith("ds:") && !ids.includes(d.slice(3)))
          ctx.addIssue({ code: "custom", message: `${c.id}: unknown dependency ${d}` });
  });
export type Registry = z.infer<typeof registrySchema>;
