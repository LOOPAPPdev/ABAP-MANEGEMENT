import { z } from "zod";

/**
 * Runtime configuration from Worker vars/secrets (validated; never trusted blindly).
 * All account-specific values (client ID/secret, spreadsheet ID, allowed e-mails) are secrets.
 */
const raw = z.object({
  ENVIRONMENT: z.enum(["development", "production"]).catch("development"),
  GOOGLE_CLIENT_ID: z.string().trim().min(1).optional().catch(undefined),
  GOOGLE_CLIENT_SECRET: z.string().trim().min(1).optional().catch(undefined),
  SESSION_SECRET: z.string().min(32).optional().catch(undefined),
  TOKEN_ENCRYPTION_KEY: z.string().trim().optional().catch(undefined),
  ALLOWED_EMAILS: z.string().optional().catch(undefined),
  SPREADSHEET_ID: z.string().trim().regex(/^[A-Za-z0-9_-]{20,}$/).optional().catch(undefined),
  SHEET_RANGE: z.string().trim().min(1).catch("DATA_Activities!A1:R200"),
  /** Machine token for read-only automation (npm run docs:pull). Optional; at least 32 characters. */
  ABAP_API_TOKEN: z.string().min(32).optional().catch(undefined),
});

export type AuthMode = "google" | "dev-bypass" | "misconfigured";

export interface AppConfig {
  environment: "development" | "production";
  auth: AuthMode;
  /** Why auth is misconfigured (names of missing settings only, never values). */
  missing: string[];
  google?: { clientId: string; clientSecret: string };
  sessionSecret?: string;
  tokenKey?: string;
  allowedEmails: string[];
  spreadsheetId?: string;
  sheetRange: string;
  apiToken?: string;
}

export function parseConfig(env: unknown): AppConfig {
  const e = raw.parse(env ?? {});
  const allowedEmails = (e.ALLOWED_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
  const keyOk = !!e.TOKEN_ENCRYPTION_KEY && /^[A-Za-z0-9+/]{43}=$/.test(e.TOKEN_ENCRYPTION_KEY); // 32 bytes, base64
  const required: [string, boolean][] = [
    ["GOOGLE_CLIENT_ID", !!e.GOOGLE_CLIENT_ID],
    ["GOOGLE_CLIENT_SECRET", !!e.GOOGLE_CLIENT_SECRET],
    ["SESSION_SECRET", !!e.SESSION_SECRET],
    ["TOKEN_ENCRYPTION_KEY", keyOk],
    ["ALLOWED_EMAILS", allowedEmails.length > 0],
  ];
  const missing = required.filter(([, ok]) => !ok).map(([n]) => n);
  // Production fails closed. Development uses a local bypass only when Google is not configured at all.
  const auth: AuthMode =
    missing.length === 0 ? "google" : e.ENVIRONMENT === "production" || e.GOOGLE_CLIENT_ID ? "misconfigured" : "dev-bypass";
  return {
    environment: e.ENVIRONMENT,
    auth,
    missing: auth === "misconfigured" ? missing : [],
    google: e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET ? { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } : undefined,
    sessionSecret: e.SESSION_SECRET,
    tokenKey: keyOk ? e.TOKEN_ENCRYPTION_KEY : undefined,
    allowedEmails,
    spreadsheetId: e.SPREADSHEET_ID,
    sheetRange: e.SHEET_RANGE,
    apiToken: e.ABAP_API_TOKEN,
  };
}
