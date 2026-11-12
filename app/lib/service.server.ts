import type { AppLoadContext } from "react-router";
import { getDb } from "~/server/db/client";
import { GovernanceService } from "~/server/governance-service";

export const UI_ACTOR = "local-dev"; // Replace when authentication is designed (D-006).

export function serviceFrom(context: AppLoadContext) {
  return new GovernanceService(getDb(context.cloudflare.env.DB));
}
