import { zipFiles } from "~/domain/agents";
import { ClientAgentService } from "~/server/client-agents";
import { systemClock } from "~/server/governance-service";
import { projectFrom } from "../lib/service.server";
import type { Route } from "./+types/agent-zip";

/** Download of the latest generated client plugin as a .zip (files under <plugin-name>/). */
export async function loader({ context, request }: Route.LoaderArgs) {
  const project = await projectFrom(context, request);
  const agent = await new ClientAgentService(context.cloudflare.env.DB, systemClock, project).get();
  if (!agent) throw new Response("Agente ainda não gerado", { status: 404 });
  const zip = zipFiles(agent.files.map((f) => ({ path: `${agent.name}/${f.path}`, content: f.content })));
  return new Response(new Blob([zip as BlobPart]), {
    headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${agent.name}-${agent.version}.zip"`, "cache-control": "no-store" },
  });
}
