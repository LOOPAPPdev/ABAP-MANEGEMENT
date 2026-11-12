import { redirect } from "react-router";
import { safeReturnTo } from "~/server/auth/session";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Entrar · Governance System" }];
}

const ERRORS: Record<string, string> = {
  not_configured: "O login ainda não está configurado no servidor. O administrador precisa definir os segredos do Worker.",
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
    error: ERRORS[code] ?? (code ? ERRORS.oauth : null),
    loggedOut: url.searchParams.has("loggedOut"),
    returnTo,
  };
}

export default function Login({ loaderData: d }: Route.ComponentProps) {
  return (
    <section className="mx-auto mt-10 max-w-md rounded-md border border-border bg-card p-6" data-component-id="login-panel" aria-labelledby="login-h">
      <h1 id="login-h" className="text-xl font-bold">Entrar</h1>
      <p className="mt-1 text-sm text-muted-foreground">Acesso restrito às contas Google autorizadas.</p>
      {d.loggedOut && <p role="status" className="mt-3 text-sm">Você saiu do sistema.</p>}
      {d.error && (
        <p role="alert" className="mt-3 rounded border border-destructive p-2 text-sm text-destructive">
          {d.error}
          {d.missing.length > 0 && <span className="block text-xs">Configuração ausente: {d.missing.join(", ")}</span>}
        </p>
      )}
      {d.auth === "google" && (
        <a
          href={`/auth/login?returnTo=${encodeURIComponent(d.returnTo)}`}
          className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-brand-fg"
        >
          Entrar com Google
        </a>
      )}
      {d.auth === "dev-bypass" && (
        <p className="mt-4 text-sm">
          Modo local sem login (Google não configurado). <a className="text-primary underline" href="/dashboard">Abrir o dashboard</a>
        </p>
      )}
    </section>
  );
}
