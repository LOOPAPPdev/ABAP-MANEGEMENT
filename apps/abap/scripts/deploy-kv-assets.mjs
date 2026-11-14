/**
 * Production deploy where the Workers Static Assets upload API is not available
 * (e.g. behind a proxy that rewrites the upload JWT). Steps:
 *  1. build for env.production (done by the npm script)
 *  2. upload build/client/assets/* to the STATIC KV namespace
 *  3. remove the "assets" binding from the generated build config
 *  4. wrangler deploy (the Worker serves /assets/* from KV, see src/server/static-kv.ts)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CONFIG = "build/server/wrangler.json";
const cfg = JSON.parse(readFileSync(CONFIG, "utf8"));
if (cfg.vars?.ENVIRONMENT !== "production") throw new Error("build is not for env.production (run with CLOUDFLARE_ENV=production)");
const kv = (cfg.kv_namespaces ?? []).find((n) => n.binding === "STATIC");
if (!kv?.id) throw new Error("STATIC KV namespace binding missing in env.production");

const dir = "build/client/assets";
const entries = readdirSync(dir).map((f) => ({ key: `assets/${f}`, value: readFileSync(join(dir, f)).toString("base64"), base64: true }));
mkdirSync(".wrangler/tmp", { recursive: true });
const bulk = ".wrangler/tmp/static-assets-bulk.json";
writeFileSync(bulk, JSON.stringify(entries));
const run = (args) => execFileSync("npx", ["wrangler", ...args], { stdio: "inherit" });
run(["kv", "bulk", "put", bulk, "--namespace-id", kv.id, "--remote"]);
console.log(`uploaded ${entries.length} files to KV namespace ${kv.id}`);

delete cfg.assets;
writeFileSync(CONFIG, JSON.stringify(cfg));
run(["deploy"]);
