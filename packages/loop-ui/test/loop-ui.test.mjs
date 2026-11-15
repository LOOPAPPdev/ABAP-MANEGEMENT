// @loop/ui checks: source files are the design files as received, tokens.css is generated from them,
// and the Loop landing uses this package only (classes defined, files served, no @abap/ui).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(pkg, "..", "..");
const site = join(root, "sites", "loop-consultoria");
const read = (...p) => readFileSync(join(...p), "utf8");

test("source files are the Screens v2 design files as received (artifact a74ae02c, ds/rc)", () => {
  const sha = (f) => createHash("sha256").update(readFileSync(join(pkg, "source", f))).digest("hex");
  assert.equal(sha("_ds_bundle.css"), "b93005cab32fe82a10ae59e99f3a125d2da8cf78d50f0e41801506cf73e54a65");
  assert.equal(sha("loop-theme.css"), "56bce5ae56aa8cfb403c3682dd9bd303b8c926f403834eee12aff1dd4e3c3cab");
});

test("tokens.css is current (regenerated from source)", () => {
  const fresh = execFileSync(process.execPath, [join(pkg, "tools", "extract-tokens.mjs")], { encoding: "utf8" });
  assert.equal(read(pkg, "tokens.css"), fresh, "run: npm run tokens -w @loop/ui");
});

test("tokens resolve to the LOOP palette (loop-theme overrides the bundle)", () => {
  const t = read(pkg, "tokens.css");
  assert.ok(t.lastIndexOf("--color-surface:var(--loop-slate-100)") > t.lastIndexOf("--color-surface: #"), "loop-theme must come after the bundle");
  for (const v of ["--font-text", "--font-display", "--ease-standard", "--border-strong", "--action-primary-hover", "--tag-accent-bg", "--loop-green-tint", "--loop-warn-tint"])
    assert.match(t, new RegExp(v + "\\s*:"), v + " missing");
  assert.match(t, /\[data-theme="dark"\]/);
});

test("the landing uses @loop/ui only, and every sv-* class it uses is defined", () => {
  const worker = read(site, "worker.js");
  for (const f of ["tokens.css", "screens.css", "screens.client.js"]) assert.ok(worker.includes("../../packages/loop-ui/" + f), "worker.js does not import " + f);
  assert.doesNotMatch(worker, /packages\/ui\//, "landing must not import @abap/ui");
  const html = read(site, "index.html");
  assert.match(html, /<link rel="stylesheet" href="\/loop-ui\.css">/);
  assert.match(html, /<script src="\/loop-ui\.js" defer><\/script>/);
  const defined = new Set([...read(pkg, "screens.css").matchAll(/\.(sv-[a-z0-9-]+)/g)].map((m) => m[1]));
  const used = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => c.startsWith("sv-")));
  for (const c of used) assert.ok(defined.has(c), "landing uses undefined class " + c);
  assert.ok(used.size >= 40, "landing should be built from the package patterns");
});
