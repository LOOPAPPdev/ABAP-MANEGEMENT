// Pure helpers for mirroring a client's Drive export into clients/<slug>/docs/drive (no I/O here).
import { createHash } from "node:crypto";
import { FORBIDDEN } from "./lib.mjs";

/** Stable, non-reversible key for a Drive file (no Google IDs in Git — decision D-020). */
export const keyOf = (fileId) => createHash("sha256").update(fileId).digest("hex").slice(0, 16);

/** Safe path segment: no separators, no dots-only, no control chars; keeps accents readable. */
export function safeSegment(s) {
  const out = String(s)
    .normalize("NFC")
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[.\s-]+|[.\s-]+$/g, "")
    .slice(0, 100);
  return out || "sem-nome";
}

const DRIVE_URL = /https?:\/\/(?:docs|drive)\.google\.com\/[^\s)>\]"']+/g;

/** Removes Google Drive/Docs URLs (they carry file IDs) and refuses content with credentials. */
export function sanitizeMarkdown(md) {
  for (const rule of FORBIDDEN.filter((r) => !r.name.startsWith("Drive"))) {
    if (rule.re.test(md)) throw new Error(`document contains ${rule.name}: not mirrored`);
  }
  return md.replace(DRIVE_URL, "<link do Google Drive omitido>");
}

const TYPE = {
  "application/vnd.google-apps.document": "Google Doc",
  "application/vnd.google-apps.spreadsheet": "Planilha",
  "application/vnd.google-apps.presentation": "Apresentação",
  "application/pdf": "PDF",
};

export function renderDoc(file, markdown) {
  return [
    "<!--",
    "  Espelho de um Google Doc da pasta do cliente. NÃO EDITE: regenerado por `npm run docs:pull`.",
    `  key: ${keyOf(file.id)}`,
    `  title: ${file.name}`,
    `  path: ${file.path || "/"}`,
    `  modified: ${file.modifiedTime}`,
    "-->",
    "",
    sanitizeMarkdown(markdown).trim(),
    "",
  ].join("\n");
}

/**
 * Plans the mirror. Returns files to write, previous mirror files to delete, the new manifest
 * and per-file errors. Paths are relative to docs/drive and never escape it.
 */
export function planMirror(exported, previousManifest = { files: [] }) {
  const writes = [];
  const errors = [];
  const used = new Set(["README.md", "_manifest.json"]);
  const files = exported.files.map((f) => {
    const entry = { key: keyOf(f.id), name: f.name, path: f.path || "", type: TYPE[f.mimeType] ?? f.mimeType, modifiedTime: f.modifiedTime, file: null };
    if (f.markdown == null) return entry;
    const dir = (f.path || "").split("/").filter(Boolean).map(safeSegment);
    let base = safeSegment(f.name);
    let rel = [...dir, `${base}.md`].join("/");
    for (let i = 2; used.has(rel); i++) rel = [...dir, `${base}-${i}.md`].join("/");
    try {
      writes.push({ path: rel, content: renderDoc(f, f.markdown) });
      used.add(rel);
      entry.file = rel;
    } catch (e) {
      errors.push(`${f.name}: ${e.message}`);
    }
    return entry;
  });
  const keep = new Set(writes.map((w) => w.path));
  const deletes = (previousManifest.files ?? []).map((f) => f.file).filter((p) => p && !keep.has(p) && !p.includes("..") && !p.startsWith("/"));
  const manifest = {
    project: exported.project,
    exportedAt: exported.exportedAt,
    truncated: Boolean(exported.truncated),
    counts: { files: files.length, mirrored: writes.length, listedOnly: files.length - writes.length },
    files,
  };
  return { writes, deletes, manifest, errors };
}
