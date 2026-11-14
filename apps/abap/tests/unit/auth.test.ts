import { describe, expect, it } from "vitest";
import { parseConfig } from "~/server/config";
import { decrypt, encrypt, signJson, verifyJson } from "~/server/auth/crypto";
import { buildAuthUrl, fakeIdToken, readIdToken, SCOPE_SHEETS } from "~/server/auth/google";
import { createSession, readCookie, readSession, safeReturnTo } from "~/server/auth/session";

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const SECRET = "s".repeat(40);
const full = {
  ENVIRONMENT: "production",
  GOOGLE_CLIENT_ID: "cid.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "x",
  SESSION_SECRET: SECRET,
  TOKEN_ENCRYPTION_KEY: KEY,
  ALLOWED_EMAILS: "A@Example.com, b@example.com",
  SPREADSHEET_ID: "1TestSpreadsheetIdAbcdefghijklmnopqrstuvwx",
};

describe("Feature: configuration fails closed", () => {
  it("GIVEN every secret WHEN parsed THEN Google auth is on and e-mails are normalized", () => {
    const c = parseConfig(full);
    expect(c.auth).toBe("google");
    expect(c.allowedEmails).toEqual(["a@example.com", "b@example.com"]);
    expect(c.sheetRange).toBe("DATA_Activities!A1:R200");
  });
  it("GIVEN production without secrets THEN auth is misconfigured (never bypassed) and lists missing names only", () => {
    const c = parseConfig({ ENVIRONMENT: "production" });
    expect(c.auth).toBe("misconfigured");
    expect(c.missing).toEqual(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET", "TOKEN_ENCRYPTION_KEY", "ALLOWED_EMAILS"]);
  });
  it("GIVEN development without Google THEN the local bypass is used", () => {
    expect(parseConfig({}).auth).toBe("dev-bypass");
  });
  it("GIVEN development with a partial Google setup THEN it is misconfigured, not bypassed", () => {
    expect(parseConfig({ GOOGLE_CLIENT_ID: "x" }).auth).toBe("misconfigured");
  });
  it("rejects a weak encryption key", () => {
    expect(parseConfig({ ...full, TOKEN_ENCRYPTION_KEY: "short" }).auth).toBe("misconfigured");
  });
});

describe("Feature: signed session and encrypted token", () => {
  it("round-trips and rejects tampering", async () => {
    const t = await signJson({ a: 1 }, SECRET);
    expect(await verifyJson(t, SECRET)).toEqual({ a: 1 });
    expect(await verifyJson(t.replace(/.$/, (ch) => (ch === "A" ? "B" : "A")), SECRET)).toBeNull();
    expect(await verifyJson(t, "other-secret-of-sufficient-length-123")).toBeNull();
  });
  it("expires sessions", async () => {
    const t = await createSession({ email: "a@example.com" }, SECRET, 0);
    expect(await readSession(t, SECRET, 1000)).toEqual({ email: "a@example.com", name: undefined });
    expect(await readSession(t, SECRET, 8 * 24 * 3600 * 1000)).toBeNull();
  });
  it("encrypts the refresh token with AES-GCM", async () => {
    const sealed = await encrypt("1//refresh-token", KEY);
    expect(sealed.ciphertext).not.toContain("refresh");
    expect(await decrypt(sealed, KEY)).toBe("1//refresh-token");
  });
  it("only allows relative return paths (no open redirect)", () => {
    expect(safeReturnTo("/sheets?x=1")).toBe("/sheets?x=1");
    expect(safeReturnTo("//evil.com")).toBe("/dashboard");
    expect(safeReturnTo("https://evil.com")).toBe("/dashboard");
  });
  it("reads cookies", () => {
    expect(readCookie("a=1; gs_session=abc%3D; b=2", "gs_session")).toBe("abc=");
  });
});

describe("Feature: Google OAuth requests", () => {
  it("login URL uses PKCE S256 and no offline access", async () => {
    const u = new URL(await buildAuthUrl({ clientId: "cid", redirectUri: "https://x/auth/google/callback", state: "st", verifier: "v".repeat(43), scope: "openid email", offline: false }));
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(u.searchParams.has("access_type")).toBe(false);
  });
  it("sheets URL asks for offline access with consent", async () => {
    const u = new URL(await buildAuthUrl({ clientId: "cid", redirectUri: "r", state: "s", verifier: "v", scope: `openid ${SCOPE_SHEETS}`, offline: true }));
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("scope")).toContain("spreadsheets.readonly");
  });
  it("checks issuer, audience and expiry of the ID token", () => {
    const ok = fakeIdToken({ iss: "https://accounts.google.com", aud: "cid", exp: 2e9, email: "A@x.com", email_verified: true });
    expect(readIdToken(ok, "cid", 0)).toMatchObject({ email: "a@x.com", emailVerified: true });
    expect(() => readIdToken(ok, "other", 0)).toThrow(/audience/);
    expect(() => readIdToken(fakeIdToken({ iss: "evil", aud: "cid", exp: 2e9, email: "a@x.com" }), "cid", 0)).toThrow(/issuer/);
  });
});
