import { z } from "zod";
import { EVIDENCE_KINDS, STATUSES } from "~/domain/governance";

export const activityIdSchema = z.string().regex(/^ACT-\d{2}$/, "expected ACT-nn");

export const statusChangeSchema = z.object({ status: z.enum(STATUSES) });

/** Evidence must reference something verifiable: a URL, a commit SHA, a repo file path, or a non-trivial note. */
export const evidenceInputSchema = z
  .object({
    kind: z.enum(EVIDENCE_KINDS),
    ref: z.string().trim().min(1).max(2000),
    note: z.string().trim().max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", path: ["ref"], message });
    if (v.kind === "link" && !z.url({ protocol: /^https?$/ }).safeParse(v.ref).success)
      fail("link evidence must be an http(s) URL");
    if (v.kind === "commit" && !/^[0-9a-f]{7,40}$/i.test(v.ref)) fail("commit evidence must be a 7–40 char SHA");
    if (v.kind === "file" && (v.ref.includes("..") || v.ref.startsWith("/"))) fail("file evidence must be a relative repo path");
    if (v.kind === "text" && v.ref.length < 10) fail("text evidence must have at least 10 characters");
  });
export type EvidenceInput = z.infer<typeof evidenceInputSchema>;

export const actorSchema = z.string().trim().min(1).max(100).catch("local-dev");
