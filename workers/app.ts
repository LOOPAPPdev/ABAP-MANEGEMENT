import { Hono } from "hono";
import { createRequestHandler } from "react-router";
import { createApi } from "~/server/api/app";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: { env: Env; ctx: ExecutionContext };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

const app = new Hono<{ Bindings: Env }>();

// API first, then React Router for every other path.
app.route("/", createApi());
app.all("/api/*", (c) => c.json({ ok: false, error: "not_found" }, 404));
app.all("*", (c) =>
  requestHandler(c.req.raw, { cloudflare: { env: c.env, ctx: c.executionCtx as ExecutionContext } }),
);

export default app;
