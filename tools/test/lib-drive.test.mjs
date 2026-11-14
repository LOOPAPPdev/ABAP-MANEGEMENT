import assert from "node:assert/strict";
import { test } from "node:test";
import { keyOf, planMirror, safeSegment, sanitizeMarkdown } from "../lib-drive.mjs";

const exported = (files) => ({ project: "prj-01-cleansea", exportedAt: "2026-11-14T10:00:00Z", files });
const doc = (id, name, path = "", markdown = "# T") => ({ id, name, path, mimeType: "application/vnd.google-apps.document", modifiedTime: "2026-11-13T10:00:00Z", markdown });

test("keys are stable and do not contain the Drive ID", () => {
  assert.equal(keyOf("1AbcDriveFileId"), keyOf("1AbcDriveFileId"));
  assert.equal(keyOf("1AbcDriveFileId").length, 16);
  assert.ok(!keyOf("1AbcDriveFileId").includes("Abc"));
});

test("path segments cannot escape the mirror folder", () => {
  assert.equal(safeSegment("../../etc/passwd"), "etc-passwd");
  assert.equal(safeSegment("Relatório: Fase/1"), "Relatório- Fase-1");
  assert.equal(safeSegment("..."), "sem-nome");
});

test("Drive links are omitted and credentials are refused", () => {
  assert.equal(sanitizeMarkdown("ver https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWx/edit agora"), "ver <link do Google Drive omitido> agora");
  assert.throws(() => sanitizeMarkdown("secret GOCSPX-abcdefghijklmnop"), /not mirrored/);
});

test("Google Docs become Markdown files; other files are listed only", () => {
  const plan = planMirror(exported([doc("a1", "Pipeline Completo", "Operação"), { id: "s1", name: "Planilha", path: "", mimeType: "application/vnd.google-apps.spreadsheet", modifiedTime: "x", markdown: null }]));
  assert.deepEqual(plan.writes.map((w) => w.path), ["Operação/Pipeline Completo.md"]);
  assert.ok(plan.writes[0].content.includes("NÃO EDITE"));
  assert.ok(!plan.writes[0].content.includes("a1"));
  assert.deepEqual(plan.manifest.counts, { files: 2, mirrored: 1, listedOnly: 1 });
  assert.equal(plan.manifest.files[1].file, null);
});

test("name collisions get a suffix and README/_manifest are protected", () => {
  const plan = planMirror(exported([doc("a", "Ata"), doc("b", "Ata"), doc("c", "README")]));
  assert.deepEqual(plan.writes.map((w) => w.path), ["Ata.md", "Ata-2.md", "README-2.md"]);
});

test("files removed from Drive are deleted from the mirror; only manifest-listed files", () => {
  const plan = planMirror(exported([doc("a", "Ata")]), { files: [{ file: "Ata.md" }, { file: "Antigo.md" }, { file: "../fora.md" }, { file: null }] });
  assert.deepEqual(plan.deletes, ["Antigo.md"]);
});

test("a document with credentials is reported, not written", () => {
  const plan = planMirror(exported([doc("a", "Vazado", "", "token ya29.abcdefghijklmnopqrstuvwxyz0123")]));
  assert.equal(plan.writes.length, 0);
  assert.match(plan.errors[0], /OAuth access token/);
});
