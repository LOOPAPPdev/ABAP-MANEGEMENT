import { redirect } from "react-router";
import { safeReturnTo } from "~/server/auth/session";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Entrar · Governance System" }];
}

const ERRORS: Record<string, string> = {
  not_configured: "O login ainda não está configurado no servidor. Defina ABAP_ACCESS_PASSWORD e SESSION_SECRET no Worker.",
  invalid_credentials: "Senha incorreta. Verifique a senha e tente novamente.",
  state: "A tentativa de login expirou ou foi alterada. Tente de novo.",
};

export function loader({ context, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const code = url.searchParams.get("error") === "not_configured" && context.cfg.auth === "password"
    ? "" : url.searchParams.get("error") ?? "";
  if (context.user && !code) throw redirect(returnTo);
  return {
    auth: context.cfg.auth,
    missing: context.cfg.auth === "misconfigured" ? context.cfg.missing : [],
    error: ERRORS[code] ?? (code ? "Não foi possível entrar. Tente novamente." : null),
    loggedOut: url.searchParams.has("loggedOut"),
    returnTo,
  };
}

export default function Login({ loaderData: d }: Route.ComponentProps) {
  return (
    <section className="mx-auto mt-10 max-w-md rounded-md border border-border bg-card p-6" data-component-id="login-panel" aria-labelledby="login-h">
      <h1 id="login-h" className="text-xl font-bold">Entrar</h1>
      <p className="mt-1 text-sm text-muted-foreground">{d.auth === "password" ? "Acesso protegido por senha." : "Acesso restrito às contas autorizadas."}</p>
      {d.loggedOut && <p role="status" className="mt-3 text-sm">Você saiu do sistema.</p>}
      {d.error && (
        <p role="alert" className="mt-3 rounded border border-destructive p-2 text-sm text-destructive-strong">
          {d.error}
          {d.missing.length > 0 && <span className="block text-xs">Configuração ausente: {d.missing.join(", ")}</span>}
        </p>
      )}
      {d.auth === "password" && (
        <form method="post" action="/auth/password/login" className="mt-5 space-y-3">
          <input type="hidden" name="returnTo" value={d.returnTo} />
          <label htmlFor="access-password" className="block text-sm font-medium">Senha de acesso</label>
          <input id="access-password" name="password" type="password" autoComplete="current-password" required
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-base" />
          <button type="submit" className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Entrar no ABAP
          </button>
        </form>
      )}
      {d.auth === "dev-bypass" && (
        <p className="mt-4 text-sm">
          Modo de desenvolvimento sem autenticação. <a className="text-primary underline" href="/dashboard">Abrir o dashboard</a>
        </p>
      )}
    </section>
  );
}
