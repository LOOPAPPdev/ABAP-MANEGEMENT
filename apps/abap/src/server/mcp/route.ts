import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import type { Fetch } from "../auth/google";
import { MCP_PATH, type AuthVariables } from "../auth/middleware";
import { parseConfig } from "../config";
import { systemClock, type Clock } from "../governance-service";
import { buildMcpServer } from "./server";

/** POST /mcp — stateless Streamable HTTP (one server per request, JSON responses). Auth happens in authGate. */
export function createMcpRoute(clock: Clock = systemClock, deps: { fetch?: Fetch } = {}) {
  const app = new Hono<{ Bindings: { DB: D1Database }; Variables: Partial<AuthVariables> }>();
  app.post(MCP_PATH, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ ok: false, error: "unauthenticated" }, 401);
    const server = buildMcpServer({ db: c.env.DB, cfg: c.get("cfg") ?? parseConfig(c.env), clock, user, fetch: deps.fetch });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });
  app.on(["GET", "DELETE"], MCP_PATH, (c) => c.json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server: use POST)" }, id: null }, 405));
  return app;
}
