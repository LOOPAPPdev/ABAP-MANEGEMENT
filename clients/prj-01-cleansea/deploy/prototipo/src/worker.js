// Serves the CleanSea design prototype as a public page (ADR-018).
// "/" opens the prototype entry file. Every HTML page gets a visible notice.
// Search engines are told not to index the site.
const ENTRY = "/Cleansea%20App.dc.html";
const NOTICE =
  "Protótipo de design — dados simulados (SIMULADO), sem integrações reais. Não é o app de produção.";

const banner = `<div role="note" style="font:600 13px/1.4 system-ui,sans-serif;background:#1d1d1f;color:#fff;padding:8px 16px;text-align:center">${NOTICE}</div>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }
    if (url.pathname === "/" || url.pathname === "/index.html") url.pathname = ENTRY;
    if (url.pathname.toLowerCase().endsWith(".md")) return new Response("Not found", { status: 404 });

    let res = await env.ASSETS.fetch(new Request(url, request));
    const type = res.headers.get("content-type") || "";
    if (type.includes("text/html")) {
      res = new HTMLRewriter().on("body", { element: (el) => el.prepend(banner, { html: true }) }).transform(res);
    }
    res = new Response(res.body, res);
    res.headers.set("x-robots-tag", "noindex, nofollow");
    res.headers.set("referrer-policy", "no-referrer");
    res.headers.set("x-content-type-options", "nosniff");
    return res;
  },
};
