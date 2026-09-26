import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { internalErrorResponse } from "@/app/api/efos/_shared/internalError";
import { GET as analyzeGET, POST as analyzePOST } from "@/app/api/efos/analyze/[companyId]/executive/route";
import { GET as historyGET } from "@/app/api/efos/history/[companyId]/route";

/**
 * Mission 200 Closure — Public Internal Error Boundary (D-129).
 *
 * Antes: os `catch` das rotas `app/api/efos/**` devolviam
 * `error.message` num HTTP 500 — texto de Postgres/Supabase/provider ia
 * direto ao cliente — e na rota de análise `getCompanyById()`/
 * `beginProcessingAttempt()` nem estavam dentro de um `try`.
 *
 * Falha interna artificial e real: fora de uma requisição do Next,
 * abrir o cliente Supabase (`cookies()`) lança um erro cuja mensagem
 * cita "cookies"/"request scope" — exatamente o tipo de detalhe interno
 * que nunca pode chegar ao corpo da resposta.
 */

const VALID = "11111111-2222-4333-8444-555555555555";
const params = (companyId: string) => ({ params: Promise.resolve({ companyId }) });
const LEAK_MARKERS = [/cookies/i, /request scope/i, /\bat\s+\S+\s*\(/, /\.(ts|js):\d+/, /stack/i, /22P02/, /PGRST/, /postgres/i, /supabase/i];

async function withSilencedConsole<T>(fn: (logged: string[]) => Promise<T>): Promise<T> {
  const original = console.error;
  const logged: string[] = [];
  console.error = (...args: unknown[]) => { logged.push(args.map(String).join(" ")); };
  try {
    return await fn(logged);
  } finally {
    console.error = original;
  }
}

function assertGeneric(bodyText: string, expectedMessage: string) {
  assert.deepEqual(JSON.parse(bodyText), { success: false, error: { code: "unexpected", message: expectedMessage } });
  for (const marker of LEAK_MARKERS) assert.doesNotMatch(bodyText, marker, `corpo vazou ${marker}`);
}

describe("Mission 200 Closure — falha interna real nos handlers vira 500 genérico (D-129)", () => {
  for (const [name, call, expected] of [
    ["GET  /api/efos/analyze/[companyId]/executive", () => analyzeGET(new Request("http://t/x"), params(VALID)), "Erro inesperado ao verificar o acesso à empresa."],
    ["POST /api/efos/analyze/[companyId]/executive", () => analyzePOST(new Request("http://t/x", { method: "POST" }), params(VALID)), "Erro inesperado ao verificar o acesso à empresa."],
    ["GET  /api/efos/history/[companyId]", () => historyGET(new Request("http://t/x"), params(VALID)), "Erro inesperado ao carregar o histórico."],
  ] as const) {
    test(`${name}: 500, corpo estável, sem mensagem interna nem stack — e o detalhe fica no log do servidor`, async () => {
      await withSilencedConsole(async (logged) => {
        const response = await call();
        assert.equal(response.status, 500);
        assertGeneric(await response.text(), expected);
        assert.equal(logged.length, 1, "exatamente um registro server-side por falha");
        assert.match(logged[0], /falha interna inesperada \(D-129\)/);
      });
    });
  }

  test("400 invalid_identifier continua intacto (erro de input nunca vira 500)", async () => {
    for (const call of [
      () => analyzeGET(new Request("http://t/x"), params("not-a-uuid")),
      () => analyzePOST(new Request("http://t/x", { method: "POST" }), params("not-a-uuid")),
      () => historyGET(new Request("http://t/x"), params("not-a-uuid")),
    ]) {
      const response = await call();
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, "invalid_identifier");
    }
  });
});

describe("Mission 200 Closure — o helper nunca expõe erro de Postgres/provider nem stack", () => {
  test("erro no formato do PostgREST (código + mensagem + detalhes) não aparece no corpo", async () => {
    await withSilencedConsole(async (logged) => {
      const postgrestError = {
        name: "PostgrestError",
        code: "22P02",
        message: 'invalid input syntax for type uuid: "segredo-interno"',
        details: "Key (cnpj)=(11222333000181) already exists.",
        hint: null,
      };
      const response = internalErrorResponse("test.op", "Erro inesperado de teste.", postgrestError);
      const text = await response.text();
      assert.equal(response.status, 500);
      assertGeneric(text, "Erro inesperado de teste.");
      assert.doesNotMatch(text, /segredo-interno|11222333000181|Key \(/);
      assert.match(logged[0], /"code":"22P02"/, "o código fica disponível para diagnóstico no servidor");
      assert.doesNotMatch(logged[0], /11222333000181/, "`details` (pode conter dado de linha) nunca é registrado");
    });
  });

  test("Error com stack: nem mensagem nem stack no corpo; o log registra só nome/código/mensagem truncada, sem stack", async () => {
    await withSilencedConsole(async (logged) => {
      const error = new Error("falha no provider X com chave de configuração Y");
      const text = await internalErrorResponse("test.op", "Erro inesperado de teste.", error).text();
      assertGeneric(text, "Erro inesperado de teste.");
      assert.doesNotMatch(text, /provider X|configuração Y/);
      assert.doesNotMatch(logged[0], /\n\s+at\s/, "stack nunca é registrado");
    });
  });

  test("valores que não são Error (string, null) também produzem o corpo genérico", async () => {
    await withSilencedConsole(async () => {
      for (const thrown of ["texto interno cru", null, 42]) {
        assertGeneric(await internalErrorResponse("test.op", "Erro inesperado de teste.", thrown).text(), "Erro inesperado de teste.");
      }
    });
  });
});

describe("Mission 200 Closure — toda Route Handler de API segue o mesmo padrão", () => {
  function routeFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return routeFiles(full);
      return entry === "route.ts" ? [full] : [];
    });
  }

  test("nenhuma rota devolve error.message/String(error)/stack; toda rota com catch usa internalErrorResponse()", () => {
    const files = routeFiles(join(__dirname, "..", "..", "app"));
    assert.ok(files.length >= 3);
    for (const file of files) {
      const source = readFileSync(file, "utf-8");
      assert.doesNotMatch(source, /error\.message|String\(error\)|\.stack\b|error instanceof Error/, file);
      if (/status:\s*500/.test(source)) assert.fail(`${file}: 500 montado à mão — use internalErrorResponse()`);
      if (/catch\s*\(error\)/.test(source)) assert.match(source, /internalErrorResponse\(/, file);
    }
  });
});
