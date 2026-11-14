/**
 * Project identity and Google link parsing (pure).
 * A project id is the client slug used in the monorepo: clients/<slug>.
 */
import { z } from "zod";

export const DEFAULT_PROJECT = "default";

export const projectIdSchema = z
  .string()
  .trim()
  .regex(/^(default|prj-\d{2,3}-[a-z0-9]+(?:-[a-z0-9]+)*)$/, "use o formato prj-NN-nome (minúsculas, números e hífens)")
  .max(60);

export const projectCodeSchema = z.string().trim().regex(/^PRJ-\d{2,3}$/, "use o formato PRJ-NN");

export const newProjectSchema = z
  .object({
    code: projectCodeSchema,
    name: z.string().trim().min(2).max(80),
    id: projectIdSchema,
  })
  .refine((p) => p.id !== DEFAULT_PROJECT, { path: ["id"], message: "reservado para a plataforma" })
  .refine((p) => p.id.startsWith(p.code.toLowerCase() + "-"), { path: ["id"], message: "o identificador deve começar pelo código (ex.: prj-01-…)" });

/** Suggested slug from code + name (same rule as tools/new-client.mjs). */
export function slugFor(code: string, name: string): string {
  return `${code}-${name}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const GOOGLE_ID = /^[A-Za-z0-9_-]{20,}$/;

/** Accepts a Drive folder URL (…/drive/folders/<id>, …?id=<id>) or a bare ID. Returns null when invalid. */
export function parseDriveFolderId(input: string): string | null {
  const v = input.trim();
  const m = v.match(/\/folders\/([A-Za-z0-9_-]{20,})/) ?? v.match(/[?&]id=([A-Za-z0-9_-]{20,})/);
  const id = m?.[1] ?? v;
  return GOOGLE_ID.test(id) ? id : null;
}

/** Accepts a Google Sheets URL (…/spreadsheets/d/<id>/…) or a bare ID. Returns null when invalid. */
export function parseSpreadsheetId(input: string): string | null {
  const v = input.trim();
  const id = v.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/)?.[1] ?? v;
  return GOOGLE_ID.test(id) ? id : null;
}

export const driveFolderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;
export const spreadsheetUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;
