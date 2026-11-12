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

/** Key/value application settings (e.g. sheets.syncMode). */
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
});

/**
 * Google OAuth refresh token used by the server to read the spreadsheet.
 * Stored encrypted (AES-GCM, key in the TOKEN_ENCRYPTION_KEY secret). Never sent to the browser.
 */
export const googleCredentials = sqliteTable("google_credentials", {
  id: text("id").primaryKey(), // "sheets"
  email: text("email").notNull(),
  scope: text("scope").notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Last spreadsheet values seen per activity: the base of the three-way sync. */
export const sheetSnapshots = sqliteTable(
  "sheet_snapshots",
  {
    projectId: text("project_id").notNull(),
    activityId: text("activity_id").notNull(),
    valuesJson: text("values_json").notNull(),
    syncedAt: text("synced_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.activityId] })],
);

/** One row per spreadsheet read (auto or manual), for traceability. */
export const syncRuns = sqliteTable("sync_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  mode: text("mode").notNull(), // auto | manual
  actor: text("actor").notNull(),
  source: text("source").notNull(), // google | fixture
  readAt: text("read_at").notNull(),
  applied: integer("applied").notNull(),
  conflicts: integer("conflicts").notNull(),
  invalid: integer("invalid").notNull(),
  status: text("status").notNull(), // ok | error
  message: text("message").notNull().default(""),
});
