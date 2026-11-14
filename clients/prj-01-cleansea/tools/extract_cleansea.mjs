/**
 * One-time extraction of the CleanSea operational model embedded in the legacy
 * prototype reference/cleansea-operacao-integrada.html (client area; legacy — superseded by models/FLW-01.json) (const MODEL = {...}).
 *
 * Usage: node scripts/extract_cleansea.mjs <html> <out.json>
 *
 * Safety: only the object literal is evaluated, in an empty vm context (no require,
 * no process, no globals) with a timeout. The input is a file we committed and reviewed.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error("usage: node scripts/extract_cleansea.mjs <html> <out.json>");
  process.exit(1);
}
const html = readFileSync(src, "utf8");
const match = html.match(/const MODEL=(\{[\s\S]*?\n\});/);
if (!match) throw new Error("MODEL literal not found");
const literal = match[1];
// Reject anything that is not plain data (function calls, arrows, template code).
if (/=>|function\b|\bnew\b|`|\$\{|\(\s*\)/.test(literal)) throw new Error("MODEL literal contains code");

const model = vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 1000 });
const fixture = {
  version: 1,
  status: "não validado",
  note: "Extraído do protótipo HTML. Os ADR-002/003 citam 23 atividades e 7 fases; o protótipo contém 17 etapas em 6 fases. Não completar sem a fonte 'Clean Sea Pipeline Completo.md'.",
  source: {
    file: src,
    sha256: createHash("sha256").update(html).digest("hex"),
    upstream: model.metadata?.source ?? [],
  },
  ...model,
};
writeFileSync(out, JSON.stringify(fixture, null, 2) + "\n");
console.log(`wrote ${out}: ${model.phases.length} phases, ${model.steps.length} steps, ${model.documents.length} documents`);
