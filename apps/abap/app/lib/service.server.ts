import type { AppLoadContext } from "react-router";
import { requestedProject } from "~/server/api/project-context";
import { getDb } from "~/server/db/client";
import { GovernanceService, systemClock } from "~/server/governance-service";
import { ProjectService, type Project } from "~/server/projects";
import { syncServiceFor } from "~/server/sheets/factory";
import { ModelService } from "~/server/models";

/** Actor recorded in the audit trail: the signed-in e-mail, or "local-dev" in the development bypass. */
export function actorFrom(context: AppLoadContext): string {
  return context.user?.email ?? "local-dev";
}

export function projectsFrom(context: AppLoadContext) {
  return new ProjectService(context.cloudflare.env.DB, systemClock);
}

/** Current project: ?project=, else the gs_project cookie, else "default". */
export function projectFrom(context: AppLoadContext, request: Request): Promise<Project> {
  return projectsFrom(context).resolve(requestedProject(request.url, request.headers.get("cookie")));
}

export function serviceFrom(context: AppLoadContext, project: Pick<Project, "id">) {
  return new GovernanceService(getDb(context.cloudflare.env.DB), systemClock, project.id);
}

export function syncFrom(context: AppLoadContext, project: Pick<Project, "id" | "spreadsheetId">) {
  return syncServiceFor(context.cfg, context.cloudflare.env.DB, systemClock, project);
}

export function modelsFrom(context: AppLoadContext, project: Pick<Project, "id">) {
  return new ModelService(context.cloudflare.env.DB, systemClock, project.id);
}
