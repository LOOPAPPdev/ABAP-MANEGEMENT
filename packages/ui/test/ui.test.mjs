// @abap/ui integration checks: one token structure, two themes, shared recipes in sync with the ABAP React components,
// and the Loop landing using only classes that the package (or its own local CSS) defines.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, "..");
const root = join(pkg, "..", "..");
const read = (...p) => readFileSync(join(...p), "utf8");
const contract = JSON.parse(read(pkg, "theme", "contract.json"));
const names = [...contract.colors, ...contract.other];

/** Variables of the first :root block (light values). */
function rootVars(css) {
  const block = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
function darkVars(css) {
  const m = css.match(/prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([\s\S]*?)\}/);
  return m ? Object.fromEntries([...m[1].matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()])) : {};
}
const hsl = (v) => { const [h, s, l] = v.replace(/%/g, "").split(/\s+/).map(Number); return [h, s / 100, l / 100]; };
function lum([h, s, l]) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
}
const contrast = (a, b) => { const [x, y] = [lum(hsl(a)), lum(hsl(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test("both themes define every contract token (common structure)", () => {
  for (const theme of ["abap", "loop"]) {
    const vars = rootVars(read(pkg, "theme", `${theme}.css`));
    for (const n of names) assert.ok(n in vars, `${theme}.css misses --${n}`);
  }
  const dark = darkVars(read(pkg, "theme", "loop.css"));
  for (const n of contract.colors) assert.ok(n in dark, `loop.css dark misses --${n}`);
});

test("ABAP theme is identical to the ABAP app tokens (no drift)", () => {
  const app = rootVars(read(root, "apps", "abap", "app", "app.css"));
  const pkgAbap = rootVars(read(pkg, "theme", "abap.css"));
  for (const n of names) assert.equal(pkgAbap[n], app[n], `--${n} differs from apps/abap/app/app.css`);
});

test("LOOP theme text pairs meet WCAG AA (light and dark)", () => {
  const css = read(pkg, "theme", "loop.css");
  for (const [label, v] of [["light", rootVars(css)], ["dark", { ...rootVars(css), ...darkVars(css) }]]) {
    for (const [fg, bg] of [["foreground", "background"], ["muted-foreground", "background"], ["muted-foreground", "muted"], ["primary-foreground", "primary"], ["card-foreground", "card"], ["loop-brand", "background"], ["loop-positive", "loop-positive-soft"], ["loop-caution", "loop-caution-soft"]]) {
      const c = contrast(v[fg], v[bg]);
      assert.ok(c >= 4.5, `${label}: ${fg} on ${bg} = ${c.toFixed(2)}:1 (< 4.5)`);
    }
  }
});

test("button recipe has every variant and size of the ABAP buttonVariants", () => {
  const tsx = read(root, "apps", "abap", "src", "components", "ui", "button.tsx");
  const block = (key) => tsx.match(new RegExp(`${key}:\\s*\\{([\\s\\S]*?)\\n\\s{6}\\}`))[1];
  const keys = (b) => [...b.matchAll(/^\s*([a-z]+):/gm)].map((m) => m[1]);
  const css = read(pkg, "components", "button.css");
  for (const v of keys(block("variant"))) assert.match(css, new RegExp(`\\.ui-button--${v}\\b`), `variant ${v} missing`);
  for (const s of keys(block("size")).filter((s) => s !== "default")) assert.match(css, new RegExp(`\\.ui-button--${s}\\b`), `size ${s} missing`);
});

test("shared components exist in both workspaces (only what both use)", () => {
  const abap = readdirSync(join(root, "apps", "abap", "src", "components", "ui"));
  const shared = { "button.css": "button.tsx", "card.css": "card.tsx", "badge.css": "badge.tsx", "field.css": "input.tsx", "separator.css": "separator.tsx" };
  assert.deepEqual(readdirSync(join(pkg, "components")).sort(), Object.keys(shared).sort());
  for (const [css, tsx] of Object.entries(shared)) {
    assert.ok(abap.includes(tsx), `${tsx} not in ABAP`);
    assert.match(read(pkg, "components", css), new RegExp(`apps/abap/src/components/ui/${tsx.replace(".", "\\.")}`), `${css} must cite its ABAP source`);
  }
});

test("the landing imports the package and uses only defined ui-* classes", () => {
  const site = join(root, "sites", "loop-consultoria");
  const worker = read(site, "worker.js");
  for (const f of ["theme/loop.css", ...readdirSync(join(pkg, "components")).map((c) => `components/${c}`)])
    assert.ok(worker.includes(`../../packages/ui/${f}`), `worker.js does not import ${f}`);
  const html = read(site, "index.html");
  assert.match(html, /<link rel="stylesheet" href="\/ui\.css">/);
  const defined = new Set(readdirSync(join(pkg, "components")).flatMap((c) => [...read(pkg, "components", c).matchAll(/\.(ui-[a-z0-9_-]+)/g)].map((m) => m[1])));
  const used = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => c.startsWith("ui-")));
  for (const c of used) assert.ok(defined.has(c), `landing uses undefined class ${c}`);
  assert.ok(used.size >= 10, "landing should use the shared primitives");
});
