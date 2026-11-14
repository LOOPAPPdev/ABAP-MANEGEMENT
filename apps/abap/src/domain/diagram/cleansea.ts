import { z } from "zod";
import type { CleanSeaModel } from "./adapters";

/** Schema for data/reference/cleansea.v1.json (extracted by scripts/extract_cleansea.mjs). */
export const cleanSeaSchema = z
  .object({
    version: z.literal(1),
    status: z.string(),
    note: z.string(),
    source: z.object({ file: z.string(), sha256: z.string().length(64) }).loose(),
    metadata: z.object({ name: z.string(), version: z.string() }).loose(),
    people: z.object({
      founders: z.array(z.object({ name: z.string(), roles: z.array(z.string()) })),
      sales: z.array(z.string()),
      operations: z.array(z.object({ name: z.string(), role: z.string() })),
      drivers: z.array(z.string()),
    }),
    phases: z.array(z.object({ id: z.string(), title: z.string(), short: z.string(), range: z.tuple([z.number(), z.number()]) })),
    steps: z.array(
      z.object({
        id: z.number().int(),
        phase: z.string(),
        task: z.string(),
        owner: z.string(),
        channel: z.string(),
        control: z.string(),
        lane: z.string(),
        gap: z.boolean().optional(),
      }),
    ),
    documents: z.array(z.object({ id: z.string(), title: z.string(), method: z.string() })),
    unresolved: z.array(z.string()),
  })
  .loose()
  .superRefine((m, ctx) => {
    for (const s of m.steps)
      if (!m.phases.some((p) => p.id === s.phase)) ctx.addIssue({ code: "custom", message: `step ${s.id}: unknown phase ${s.phase}` });
  });

export function parseCleanSea(raw: unknown): CleanSeaModel {
  return cleanSeaSchema.parse(raw) as unknown as CleanSeaModel;
}
