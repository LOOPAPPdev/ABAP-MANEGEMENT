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

test("the Loop landing does not use @abap/ui (it uses the exclusive @loop/ui, decision 2026-11-15)", () => {
  const worker = read(root, "sites", "loop-consultoria", "worker.js");
  assert.doesNotMatch(worker, /packages\/ui\//);
  assert.match(worker, /packages\/loop-ui\//);
});

test("LOOP theme carries the Screens v2 rc scale and palette (values from the design bundle)", () => {
  // Source: claude.ai/code/artifact/a74ae02c, ds/rc/_ds_bundle.css and ds/rc/loop-theme.css.
  const v = rootVars(read(pkg, "theme", "loop.css"));
  const expected = {
    "text-display": "80px", "text-hero": "56px", "text-title": "40px", "text-subtitle": "28px", "text-lead": "21px",
    "text-card": "21px", "text-body": "17px", "text-caption": "14px", "text-micro": "12px", "leading-body": "1.47",
    "tracking-body": "-0.022em", "space-1": "4px", "space-5": "24px", "space-8": "64px", "radius-card": "16px",
    "radius-pill": "980px", "loop-slate-100": "#f3f4f6", "loop-slate-900": "#111418", "loop-blue": "#2a62d4",
    "loop-blue-tint": "#edf3ff", "loop-green": "#0f6b5f", "loop-purple": "#5146b8", "loop-warn": "#a2451b",
  };
  for (const [k, val] of Object.entries(expected)) assert.equal(v[k], val, `--${k}`);
  const dark = darkVars(read(pkg, "theme", "loop.css"));
  for (const k of ["loop-slate-100", "loop-slate-900", "loop-blue", "loop-blue-tint"]) assert.ok(k in dark, `dark misses --${k}`);
});

test("component hooks keep ABAP defaults (ABAP theme sets no --ui-* hook)", () => {
  const abap = rootVars(read(pkg, "theme", "abap.css"));
  assert.deepEqual(Object.keys(abap).filter((k) => k.startsWith("ui-")), []);
  for (const f of ["button.css", "badge.css", "card.css", "field.css"]) {
    for (const m of read(pkg, "components", f).matchAll(/var\(--ui-[a-z-]+(,?)/g)) assert.equal(m[1], ",", `${f}: hook without ABAP fallback`);
  }
});
