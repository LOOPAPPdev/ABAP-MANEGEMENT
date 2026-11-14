import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");

  const body = await renderToReadableStream(<ServerRouter context={routerContext} url={request.url} />, {
    onError(error: unknown) {
      responseStatusCode = 500;
      // Log streaming errors only after the shell rendered; earlier errors reject the promise.
      if (shellRendered) console.error(error);
    },
  });
  shellRendered = true;

  // Wait for the full page for bots and SPA mode so they get complete HTML.
  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  // "no-referrer" makes browsers send `Origin: null` on native form posts, which
  // React Router's CSRF check rejects (progressive enhancement breaks). "same-origin" keeps the origin.
  responseHeaders.set("Referrer-Policy", "same-origin");
  return new Response(body, { headers: responseHeaders, status: responseStatusCode });
}
