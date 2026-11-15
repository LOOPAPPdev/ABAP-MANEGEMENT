import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db/client";
import { apiTokens } from "./db/schema";
import type { Clock } from "./governance-service";

export const TOKEN_ROLES = ["read", "write"] as const;
export type TokenRole = (typeof TOKEN_ROLES)[number];
export const newTokenSchema = z.object({
  name: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,39}$/, "use 2–40 letras minúsculas, números e hífens (ex.: joao-laptop)"),
  role: z.enum(TOKEN_ROLES),
});
export type TokenInfo = Omit<typeof apiTokens.$inferSelect, "hash">;
export const TOKEN_PREFIX = "abap_";

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export async function hashToken(token: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function strip(row: typeof apiTokens.$inferSelect): TokenInfo {
  const info: Partial<typeof apiTokens.$inferSelect> = { ...row };
  delete info.hash;
  return info as TokenInfo;
}

/** Personal tokens: create (plaintext returned once), list, revoke, verify. */
export class TokenService {
  private readonly db;
  constructor(
    d1: D1Database,
    private readonly clock: Clock,
  ) {
    this.db = getDb(d1);
  }

  async create(input: z.infer<typeof newTokenSchema>, owner: string): Promise<{ token: string; info: TokenInfo }> {
    const token = TOKEN_PREFIX + b64url(crypto.getRandomValues(new Uint8Array(32)));
    const id = b64url(crypto.getRandomValues(new Uint8Array(9)));
    const row = { id, name: input.name, owner, role: input.role, hash: await hashToken(token), prefix: token.slice(0, 10), createdAt: this.clock().toISOString() };
    await this.db.insert(apiTokens).values(row);
    return { token, info: strip({ ...row, lastUsedAt: null, revokedAt: null, revokedBy: null }) };
  }

  async list(): Promise<TokenInfo[]> {
    const rows = await this.db.select().from(apiTokens).orderBy(desc(apiTokens.createdAt));
    return rows.map(strip);
  }

  async revoke(id: string, actor: string): Promise<boolean> {
    const [row] = await this.db.select().from(apiTokens).where(eq(apiTokens.id, id));
    if (!row || row.revokedAt) return false;
    await this.db.update(apiTokens).set({ revokedAt: this.clock().toISOString(), revokedBy: actor }).where(eq(apiTokens.id, id));
    return true;
  }

  /** Returns the active token for a plaintext value, or null. Records last use (at most once per minute). */
  async verify(token: string): Promise<TokenInfo | null> {
    if (!token.startsWith(TOKEN_PREFIX) || token.length > 200) return null;
    const [row] = await this.db.select().from(apiTokens).where(eq(apiTokens.hash, await hashToken(token)));
    if (!row || row.revokedAt) return null;
    const now = this.clock();
    if (!row.lastUsedAt || now.getTime() - Date.parse(row.lastUsedAt) > 60_000)
      await this.db.update(apiTokens).set({ lastUsedAt: now.toISOString() }).where(eq(apiTokens.id, row.id));
    return strip(row);
  }
}
