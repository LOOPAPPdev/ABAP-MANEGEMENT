/** Validates every client workspace (structure, client.json, no secrets/IDs). Exit 1 on problems. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { CLIENTS, FORBIDDEN, ROOT } from "./lib.mjs";

const REQUIRED = ["CLAUDE.md", "README.md", "client.json", "package.json", "docs/README.md", "docs/drive/README.md"];
const problems = [];
const dirs = existsSync(CLIENTS) ? readdirSync(CLIENTS, { withFileTypes: true }).filter((d) => d.isDirectory()) : [];

for (const d of dirs) {
  const dir = join(CLIENTS, d.name);
  for (const f of REQUIRED) if (!existsSync(join(dir, f))) problems.push(`${d.name}: missing ${f}`);
  if (!existsSync(join(dir, "client.json"))) continue;
  const c = JSON.parse(readFileSync(join(dir, "client.json"), "utf8"));
  if (!/^PRJ-\d{2,3}$/.test(c.code)) problems.push(`${d.name}: invalid code ${c.code}`);
  if (c.slug !== d.name) problems.push(`${d.name}: slug "${c.slug}" must equal folder name`);
  if (!["onboarding", "discovery", "build", "live", "closed"].includes(c.status)) problems.push(`${d.name}: invalid status`);
  if (c.governanceModel !== "full-stack-governance-v1") problems.push(`${d.name}: unknown governanceModel`);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  if (pkg.name !== `@clients/${d.name}`) problems.push(`${d.name}: package name must be @clients/${d.name}`);
  if (/\{\{[A-Z]+\}\}/.test(readFileSync(join(dir, "CLAUDE.md"), "utf8"))) problems.push(`${d.name}: unreplaced template placeholders`);
  const scan = (p) => {
    for (const f of readdirSync(p)) {
      const fp = join(p, f);
      if (statSync(fp).isDirectory()) { if (f !== "node_modules") scan(fp); continue; }
      if (statSync(fp).size > 2_000_000) continue;
      const s = readFileSync(fp, "utf8");
      for (const rule of FORBIDDEN) if (rule.re.test(s)) problems.push(`${relative(ROOT, fp)}: contains ${rule.name}`);
    }
  };
  scan(dir);
}
const codes = dirs.map((d) => existsSync(join(CLIENTS, d.name, "client.json")) && JSON.parse(readFileSync(join(CLIENTS, d.name, "client.json"), "utf8")).code).filter(Boolean);
for (const c of new Set(codes)) if (codes.filter((x) => x === c).length > 1) problems.push(`duplicate client code ${c}`);

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join("\n"));
  process.exit(1);
}
console.log(`✓ ${dirs.length} client workspace(s) valid`);
