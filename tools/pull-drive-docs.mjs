/**
 * Mirrors a client's Google Drive folder into clients/<slug>/docs/drive as Markdown, through ABAP.
 * Usage: npm run docs:pull -w @clients/<slug>   (or: node tools/pull-drive-docs.mjs <slug>)
 * Env:   ABAP_API_TOKEN (or a git-ignored .abap-token file at the repository root)
 *        ABAP_URL (default: production)
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { planMirror } from "./lib-drive.mjs";
import { CLIENTS, ROOT } from "./lib.mjs";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: node tools/pull-drive-docs.mjs <client-slug>");
  process.exit(1);
}
const clientDir = join(CLIENTS, slug);
if (!existsSync(join(clientDir, "client.json"))) throw new Error(`unknown client: ${slug}`);
const client = JSON.parse(readFileSync(join(clientDir, "client.json"), "utf8"));

const base = (process.env.ABAP_URL ?? "https://governance-system.contato-adulto-tdah.workers.dev").replace(/\/$/, "");
const tokenFile = join(ROOT, ".abap-token");
const token = process.env.ABAP_API_TOKEN ?? (existsSync(tokenFile) ? readFileSync(tokenFile, "utf8").trim() : "");
if (!token) throw new Error("ABAP_API_TOKEN not set (env var or .abap-token at the repository root)");

const res = await fetch(`${base}/api/v1/projects/${encodeURIComponent(client.projectId)}/drive/export`, {
  headers: { authorization: `Bearer ${token}` },
});
const body = await res.json().catch(() => ({}));
if (!res.ok) throw new Error(`ABAP ${res.status}: ${body.error ?? ""} ${body.message ?? ""}`.trim());

const out = join(clientDir, "docs", "drive");
const manifestPath = join(out, "_manifest.json");
const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { files: [] };
const { writes, deletes, manifest, errors } = planMirror(body, previous);

const inside = (rel) => {
  const p = resolve(out, rel);
  if (!p.startsWith(resolve(out) + "/")) throw new Error(`refusing to write outside docs/drive: ${rel}`);
  return p;
};
for (const rel of deletes) rmSync(inside(rel), { force: true });
for (const w of writes) {
  const p = inside(w.path);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, w.content);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`${slug}: ${manifest.counts.mirrored} Google Docs mirrored, ${manifest.counts.listedOnly} other files listed, ${deletes.length} removed`);
if (manifest.truncated) console.warn("warning: more Google Docs than the export limit; some were listed only");
if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exitCode = 1;
}
