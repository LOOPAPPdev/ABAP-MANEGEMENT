// Pure helpers for exporting a project's ABAP models into clients/<slug>/models/_abap (no I/O here).
const MODEL_ID = /^(DIAG|ORG|FLW)-\d{2}$/;

/**
 * Plans the files for the exported models. Each model becomes <ID>.json with metadata + data.
 * Ids are validated (they become file names). Previously exported files not in the list are deleted.
 */
export function planModels(models, previousManifest = { files: [] }) {
  const errors = [];
  const writes = [];
  for (const m of models) {
    if (!MODEL_ID.test(m.id)) {
      errors.push(`invalid model id: ${String(m.id).slice(0, 40)}`);
      continue;
    }
    const { data, ...meta } = m;
    writes.push({ path: `${m.id}.json`, content: JSON.stringify({ _abap: { ...meta, note: "Gerado por models:pull a partir do ABAP. Edite no app, não aqui." }, ...data }, null, 2) + "\n" });
  }
  const current = new Set(writes.map((w) => w.path));
  const deletes = (previousManifest.files ?? []).map((f) => f.path).filter((p) => MODEL_ID.test(p.replace(/\.json$/, "")) && !current.has(p));
  const manifest = { files: models.filter((m) => MODEL_ID.test(m.id)).map((m) => ({ path: `${m.id}.json`, kind: m.kind, status: m.status, updatedAt: m.updatedAt })) };
  return { writes, deletes, manifest, errors };
}
