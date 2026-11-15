import assert from "node:assert/strict";
import { test } from "node:test";
import { planPlugin, registerInMarketplace } from "../lib-plugin.mjs";

const agent = (files) => ({ name: "abap-prj-07-x", version: "1.2.0", revision: 2, generator: "1.0.0", createdAt: "2026-11-15", files });
const ok = [
  { path: ".claude-plugin/plugin.json", content: "{}" },
  { path: "skills/x-contexto/SKILL.md", content: "s" },
  { path: "agents/x-analista.md", content: "a" },
];

test("writes only allow-listed plugin paths", () => {
  const { writes, errors } = planPlugin(agent([...ok, { path: "../../CLAUDE.md", content: "x" }, { path: "hooks/hooks.json", content: "{}" }, { path: ".mcp.json", content: "{}" }]), "prj-07-x");
  assert.deepEqual(writes.map((w) => w.path), ok.map((f) => f.path));
  assert.equal(errors.length, 3);
});

test("refuses a plugin generated for another project", () => {
  assert.equal(planPlugin(agent(ok), "prj-08-y").errors.length, 1);
});

test("deletes files that left the plugin", () => {
  const { deletes } = planPlugin(agent(ok), "prj-07-x", { files: ["agents/x-old.md", "agents/x-analista.md", "../evil"] });
  assert.deepEqual(deletes, ["agents/x-old.md"]);
});

test("marketplace: client entry is added before vendor plugins and replaced on update", () => {
  const m = { name: "abap", plugins: [{ name: "abap", category: "abap" }, { name: "expo", category: "vendor" }] };
  const a = registerInMarketplace(m, "prj-07-x", agent(ok), "d");
  assert.deepEqual(a.plugins.map((p) => p.name), ["abap", "abap-prj-07-x", "expo"]);
  const b = registerInMarketplace(a, "prj-07-x", { ...agent(ok), version: "1.3.0" }, "d");
  assert.equal(b.plugins.length, 3);
  assert.equal(b.plugins[1].version, "1.3.0");
  assert.equal(m.plugins.length, 2);
});
