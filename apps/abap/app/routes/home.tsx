import { redirect } from "react-router";
import { homeFor } from "~/domain/studio";
import type { Route } from "./+types/home";

export function loader({ context }: Route.LoaderArgs) {
  return redirect(context.user?.access ? homeFor(context.user.access) : "/dashboard");
}
