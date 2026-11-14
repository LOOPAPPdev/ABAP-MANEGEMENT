import type { Context } from "hono";
import { readCookie } from "../auth/session";
import type { Clock } from "../governance-service";
import { ProjectService } from "../projects";

export const PROJECT_COOKIE = "gs_project";

/** Requested project: `?project=` wins, then the current-project cookie, then "default". */
export function requestedProject(url: string, cookieHeader: string | null | undefined): string | null {
  return new URL(url).searchParams.get("project") ?? readCookie(cookieHeader, PROJECT_COOKIE) ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function projectOf(c: Context<any>, clock: Clock) {
  return new ProjectService(c.env.DB, clock).resolve(requestedProject(c.req.url, c.req.header("cookie")));
}
