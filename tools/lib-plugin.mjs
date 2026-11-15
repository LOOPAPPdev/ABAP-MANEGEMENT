// Pure helpers for writing a client's generated plugin into clients/<slug>/plugin (no I/O here).
const SAFE_PATH = /^(?:\.claude-plugin\/plugin\.json|README\.md|(?:agents|commands)\/[a-z0-9-]+\.md|skills\/[a-z0-9-]+\/SKILL\.md)$/;

/** Validates the generated files (allow-listed paths only) and plans writes and deletes. */
export function planPlugin(agent, slug, previousManifest = { files: [] }) {
  const errors = [];
  if (agent.name !== `abap-${slug}`) errors.push(`unexpected plugin name: ${String(agent.name).slice(0, 60)}`);
  const writes = [];
  for (const f of agent.files ?? []) {
    if (typeof f.path !== "string" || !SAFE_PATH.test(f.path)) {
      errors.push(`refused path: ${String(f.path).slice(0, 80)}`);
      continue;
    }
    writes.push({ path: f.path, content: String(f.content) });
  }
  const current = new Set(writes.map((w) => w.path));
  const deletes = (previousManifest.files ?? []).filter((p) => SAFE_PATH.test(p) && !current.has(p));
  const manifest = { name: agent.name, version: agent.version, revision: agent.revision, generator: agent.generator, generatedAt: agent.createdAt, files: [...current].sort() };
  return { writes, deletes, manifest, errors };
}

/** Adds or updates the client's plugin entry in the marketplace document. Returns a new object. */
export function registerInMarketplace(marketplace, slug, agent, description) {
  const entry = { name: agent.name, source: `./clients/${slug}/plugin`, description, version: agent.version, author: { name: "LOOP" }, category: "client" };
  const plugins = marketplace.plugins.filter((p) => p.name !== agent.name);
  const at = plugins.findIndex((p) => p.category === "vendor");
  plugins.splice(at === -1 ? plugins.length : at, 0, entry);
  return { ...marketplace, plugins };
}
