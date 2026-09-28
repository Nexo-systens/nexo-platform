import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * Mission 204 — cookies de sessão nos redirects do proxy.
 *
 * O `getUser()` do proxy pode RENOVAR a sessão (access token vencido →
 * refresh token rotacionado) ou REMOVÊ-LA (refresh token inválido). Em
 * ambos os casos o `@supabase/ssr` grava cookies via `setAll`. Os
 * redirects eram respostas novas e descartavam esses cookies: o navegador
 * continuava com o par antigo (já rotacionado) ou com uma sessão morta.
 *
 * Aqui o Supabase Auth é simulado por um `fetch` falso — nenhuma rede,
 * nenhum projeto real. Os tokens são JWTs sintéticos sem assinatura
 * válida (o proxy só os repassa ao Auth, que é o `fetch` falso).
 */

const SUPABASE_URL = "http://127.0.0.1:54321";
const COOKIE = "sb-127-auth-token";
const now = () => Math.floor(Date.now() / 1000);

function b64url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function jwt(payload: Record<string, unknown>) {
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.assinatura-sintetica`;
}

const user = {
  id: "11111111-2222-4333-8444-555555555555",
  aud: "authenticated",
  role: "authenticated",
  email: "executiva@example.test",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-09-01T00:00:00.000Z",
};

function session(accessExp: number, refreshToken: string) {
  return {
    access_token: jwt({ sub: user.id, role: "authenticated", aud: "authenticated", iat: accessExp - 3600, exp: accessExp, session_id: "s" }),
    refresh_token: refreshToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: accessExp,
    user,
  };
}

function sessionCookie(value: unknown) {
  return `base64-${b64url(value)}`;
}

function decodeSessionCookie(value: string) {
  return JSON.parse(Buffer.from(value.replace(/^base64-/, ""), "base64url").toString("utf8"));
}

function request(pathname: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", `${COOKIE}=${cookie}`);
  return new NextRequest(new URL(pathname, "http://localhost:3000"), { headers });
}

type AuthBehavior = "refresh-ok" | "refresh-invalid" | "valid";

const originalFetch = globalThis.fetch;
let authCalls: string[] = [];

function mockAuth(behavior: AuthBehavior) {
  authCalls = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    authCalls.push(new URL(url).pathname + new URL(url).search);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (url.includes("/auth/v1/token") && url.includes("grant_type=refresh_token")) {
      return behavior === "refresh-ok"
        ? json(200, session(now() + 3600, "refresh-token-novo"))
        : json(400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found" });
    }
    if (url.includes("/auth/v1/user")) return json(200, user);
    return json(404, {});
  }) as typeof fetch;
}

describe("Mission 204 — o proxy preserva cookies de sessão em todo redirect", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-anon-sintetica";
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("autenticado com access token vencido abre /login: redirect para /dashboard leva a sessão RENOVADA", async () => {
    mockAuth("refresh-ok");
    const response = await updateSession(request("/login", sessionCookie(session(now() - 600, "refresh-token-antigo"))));

    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location")!).pathname, "/dashboard");
    assert.ok(authCalls.some((call) => call.includes("grant_type=refresh_token")), "a sessão foi renovada no proxy");

    const renewed = response.cookies.get(COOKIE);
    assert.ok(renewed, "o redirect carrega o cookie de sessão");
    assert.equal(decodeSessionCookie(renewed.value).refresh_token, "refresh-token-novo");
    assert.match(response.headers.get("cache-control") ?? "", /no-store/, "resposta com cookie de sessão não pode ir para cache");
  });

  test("sessão inválida em rota protegida: redirect para /login APAGA o cookie morto", async () => {
    mockAuth("refresh-invalid");
    // O auth-js registra a recusa do refresh token no console — esperado aqui.
    const originalError = console.error;
    console.error = () => {};
    let response: Awaited<ReturnType<typeof updateSession>>;
    try {
      response = await updateSession(request("/dashboard", sessionCookie(session(now() - 600, "refresh-token-revogado"))));
    } finally {
      console.error = originalError;
    }

    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location")!).pathname, "/login");
    const setCookie = response.headers.getSetCookie().find((line) => line.startsWith(`${COOKIE}=`));
    assert.ok(setCookie, "o redirect remove o cookie da sessão inválida");
    assert.match(setCookie, /Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });

  test("as decisões de rota não mudaram", async () => {
    mockAuth("valid");
    const anonymousProtected = await updateSession(request("/companies"));
    assert.equal(new URL(anonymousProtected.headers.get("location")!).pathname, "/login");
    assert.equal(anonymousProtected.headers.getSetCookie().length, 0, "sem sessão, nenhum cookie é inventado");

    const anonymousRoot = await updateSession(request("/"));
    assert.equal(new URL(anonymousRoot.headers.get("location")!).pathname, "/login");

    const anonymousPublic = await updateSession(request("/login"));
    assert.equal(anonymousPublic.headers.get("location"), null);

    const valid = sessionCookie(session(now() + 3600, "refresh-token-valido"));
    const authenticatedProtected = await updateSession(request("/dashboard", valid));
    assert.equal(authenticatedProtected.headers.get("location"), null);

    const authenticatedPublic = await updateSession(request("/signup", valid));
    assert.equal(new URL(authenticatedPublic.headers.get("location")!).pathname, "/dashboard");

    const recovery = await updateSession(request("/reset-password", valid));
    assert.equal(recovery.headers.get("location"), null, "recovery continua sem redirect");
  });
});
