/**
 * Publishes a static web artifact of a client into the client's Studio in ABAP (ADR-011).
 * Usage: npm run studio:publish -w @clients/<slug>          (reads clients/<slug>/studio/*.json)
 *        node tools/studio-publish.mjs <slug> [artifact-slug]
 * Manifest (clients/<slug>/studio/<artifact>.json): { slug, title, notice, description?, entry, dir }
 *   dir = folder relative to the client workspace; every allowed text file inside it is sent.
 * Env: ABAP_TOKEN or ABAP_API_TOKEN (personal token, role write), ABAP_URL (default: production).
 * Writes go through the MCP tool abap_studio_publish. Unchanged content creates no new revision.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { CLIENTS, ROOT } from "./lib.mjs";

const ALLOWED = /\.(html|js|mjs|css|json|svg|txt|md)$/i;
const [slug, only] = process.argv.slice(2);
if (!slug) {
  console.error("usage: node tools/studio-publish.mjs <client-slug> [artifact-slug]");
  process.exit(1);
}
const clientDir = join(CLIENTS, slug);
if (!existsSync(join(clientDir, "client.json"))) throw new Error(`unknown client: ${slug}`);
const client = JSON.parse(readFileSync(join(clientDir, "client.json"), "utf8"));
const studioDir = join(clientDir, "studio");
const manifests = existsSync(studioDir) ? readdirSync(studioDir).filter((f) => f.endsWith(".json")) : [];
if (!manifests.length) throw new Error(`no manifest in clients/${slug}/studio/`);

const base = (process.env.ABAP_URL ?? "https://governance-system.contato-adulto-tdah.workers.dev").replace(/\/$/, "");
const tokenFile = join(ROOT, ".abap-token");
const token = process.env.ABAP_TOKEN ?? process.env.ABAP_API_TOKEN ?? (existsSync(tokenFile) ? readFileSync(tokenFile, "utf8").trim() : "");
if (!token) throw new Error("ABAP_TOKEN not set (env var or .abap-token at the repository root)");

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));

let id = 0;
for (const file of manifests) {
  const m = JSON.parse(readFileSync(join(studioDir, file), "utf8"));
  if (only && m.slug !== only) continue;
  const dir = join(clientDir, m.dir);
  if (!dir.startsWith(clientDir + sep)) throw new Error(`${file}: dir must stay inside the client workspace`);
  const files = walk(dir)
    .filter((f) => ALLOWED.test(f))
    .map((f) => ({ path: relative(dir, f).split(sep).join("/"), content: readFileSync(f, "utf8") }));
  const args = { project: client.projectId, slug: m.slug, title: m.title, description: m.description ?? "", notice: m.notice, entry: m.entry, files };
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name: "abap_studio_publish", arguments: args } }),
  });
  const body = await res.json().catch(() => null);
  const result = body?.result;
  if (!res.ok || !result || result.isError) throw new Error(`ABAP ${res.status}: ${result?.content?.[0]?.text ?? body?.error?.message ?? body?.error ?? "error"}`);
  const out = result.structuredContent?.result ?? JSON.parse(result.content[0].text);
  const kb = Math.round(files.reduce((n, f) => n + Buffer.byteLength(f.content), 0) / 1024);
  console.log(`${m.slug}: ${out.changed ? `published r${out.artifact.revision}` : `unchanged (r${out.artifact.revision})`} — ${files.length} files, ${kb} KB → ${base}${out.open}`);
}
