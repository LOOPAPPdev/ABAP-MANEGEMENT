// Shared helpers for monorepo tools (no dependencies).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ROOT = new URL("..", import.meta.url).pathname;
export const CLIENTS = join(ROOT, "clients");

export const slugOf = (code, name) =>
  `${code}-${name}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function listClients() {
  if (!existsSync(CLIENTS)) return [];
  return readdirSync(CLIENTS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(CLIENTS, d.name, "client.json")))
    .map((d) => ({ dir: join(CLIENTS, d.name), ...JSON.parse(readFileSync(join(CLIENTS, d.name, "client.json"), "utf8")) }));
}

/** Patterns that must never be committed inside a client folder. */
export const FORBIDDEN = [
  { name: "Google OAuth client secret", re: /GOCSPX-[A-Za-z0-9_-]{10,}/ },
  { name: "Google API key", re: /AIza[0-9A-Za-z_-]{30,}/ },
  { name: "OAuth access token", re: /ya29\.[0-9A-Za-z_-]{20,}/ },
  { name: "refresh token", re: /\b1\/\/[0-9A-Za-z_-]{20,}/ },
  { name: "Drive/Sheets URL with ID", re: /(docs|drive)\.google\.com\/(spreadsheets\/d|document\/d|drive\/folders|file\/d)\/[A-Za-z0-9_-]{20,}/ },
];
