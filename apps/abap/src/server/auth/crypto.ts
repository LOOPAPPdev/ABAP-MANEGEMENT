/** WebCrypto helpers (Workers and Node 22). */
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(bytes: Uint8Array | ArrayBuffer): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesOf(binary: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  return bytesOf(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)));
}

const fromB64 = (s: string) => bytesOf(atob(s));

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256b64url(input: string): Promise<string> {
  return b64url(await crypto.subtle.digest("SHA-256", enc.encode(input)));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** Returns `payload.signature` where payload is base64url(JSON). */
export async function signJson(value: unknown, secret: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify(value)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

/** Verifies the HMAC (constant-time via WebCrypto verify) and returns the parsed JSON, or null. */
export async function verifyJson<T>(token: string | undefined, secret: string): Promise<T | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64url(sig), enc.encode(payload));
    return ok ? (JSON.parse(dec.decode(fromB64url(payload))) as T) : null;
  } catch {
    return null;
  }
}

async function aesKey(keyB64: string) {
  return crypto.subtle.importKey("raw", fromB64(keyB64), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encrypt(plaintext: string, keyB64: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(keyB64), enc.encode(plaintext));
  return { ciphertext: b64url(ct), iv: b64url(iv) };
}

export async function decrypt(data: { ciphertext: string; iv: string }, keyB64: string): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64url(data.iv) }, await aesKey(keyB64), fromB64url(data.ciphertext));
  return dec.decode(pt);
}
