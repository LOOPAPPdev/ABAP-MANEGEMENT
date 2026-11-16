import type { Context } from "hono";
import type { AuthVariables } from "../auth/middleware";
import { parseConfig } from "../config";
import { actorSchema } from "./schemas";

type Ctx = Context<{ Bindings: { DB: D1Database }; Variables: Partial<AuthVariables> }>;

/** Authenticated e-mail when Google login is on; otherwise the X-Actor header (local development only). */
export function actorOf(c: Ctx): string {
  const user = c.get("user");
  if (user && user.mode !== "dev") return user.email;
  const cfg = c.get("cfg") ?? parseConfig(c.env);
  return cfg.auth === "dev-bypass" ? actorSchema.parse(c.req.header("x-actor")) : "unknown";
}
