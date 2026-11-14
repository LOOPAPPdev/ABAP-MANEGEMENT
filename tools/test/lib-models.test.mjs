import assert from "node:assert/strict";
import { test } from "node:test";
import { planModels } from "../lib-models.mjs";

const m = (id, extra = {}) => ({ id, kind: "flow", status: "rascunho", updatedAt: "2026-11-14", data: { id, steps: [] }, ...extra });

test("writes one JSON per model with ABAP metadata first", () => {
  const { writes, errors } = planModels([m("FLW-01"), m("DIAG-02", { kind: "diagnostic" })]);
  assert.deepEqual(errors, []);
  assert.deepEqual(writes.map((w) => w.path), ["FLW-01.json", "DIAG-02.json"]);
  const doc = JSON.parse(writes[0].content);
  assert.equal(doc._abap.id, "FLW-01");
  assert.equal(doc.id, "FLW-01");
  assert.equal("data" in doc._abap, false);
});

test("rejects ids that could escape the folder", () => {
  const { writes, errors } = planModels([m("../../etc"), m("ORG-01")]);
  assert.deepEqual(writes.map((w) => w.path), ["ORG-01.json"]);
  assert.equal(errors.length, 1);
});

test("deletes files of models that no longer exist, never other files", () => {
  const { deletes } = planModels([m("FLW-01")], { files: [{ path: "FLW-01.json" }, { path: "ORG-01.json" }, { path: "../x.json" }] });
  assert.deepEqual(deletes, ["ORG-01.json"]);
});
