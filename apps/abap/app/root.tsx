import { isRouteErrorResponse, Links, Meta, NavLink, Outlet, Scripts, ScrollRestoration, useMatches, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/root";
import "./app.css";

const NAV = [
  ["/dashboard", "Dashboard"],
  ["/activities", "Activities"],
  ["/canvas", "Canvas"],
  ["/evidence", "Evidence"],
  ["/sheets", "Planilha"],
  ["/projects", "Projects"],
  ["/showcase", "Design system"],
  ["/settings", "Settings"],
] as const;

export function loader({ context }: Route.LoaderArgs) {
  return { user: context.user, auth: context.cfg.auth };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const root = useRouteLoaderData<typeof loader>("root");
  // Routes that export handle = { fullBleed: true } (the canvas) use the full viewport width.
  const fullBleed = useMatches().some((m) => (m.handle as { fullBleed?: boolean } | undefined)?.fullBleed);
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:bg-card focus:p-2">
          Skip to content
        </a>
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <span className="font-bold">Governance System</span>
            {root?.user && (
            <nav aria-label="Main">
              <ul className="flex flex-wrap gap-1">
                {NAV.map(([to, label]) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      className={({ isActive }) =>
                        `rounded px-3 py-1.5 text-sm ${isActive ? "bg-brand-tint font-semibold text-brand-fg" : "hover:bg-accent"}`
                      }
                    >
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            )}
            {root?.user && (
              <div className="ml-auto flex items-center gap-2 text-sm">
                <span className="text-muted-foreground" data-testid="current-user">
                  {root.user.mode === "dev" ? "modo local (sem login)" : root.user.email}
                </span>
                {root.user.mode === "google" && (
                  <form method="post" action="/auth/logout">
                    <button type="submit" className="rounded px-2 py-1 text-primary underline hover:bg-accent">Sair</button>
                  </form>
                )}
              </div>
            )}
          </div>
        </header>
        <main id="main" className={fullBleed ? "" : "mx-auto max-w-6xl px-4 py-6"}>
          {children}
        </main>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Error";
  let details = "An unexpected error occurred.";
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }
  return (
    <section>
      <h1 className="text-xl font-bold">{message}</h1>
      <p>{details}</p>
    </section>
  );
}
