import { eq } from "drizzle-orm";
import type { AppConfig } from "./config";
import { decrypt } from "./auth/crypto";
import { refreshAccessToken, type Fetch } from "./auth/google";
import type { Db } from "./db/client";
import { googleCredentials } from "./db/schema";

export class GoogleNotConnectedError extends Error {}
export const CREDENTIAL_ID = "sheets"; // single connection used for Sheets and Drive

/** Short-lived access token from the stored (encrypted) refresh token, plus the granted scopes. */
export async function googleAccess(db: Db, cfg: AppConfig, f: Fetch = fetch): Promise<{ accessToken: string; scopes: string[]; email: string }> {
  if (!cfg.google || !cfg.tokenKey) throw new GoogleNotConnectedError("Google não configurado no servidor (client ou chave ausente).");
  const [cred] = await db.select().from(googleCredentials).where(eq(googleCredentials.id, CREDENTIAL_ID));
  if (!cred) throw new GoogleNotConnectedError("Conta Google ainda não conectada: use Settings → Conectar Google.");
  const refreshToken = await decrypt(cred, cfg.tokenKey);
  return { accessToken: await refreshAccessToken({ refreshToken, ...cfg.google }, f), scopes: cred.scope.split(/\s+/), email: cred.email };
}
