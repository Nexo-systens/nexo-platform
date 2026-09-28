import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/confirm",
];

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Renova a sessão do Supabase a cada requisição e aplica a proteção de
 * rotas. Chamado pelo proxy.ts da raiz (substituto do antigo middleware.ts
 * a partir do Next.js 16).
 *
 * Mission 204 — toda resposta que sai daqui, inclusive os redirects,
 * carrega os cookies que o `getUser()` acabou de gravar (sessão renovada
 * ou removida) e os cabeçalhos anti-cache que o `@supabase/ssr` exige
 * para respostas com cookie de sessão. Antes, os redirects eram respostas
 * novas e descartavam esses cookies: um usuário autenticado com o access
 * token vencido que abrisse `/login` tinha a sessão renovada (refresh
 * token rotacionado) e voltava ao navegador ainda com o par antigo; uma
 * sessão inválida nunca era apagada do navegador nos redirects para
 * `/login`.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let sessionHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
          sessionHeaders = headers ?? {};
          Object.entries(sessionHeaders).forEach(([key, value]) =>
            response.headers.set(key, value)
          );
        },
      },
    }
  );

  // getUser() revalida o token contra o servidor do Supabase Auth.
  // Nunca usar getSession() aqui: ela só lê o cookie local, sem validação.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    Object.entries(sessionHeaders).forEach(([key, value]) =>
      redirect.headers.set(key, value)
    );
    return redirect;
  };

  const { pathname } = request.nextUrl;
  const publicRoute = isPublicRoute(pathname);

  if (!user && pathname === "/") {
    return redirectTo("/login");
  }

  if (!user && !publicRoute) {
    return redirectTo("/login");
  }

  // /reset-password é alcançada por um usuário já autenticado (sessão
  // temporária de recovery criada pelo /auth/confirm) — nunca redirecionar
  // esse caso para o dashboard.
  const isRecoveryException =
    pathname === "/auth/confirm" || pathname.startsWith("/reset-password");

  if (user && publicRoute && !isRecoveryException) {
    return redirectTo("/dashboard");
  }

  return response;
}
