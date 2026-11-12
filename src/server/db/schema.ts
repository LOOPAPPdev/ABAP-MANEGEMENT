import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const activities = sqliteTable(
  "activities",
  {
    projectId: text("project_id").notNull().references(() => projects.id),
    id: text("id").notNull(), // ACT-xx, stable workbook ID
    phase: text("phase").notNull(),
    area: text("area").notNull(),
    title: text("title").notNull(),
    objective: text("objective").notNull().default(""),
    tutorial: text("tutorial").notNull().default(""),
    knowledge: text("knowledge").notNull().default(""),
    tool: text("tool").notNull().default(""),
    deliverable: text("deliverable").notNull().default(""),
    dependencyId: text("dependency_id"),
    acceptance: text("acceptance").notNull(),
    reference: text("reference").notNull().default(""),
    status: text("status").notNull(),
    priority: text("priority").notNull(),
    owner: text("owner").notNull().default(""),
    due: text("due"),
    notes: text("notes").notNull().default(""),
    updatedAt: text("updated_at").notNull(),
    updatedBy: text("updated_by").notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.id] })],
);

export const evidence = sqliteTable(
  "evidence",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    activityId: text("activity_id").notNull(),
    kind: text("kind").notNull(), // link | commit | file | text
    ref: text("ref").notNull(),
    note: text("note").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("evidence_activity_idx").on(t.projectId, t.activityId)],
);

/** Append-only audit log. */
export const activityEvents = sqliteTable(
  "activity_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: text("project_id").notNull(),
    activityId: text("activity_id").notNull(),
    actor: text("actor").notNull(),
    action: text("action").notNull(), // status.changed | evidence.added
    fromValue: text("from_value"),
    toValue: text("to_value"),
    at: text("at").notNull(),
  },
  (t) => [index("events_activity_idx").on(t.projectId, t.activityId)],
);
