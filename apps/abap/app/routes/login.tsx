import { redirect } from "react-router";
import { safeReturnTo } from "~/server/auth/session";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Entrar · Governance System" }];
}

const ERRORS: Record<string, string> = {
  not_configured: "O login ainda não está configurado no servidor. O administrador precisa definir os segredos do Worker.",
  invalid_code: "Código de acesso inválido. Verifique o código e tente novamente.",
  not_allowed: "Esta conta Google não está autorizada. Entre com uma conta da lista de acesso.",
  state: "A tentativa de login expirou ou foi alterada. Tente de novo.",
  denied: "Login cancelado no Google.",
  oauth: "Não foi possível concluir o login com o Google. Tente de novo.",
  sheets_scope: "O Google não concedeu leitura da planilha. Repita e marque a permissão de acesso ao Google Sheets.",
};

export function loader({ context, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  if (context.user && !url.searchParams.get("error")) throw redirect(returnTo);
  const code = url.searchParams.get("error") ?? "";
  return {
    auth: context.cfg.auth,
    missing: context.cfg.auth === "misconfigured" ? context.cfg.missing : [],
    error: code === "not_configured" && context.cfg.auth === "owner-code" ? null : ERRORS[code] ?? (code ? ERRORS.oauth : null),
    loggedOut: url.searchParams.has("loggedOut"),
    returnTo,
  };
}

export default function Login({ loaderData: d }: Route.ComponentProps) {
  return (
    <section className="mx-auto mt-10 max-w-md rounded-md border border-border bg-card p-6" data-component-id="login-panel" aria-labelledby="login-h">
      <h1 id="login-h" className="text-xl font-bold">Entrar</h1>
      <p className="mt-1 text-sm text-muted-foreground">{d.auth === "owner-code" ? "Acesso do proprietário com código seguro. Não requer Google." : "Acesso restrito às contas Google autorizadas."}</p>
      {d.loggedOut && <p role="status" className="mt-3 text-sm">Você saiu do sistema.</p>}
      {d.error && (
        <p role="alert" className="mt-3 rounded border border-destructive p-2 text-sm text-destructive-strong">
          {d.error}
          {d.missing.length > 0 && <span className="block text-xs">Configuração ausente: {d.missing.join(", ")}</span>}
        </p>
      )}
      {d.auth === "google" && (
        <a
          href={`/auth/login?returnTo=${encodeURIComponent(d.returnTo)}`}
          className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Entrar com Google
        </a>
      )}
      {d.auth === "owner-code" && (
        <form method="post" action="/auth/owner" className="mt-5 space-y-3">
          <input type="hidden" name="returnTo" value={d.returnTo} />
          <label htmlFor="owner-code" className="block text-sm font-medium">Código de acesso</label>
          <input
            id="owner-code"
            name="code"
            type="password"
            autoComplete="current-password"
            minLength={48}
            maxLength={1024}
            required
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          />
          <button type="submit" className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Entrar sem Google
          </button>
          <p className="text-xs text-muted-foreground">O código fica nos segredos da Cloudflare. Nunca partilhe o código num link ou numa conversa.</p>
        </form>
      )}
      {d.auth === "dev-bypass" && (
        <p className="mt-4 text-sm">
          Modo local sem login (Google não configurado). <a className="text-primary underline" href="/dashboard">Abrir o dashboard</a>
        </p>
      )}
    </section>
  );
}
