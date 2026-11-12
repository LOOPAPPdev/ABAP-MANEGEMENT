import type { AppLoadContext } from "react-router";
import { getDb } from "~/server/db/client";
import { GovernanceService, systemClock } from "~/server/governance-service";
import { syncServiceFor } from "~/server/sheets/factory";

/** Actor recorded in the audit trail: the signed-in e-mail, or "local-dev" in the development bypass. */
export function actorFrom(context: AppLoadContext): string {
  return context.user?.email ?? "local-dev";
}

export function serviceFrom(context: AppLoadContext) {
  return new GovernanceService(getDb(context.cloudflare.env.DB));
}

export function syncFrom(context: AppLoadContext) {
  return syncServiceFor(context.cfg, context.cloudflare.env.DB, systemClock);
}
