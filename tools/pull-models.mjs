/**
 * Exports a client's project models (diagnostics, org charts, flows) from ABAP into clients/<slug>/models/_abap.
 * Usage: npm run models:pull -w @clients/<slug>   (or: node tools/pull-models.mjs <slug>)
 * Env:   ABAP_API_TOKEN (or a git-ignored .abap-token at the repository root), ABAP_URL (default: production)
 * Read-only: the machine token may only GET. Edit models in the app (Modelos), never in these files.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { planModels } from "./lib-models.mjs";
import { CLIENTS, ROOT } from "./lib.mjs";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: node tools/pull-models.mjs <client-slug>");
  process.exit(1);
}
const clientDir = join(CLIENTS, slug);
if (!existsSync(join(clientDir, "client.json"))) throw new Error(`unknown client: ${slug}`);
const client = JSON.parse(readFileSync(join(clientDir, "client.json"), "utf8"));

const base = (process.env.ABAP_URL ?? "https://governance-system.contato-adulto-tdah.workers.dev").replace(/\/$/, "");
const tokenFile = join(ROOT, ".abap-token");
const token = process.env.ABAP_API_TOKEN ?? (existsSync(tokenFile) ? readFileSync(tokenFile, "utf8").trim() : "");
if (!token) throw new Error("ABAP_API_TOKEN not set (env var or .abap-token at the repository root)");

const get = async (path) => {
  const res = await fetch(`${base}/api/v1/projects/${encodeURIComponent(client.projectId)}${path}`, { headers: { authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`ABAP ${res.status}: ${body.error ?? ""} ${body.message ?? ""}`.trim());
  return body;
};

const { models: list } = await get("/models");
const models = [];
for (const s of list) models.push((await get(`/models/${encodeURIComponent(s.id)}`)).model);

const out = join(clientDir, "models", "_abap");
mkdirSync(out, { recursive: true });
const manifestPath = join(out, "_manifest.json");
const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { files: [] };
const { writes, deletes, manifest, errors } = planModels(models, previous);
const inside = (rel) => {
  const p = resolve(out, rel);
  if (!p.startsWith(resolve(out) + "/")) throw new Error(`refusing to write outside models/_abap: ${rel}`);
  return p;
};
for (const rel of deletes) rmSync(inside(rel), { force: true });
for (const w of writes) writeFileSync(inside(w.path), w.content);
writeFileSync(manifestPath, JSON.stringify({ project: client.projectId, exportedAt: new Date().toISOString(), ...manifest }, null, 2) + "\n");
console.log(`${slug}: ${writes.length} models exported, ${deletes.length} removed`);
if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exitCode = 1;
}
