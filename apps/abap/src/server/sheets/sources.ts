import { eq } from "drizzle-orm";
import fixtureJson from "../../../data/seed/activities.v1.json";
import type { AppConfig } from "../config";
import { encrypt } from "../auth/crypto";
import { fetchSheetValues, type Fetch } from "../auth/google";
import { googleAccess, GoogleNotConnectedError } from "../google-token";
import type { Db } from "../db/client";
import { appSettings, googleCredentials } from "../db/schema";

export interface SheetSource {
  kind: "google" | "fixture";
  /** Human description shown in the UI (never contains secrets). */
  label: string;
  read(): Promise<unknown[][]>;
}

export class SheetsNotConnectedError extends Error {}

export const SHEETS_CREDENTIAL_ID = "sheets";

export async function storeSheetsCredential(db: Db, cfg: AppConfig, p: { email: string; scope: string; refreshToken: string }, now: string) {
  if (!cfg.tokenKey) throw new Error("TOKEN_ENCRYPTION_KEY not configured");
  const sealed = await encrypt(p.refreshToken, cfg.tokenKey);
  const row = { id: SHEETS_CREDENTIAL_ID, email: p.email, scope: p.scope, ...sealed, updatedAt: now };
  await db.insert(googleCredentials).values(row).onConflictDoUpdate({ target: googleCredentials.id, set: row });
}

export async function sheetsConnection(db: Db) {
  const [c] = await db
    .select({ email: googleCredentials.email, scope: googleCredentials.scope, updatedAt: googleCredentials.updatedAt })
    .from(googleCredentials)
    .where(eq(googleCredentials.id, SHEETS_CREDENTIAL_ID));
  return c ?? null;
}

/** Reads DATA_Activities with the stored, encrypted refresh token of the account that connected the sheet. */
export class GoogleSheetSource implements SheetSource {
  kind = "google" as const;
  label: string;
  constructor(
    private readonly db: Db,
    private readonly cfg: AppConfig,
    private readonly spreadsheetId: string | null,
    private readonly f: Fetch = fetch,
  ) {
    this.label = `Google Sheets · ${cfg.sheetRange}`;
  }
  async read() {
    const spreadsheetId = this.spreadsheetId;
    if (!spreadsheetId) throw new SheetsNotConnectedError("Nenhuma planilha vinculada a este projeto: vincule em Projects.");
    try {
      const { accessToken } = await googleAccess(this.db, this.cfg, this.f);
      return await fetchSheetValues({ accessToken, spreadsheetId, range: this.cfg.sheetRange }, this.f);
    } catch (e) {
      if (e instanceof GoogleNotConnectedError) throw new SheetsNotConnectedError(e.message);
      throw e;
    }
  }
}

export const DEV_SHEET_OVERRIDES = "dev.sheetOverrides";
const HEADER = ["ID", "Phase", "Area", "Activity", "Objective", "Tutorial", "Knowledge", "Tool", "Deliverable", "Dependency", "Acceptance", "Reference", "Status", "Priority", "Owner", "Due", "Evidence", "Notes"] as const;
type Column = (typeof HEADER)[number];

/**
 * Development only: the workbook fixture rendered as sheet rows, plus cell overrides stored in
 * app_settings (set through the dev endpoint) to simulate edits in Google Sheets.
 */
export class FixtureSheetSource implements SheetSource {
  kind = "fixture" as const;
  label = "Fixture local (desenvolvimento) · data/seed/activities.v1.json";
  constructor(private readonly db: Db) {}
  async read() {
    const [o] = await this.db.select().from(appSettings).where(eq(appSettings.key, DEV_SHEET_OVERRIDES));
    const overrides = (o ? JSON.parse(o.value) : {}) as Record<string, Partial<Record<Column, string>>>;
    const rows = (fixtureJson.activities as Record<string, string>[]).map((a) => HEADER.map((h) => overrides[a.ID!]?.[h] ?? a[h] ?? ""));
    return [["DATA_Activities — tabela central (tblActivities)"], [], [...HEADER], ...rows];
  }
}
