import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
  route("projects", "routes/projects.tsx"),
  route("activities", "routes/activities.tsx"),
  route("activities/:id", "routes/activity.tsx"),
  route("evidence", "routes/evidence.tsx"),
  route("sheets", "routes/sheets.tsx"),
  route("docs", "routes/docs.tsx"),
  route("models", "routes/models.tsx"),
  route("models/:modelId", "routes/model.tsx"),
  route("agent", "routes/agent.tsx"),
  route("studio", "routes/studio-index.tsx"),
  route("studio/:projectId", "routes/studio.tsx"),
  route("agent.zip", "routes/agent-zip.ts"),
  route("canvas", "routes/canvas.tsx"),
  route("showcase", "routes/showcase.tsx"),
  route("settings", "routes/settings.tsx"),
] satisfies RouteConfig;
