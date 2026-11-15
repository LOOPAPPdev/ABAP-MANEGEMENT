// Loop Consultoria landing page: serves one HTML page and stores contact requests in D1.
import page from "./index.html";
// @abap/ui — imported at build time from the monorepo package (single source for theme and shared primitives).
import themeLoop from "../../packages/ui/theme/loop.css";
import button from "../../packages/ui/components/button.css";
import card from "../../packages/ui/components/card.css";
import badge from "../../packages/ui/components/badge.css";
import field from "../../packages/ui/components/field.css";
import separator from "../../packages/ui/components/separator.css";

const UI_CSS = ["/* @abap/ui · theme loop + shared primitives */", themeLoop, button, card, badge, field, separator].join("\n");

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
const HEADERS = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000",
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...HEADERS } });
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function lead(request, env) {
  if (!(request.headers.get("content-type") || "").includes("application/json")) return json({ ok: false, error: "invalid_content_type" }, 415);
  const raw = await request.text();
  if (raw.length > 4000) return json({ ok: false, error: "too_large" }, 413);
  let b;
  try { b = JSON.parse(raw); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  if (text(b.website, 200)) return json({ ok: true }); // honeypot: pretend success, store nothing
  const name = text(b.name, 80), company = text(b.company, 80), email = text(b.email, 120).toLowerCase(), message = text(b.message, 600);
  if (!name || !company || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || b.consent !== true) return json({ ok: false, error: "invalid_fields" }, 400);
  // Basic flood limit: at most 30 requests stored per hour for the whole site.
  const recent = await env.DB.prepare("SELECT count(*) AS n FROM leads WHERE created_at > ?").bind(new Date(Date.now() - 3600_000).toISOString()).first();
  if (recent && recent.n >= 30) return json({ ok: false, error: "busy" }, 429);
  await env.DB.prepare("INSERT INTO leads (name, company, email, message, consent_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(name, company, email, message, new Date().toISOString(), new Date().toISOString()).run();
  return json({ ok: true }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/lead") return request.method === "POST" ? lead(request, env) : json({ ok: false, error: "method_not_allowed" }, 405);
    if (url.pathname === "/ui.css" && (request.method === "GET" || request.method === "HEAD"))
      return new Response(UI_CSS, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=300", ...HEADERS } });
    if (url.pathname === "/robots.txt") return new Response("User-agent: *\nAllow: /\n", { headers: { "content-type": "text/plain" } });
    if (url.pathname === "/" && (request.method === "GET" || request.method === "HEAD"))
      return new Response(page, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", ...HEADERS } });
    return new Response("Página não encontrada", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", ...HEADERS } });
  },
};
