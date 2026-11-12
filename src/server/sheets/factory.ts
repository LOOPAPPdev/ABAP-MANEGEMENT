import type { AppConfig } from "../config";
import type { Fetch } from "../auth/google";
import { getDb } from "../db/client";
import type { Clock } from "../governance-service";
import { FixtureSheetSource, GoogleSheetSource, type SheetSource } from "./sources";
import { SheetSyncService } from "./sync-service";

/** Google source when Google is configured; the local fixture only in the development bypass. */
export function sheetSourceFor(cfg: AppConfig, d1: D1Database, f?: Fetch): SheetSource {
  const db = getDb(d1);
  return cfg.auth === "dev-bypass" ? new FixtureSheetSource(db) : new GoogleSheetSource(db, cfg, f);
}

export function syncServiceFor(cfg: AppConfig, d1: D1Database, clock: Clock, f?: Fetch) {
  return new SheetSyncService(getDb(d1), sheetSourceFor(cfg, d1, f), clock);
}
