/**
 * Mission 204 — 401 transitório em LEITURA do PostgREST.
 *
 * O `Error: {"message":""}` do primeiro `/dashboard` após o login (visto
 * duas vezes no NEXO Pilot) foi capturado localmente: é um HTTP 401 do
 * `/rest/v1` numa das leituras concorrentes do primeiro render, com um
 * token que as demais leituras do MESMO render usam com sucesso
 * milissegundos depois. A causa exata do 401 não foi provada.
 *
 * Tratamento limitado e observável (mesmo princípio da repetição que o
 * postgrest-js já faz para 503/520 em GET/HEAD):
 * - só GET/HEAD em `/rest/v1` — nunca escrita;
 * - uma única repetição; se o 401 persistir (sessão realmente inválida),
 *   ele é devolvido e o erro aparece como antes;
 * - toda ocorrência vai para o log do servidor com o motivo informado
 *   pelo PostgREST (`WWW-Authenticate`), sem query string, ids ou token —
 *   a próxima ocorrência prova a causa.
 */

const RETRY_DELAY_MS = 250;
/**
 * "JWT issued at future": comprovado localmente (Mission 204) — o token
 * recusado tinha iat 1,3 s NO PASSADO pelo relógio do servidor (relógios
 * do host e dos contêineres sincronizados); é o relógio interno do
 * PostgREST que está atrasado, e uma repetição 250 ms depois ainda
 * falhou. A repetição única espera o relógio dele alcançar o do emissor.
 */
const ISSUED_AT_FUTURE_DELAY_MS = 1100;

export function retryDelayFor(reason: string): number {
  return /issued at future/i.test(reason) ? ISSUED_AT_FUTURE_DELAY_MS : RETRY_DELAY_MS;
}

function describe(input: RequestInfo | URL): { url: string; method?: string } {
  if (typeof input === "string") return { url: input };
  if (input instanceof URL) return { url: input.href };
  return { url: input.url, method: input.method };
}

/**
 * Só tempos relativos (iat/exp do token × relógio deste servidor), nunca o
 * token, o sujeito ou qualquer claim de identidade — o bastante para
 * distinguir "token emitido no futuro" de "token vencido".
 */
function describeTokenClock(headers: HeadersInit | undefined): string {
  try {
    const bearer = new Headers(headers).get("authorization")?.replace(/^Bearer\s+/i, "");
    const payload = bearer?.split(".")[1];
    if (!payload) return "token: ausente";
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { iat?: number; exp?: number };
    const now = Date.now() / 1000;
    const iat = typeof claims.iat === "number" ? `iat ${(claims.iat - now).toFixed(1)}s` : "iat ?";
    const exp = typeof claims.exp === "number" ? `exp ${(claims.exp - now).toFixed(0)}s` : "exp ?";
    return `token relativo ao relógio do servidor: ${iat}, ${exp}`;
  } catch {
    return "token: ilegível";
  }
}

export function createRestReadRetryFetch(
  // Resolvido a cada chamada: o Next instala o próprio `fetch` global.
  baseFetch: typeof fetch = (input, init) => fetch(input, init),
  log: (message: string) => void = (message) => console.warn(message),
  delayFor: (reason: string) => number = retryDelayFor
): typeof fetch {
  return async (input, init) => {
    const response = await baseFetch(input, init);
    if (response.status !== 401) return response;

    const { url, method: requestMethod } = describe(input);
    const method = (init?.method ?? requestMethod ?? "GET").toUpperCase();
    const pathname = new URL(url).pathname;
    if (!pathname.startsWith("/rest/v1/") || (method !== "GET" && method !== "HEAD")) {
      return response;
    }

    const reason = response.headers.get("www-authenticate") ?? "sem motivo informado";
    const tokenClock = describeTokenClock(init?.headers ?? (typeof input === "object" && "headers" in input ? input.headers : undefined));
    await new Promise((resolve) => setTimeout(resolve, delayFor(reason)));
    const retried = await baseFetch(input, init);
    log(
      `[supabase] 401 em leitura do PostgREST (${method} ${pathname}); motivo: ${reason}; ` +
        `${tokenClock}; repetição única → HTTP ${retried.status}.`
    );
    return retried;
  };
}
