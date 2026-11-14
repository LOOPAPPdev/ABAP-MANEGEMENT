import { DEFAULT_PROJECT } from "~/domain/projects";
import type { AppConfig } from "../config";
import type { Fetch } from "../auth/google";
import { getDb } from "../db/client";
import type { Clock } from "../governance-service";
import { FixtureSheetSource, GoogleSheetSource, type SheetSource } from "./sources";
import { SheetSyncService } from "./sync-service";

export interface ProjectRef {
  id: string;
  spreadsheetId: string | null;
}

/** Spreadsheet of a project: its own link; the default project may still use the SPREADSHEET_ID secret. */
export function spreadsheetIdFor(cfg: AppConfig, project: ProjectRef): string | null {
  return project.spreadsheetId ?? (project.id === DEFAULT_PROJECT ? (cfg.spreadsheetId ?? null) : null);
}

/** Google source when Google is configured; the local fixture only in the development bypass. */
export function sheetSourceFor(cfg: AppConfig, d1: D1Database, project: ProjectRef, f?: Fetch): SheetSource {
  const db = getDb(d1);
  return cfg.auth === "dev-bypass" ? new FixtureSheetSource(db) : new GoogleSheetSource(db, cfg, spreadsheetIdFor(cfg, project), f);
}

export function syncServiceFor(cfg: AppConfig, d1: D1Database, clock: Clock, project: ProjectRef, f?: Fetch) {
  return new SheetSyncService(getDb(d1), sheetSourceFor(cfg, d1, project, f), clock, project.id);
}
