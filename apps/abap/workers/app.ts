import { Hono } from "hono";
import { createRequestHandler } from "react-router";
import { createApi } from "~/server/api/app";
import { authGate, type AppUser, type AuthVariables } from "~/server/auth/middleware";
import { createAuthRoutes } from "~/server/auth/routes";
import type { AppConfig } from "~/server/config";
import { serveFromKv } from "~/server/static-kv";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: { env: Env; ctx: ExecutionContext };
    /** Signed-in user (null on public pages such as /login). */
    user: AppUser | null;
    cfg: AppConfig;
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// 1. Authentication gate (fails closed in production), 2. OAuth routes, 3. API, 4. pages.
app.use("*", authGate());
// Static files from KV only when deployed without the Static Assets binding (see deploy:kv-assets).
app.get("/assets/*", async (c, next) => {
  const kv = (c.env as unknown as { STATIC?: KVNamespace }).STATIC;
  if (!kv) return next();
  return (await serveFromKv(kv, c.req.path)) ?? c.text("Not found", 404);
});
app.route("/", createAuthRoutes());
app.route("/", createApi());
app.all("/api/*", (c) => c.json({ ok: false, error: "not_found" }, 404));
app.all("*", (c) =>
  requestHandler(c.req.raw, {
    cloudflare: { env: c.env, ctx: c.executionCtx as ExecutionContext },
    user: c.get("user"),
    cfg: c.get("cfg"),
  }),
);

export default app;
