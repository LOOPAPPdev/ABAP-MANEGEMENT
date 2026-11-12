/**
 * Fallback static file serving from Workers KV (binding STATIC).
 *
 * Used only when the Worker is deployed without the Workers Static Assets binding
 * (`npm run deploy:kv-assets`, needed where the assets upload API is not reachable).
 * With the standard `npm run deploy`, Cloudflare serves /assets/* before the Worker runs.
 */
const TYPES: Record<string, string> = {
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  ico: "image/x-icon",
  woff2: "font/woff2",
  txt: "text/plain; charset=utf-8",
  map: "application/json",
};

export async function serveFromKv(kv: KVNamespace, path: string): Promise<Response | null> {
  const key = path.replace(/^\//, "");
  if (!/^assets\/[A-Za-z0-9._-]+$/.test(key)) return null;
  const value = await kv.get(key, "arrayBuffer");
  if (!value) return null;
  const ext = key.split(".").pop() ?? "";
  return new Response(value, {
    headers: {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      // File names are content-hashed by the build: safe to cache forever.
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
