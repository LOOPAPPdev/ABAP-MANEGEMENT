import { z } from "zod";

/**
 * Runtime configuration from Worker vars/secrets (validated; never trusted blindly).
 * All account-specific values (client ID/secret, spreadsheet ID, allowed e-mails) are secrets.
 */
const raw = z.object({
  ENVIRONMENT: z.enum(["development", "production"]).catch("development"),
  PUBLIC_ACCESS: z.enum(["true", "false"]).optional().catch(undefined),
  /** Optional standalone login; configure as a Cloudflare secret (at least 24 characters). */
  ABAP_ACCESS_PASSWORD: z.string().optional().catch(undefined),
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

export type AuthMode = "public" | "password" | "dev-bypass" | "misconfigured";

export interface AppConfig {
  environment: "development" | "production";
  auth: AuthMode;
  /** Why auth is misconfigured (names of missing settings only, never values). */
  missing: string[];
  google?: { clientId: string; clientSecret: string };
  /** Password is only supplied through a Worker secret; never exposed to loaders or the browser. */
  accessPassword?: string;
  sessionSecret?: string;
  tokenKey?: string;
  allowedEmails: string[];
  spreadsheetId?: string;
  sheetRange: string;
  apiToken?: string;
}

export function parseConfig(env: unknown): AppConfig {
  const e = raw.parse(env ?? {});
  const allowedEmails: string[] = [];
  const keyOk = !!e.TOKEN_ENCRYPTION_KEY && /^[A-Za-z0-9+/]{43}=$/.test(e.TOKEN_ENCRYPTION_KEY); // 32 bytes, base64
  const passwordSelected = !!e.ABAP_ACCESS_PASSWORD;
  const passwordMissing = [
    ...((e.ABAP_ACCESS_PASSWORD?.length ?? 0) < 24 ? ["ABAP_ACCESS_PASSWORD (mínimo 24 caracteres)"] : []),
    ...(!e.SESSION_SECRET ? ["SESSION_SECRET"] : []),
  ];
  // Password login takes precedence when configured. Production never falls back to the dev bypass.
  const auth: AuthMode = e.PUBLIC_ACCESS === "true" ? "public" : passwordSelected
    ? passwordMissing.length === 0 ? "password" : "misconfigured"
    : e.ENVIRONMENT === "production" ? "misconfigured" : "dev-bypass";
  const missing = passwordSelected ? passwordMissing : ["ABAP_ACCESS_PASSWORD", ...(!e.SESSION_SECRET ? ["SESSION_SECRET"] : [])];
  return {
    environment: e.ENVIRONMENT,
    auth,
    missing: auth === "misconfigured" ? missing : [],
    google: e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET ? { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } : undefined,
    accessPassword: auth === "password" ? e.ABAP_ACCESS_PASSWORD : undefined,
    sessionSecret: e.SESSION_SECRET,
    tokenKey: keyOk ? e.TOKEN_ENCRYPTION_KEY : undefined,
    allowedEmails,
    spreadsheetId: e.SPREADSHEET_ID,
    sheetRange: e.SHEET_RANGE,
    apiToken: e.ABAP_API_TOKEN,
  };
}
