/**
 * Creates a client workspace from tools/client-template.
 * Usage: npm run client:new -- PRJ-02 "Nome do Cliente" [DRIVE-FOLDER-NAME]
 */
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENTS, listClients, ROOT, slugOf } from "./lib.mjs";

const [code, name, folderArg] = process.argv.slice(2);
if (!/^PRJ-\d{2,3}$/.test(code ?? "") || !name) {
  console.error('usage: npm run client:new -- PRJ-02 "Nome do Cliente" [PRJ-02-NOME-NO-DRIVE]');
  process.exit(1);
}
const slug = slugOf(code, name);
const folder = folderArg ?? `${code}-${name}`.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]+/g, "-");
const dest = join(CLIENTS, slug);
if (existsSync(dest)) throw new Error(`${dest} already exists`);
if (listClients().some((c) => c.code === code)) throw new Error(`client code ${code} already used`);

cpSync(join(ROOT, "tools/client-template"), dest, { recursive: true });
const vars = { "{{CODE}}": code, "{{SLUG}}": slug, "{{NAME}}": name, "{{FOLDER}}": folder };
const walk = (dir) =>
  readdirSync(dir).forEach((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return walk(p);
    let s = readFileSync(p, "utf8");
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(k, v);
    writeFileSync(p, s);
  });
walk(dest);
console.log(`created clients/${slug}
next steps:
  1. npm install                      (registers the new workspace)
  2. In ABAP → Projects: create project "${slug}" (${code} ${name}) and set its Drive folder and spreadsheet
  3. npm run docs:pull -w @clients/${slug}`);
