import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { createRestReadRetryFetch, retryDelayFor } from "@/lib/supabase/rest-read-retry";

/**
 * Mission 204 — primeiro carregamento autenticado do /dashboard.
 *
 * Capturado localmente: um HTTP 401 do `/rest/v1` numa das leituras
 * concorrentes do primeiro render após o login, com um token que as
 * demais leituras usam com sucesso. A leitura é repetida UMA vez; o 401
 * que persiste continua sendo erro; escrita nunca é repetida; toda
 * ocorrência é registrada com o motivo do PostgREST, sem query/ids.
 */

const REST = "http://127.0.0.1:54321/rest/v1/companies?select=id&company_id=eq.11111111-2222-4333-8444-555555555555";

function scripted(statuses: number[]) {
  const calls: string[] = [];
  const baseFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${String(input)}`);
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)];
    return new Response(null, {
      status,
      headers: status === 401 ? { "www-authenticate": 'Bearer error="invalid_token", error_description="JWT sintético"' } : {},
    });
  }) as typeof fetch;
  return { baseFetch, calls };
}

describe("Mission 204 — 401 transitório em leitura do PostgREST", () => {
  test("HEAD que recebe 401 e depois 200: devolve 200 e registra o motivo, sem query nem id", async () => {
    const { baseFetch, calls } = scripted([401, 200]);
    const logs: string[] = [];
    const response = await createRestReadRetryFetch(baseFetch, (m) => logs.push(m), () => 0)(REST, { method: "HEAD" });
    assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
    assert.equal(logs.length, 1);
    assert.match(logs[0], /HEAD \/rest\/v1\/companies\); motivo: Bearer error="invalid_token".*HTTP 200/);
    assert.doesNotMatch(logs[0], /11111111|company_id|select=/);
  });

  test("401 persistente (sessão realmente inválida) continua sendo erro — uma única repetição", async () => {
    const { baseFetch, calls } = scripted([401, 401]);
    const logs: string[] = [];
    const response = await createRestReadRetryFetch(baseFetch, (m) => logs.push(m), () => 0)(REST, { method: "GET" });
    assert.equal(response.status, 401);
    assert.equal(calls.length, 2);
    assert.match(logs[0], /HTTP 401/);
  });

  test("escrita nunca é repetida; outros status e outras rotas não mudam", async () => {
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const { baseFetch, calls } = scripted([401]);
      const response = await createRestReadRetryFetch(baseFetch, () => {}, () => 0)(REST, { method });
      assert.equal(response.status, 401);
      assert.equal(calls.length, 1, `${method} não pode ser repetido`);
    }
    const auth = scripted([401]);
    await createRestReadRetryFetch(auth.baseFetch, () => {}, () => 0)("http://127.0.0.1:54321/auth/v1/user");
    assert.equal(auth.calls.length, 1, "Auth não entra na regra");

    const forbidden = scripted([403]);
    await createRestReadRetryFetch(forbidden.baseFetch, () => {}, () => 0)(REST);
    assert.equal(forbidden.calls.length, 1, "só 401 é repetido");
  });

  test("\"JWT issued at future\" (relógio interno do PostgREST atrasado) espera mais antes da repetição única", () => {
    assert.equal(retryDelayFor('Bearer error="invalid_token", error_description="JWT issued at future"'), 1100);
    assert.equal(retryDelayFor('Bearer error="invalid_token", error_description="JWT expired"'), 250);
    assert.equal(retryDelayFor("sem motivo informado"), 250);
  });

  test("o client do servidor usa o fetch com repetição; o do navegador não muda", () => {
    const server = readFileSync(join(process.cwd(), "lib/supabase/server.ts"), "utf8");
    assert.match(server, /global: \{ fetch: restReadRetryFetch \}/);
  });
});
