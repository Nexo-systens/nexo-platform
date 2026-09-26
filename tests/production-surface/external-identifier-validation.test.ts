import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { deriveKnowledgeId } from "@/efos/application/knowledge-formation/deriveKnowledgeId";
import { allUuids, isUuid } from "@/lib/identifiers";
import {
  getCompanyById,
  setCompanyStatus,
  softDeleteCompany,
  updateCompany,
} from "@/modules/companies/services/company.service";
import { getDocumentsByIds, softDeleteDocument } from "@/modules/documents/services/document.service";
import { verifyDecisionBelongsToCompany } from "@/modules/decisions/services/decision-execution-persistence.service";
import { verifyReviewBelongsToCompany } from "@/modules/decisions/services/decision-persistence.service";
import { verifyDiagnosisBelongsToCompany } from "@/modules/decisions/services/diagnosis-review-persistence.service";
import { GET as analyzeGET, POST as analyzePOST } from "@/app/api/efos/analyze/[companyId]/executive/route";
import { GET as historyGET } from "@/app/api/efos/history/[companyId]/route";

/**
 * Mission 200 — Canonical External Identifier Validation (D-128).
 *
 * Antes: `GET /api/efos/analyze/not-a-uuid/executive` respondia HTTP 500
 * sem corpo — o Postgres rejeita um valor não-UUID numa coluna `uuid`
 * (22P02), o service lançava, e `getCompanyById()` rodava fora do `try`.
 * O mesmo acontecia em toda função que filtra por um id vindo do
 * cliente.
 *
 * Como estas provas sabem que nada foi consultado: fora de uma
 * requisição do Next, abrir o cliente Supabase (`cookies()`) lança. Uma
 * função que devolve seu resultado de "não encontrado" SEM lançar não
 * tocou o banco — e o teste de controle abaixo prova que um UUID válido
 * de fato tentaria consultar.
 */

const VALID = "11111111-2222-4333-8444-555555555555";
const MALFORMED = [
  "not-a-uuid",
  "",
  " 11111111-2222-4333-8444-555555555555",
  "11111111-2222-4333-8444-55555555555",
  "{11111111-2222-4333-8444-555555555555}",
  "11111111222243338444555555555555",
  "' or 1=1 --",
  "11111111-2222-4333-8444-55555555555g",
];

const params = (companyId: string) => ({ params: Promise.resolve({ companyId }) });

describe("Mission 200 — forma canônica de identificador externo", () => {
  test("aceita UUIDs de qualquer versão, inclusive os determinísticos da NEXO", () => {
    assert.equal(isUuid(VALID), true);
    assert.equal(isUuid(VALID.toUpperCase()), true);
    assert.equal(isUuid(crypto.randomUUID()), true);
    const knowledgeId = deriveKnowledgeId(VALID, "category", [VALID]);
    assert.equal(isUuid(knowledgeId), true, "deriveKnowledgeId() não carrega versão RFC e continua válido");
  });

  test("rejeita qualquer valor que o Postgres recusaria (ou não é string)", () => {
    for (const value of MALFORMED) assert.equal(isUuid(value), false, JSON.stringify(value));
    for (const value of [null, undefined, 42, {}, [VALID]]) assert.equal(isUuid(value), false, String(value));
    assert.equal(allUuids(VALID, VALID), true);
    assert.equal(allUuids(VALID, "x"), false);
  });
});

describe("Mission 200 — rotas HTTP: malformado → 400, antes de qualquer I/O", () => {
  for (const [name, call] of [
    ["GET  /api/efos/analyze/[companyId]/executive", (id: string) => analyzeGET(new Request("http://t/x"), params(id))],
    ["POST /api/efos/analyze/[companyId]/executive", (id: string) => analyzePOST(new Request("http://t/x", { method: "POST" }), params(id))],
    ["GET  /api/efos/history/[companyId]", (id: string) => historyGET(new Request("http://t/x"), params(id))],
  ] as const) {
    test(`${name}: 400 invalid_identifier, sem stack trace, nunca 500`, async () => {
      for (const malformed of ["not-a-uuid", "' or 1=1 --", ""]) {
        const response = await call(malformed);
        assert.equal(response.status, 400, JSON.stringify(malformed));
        const body = await response.json();
        assert.deepEqual(body, { success: false, error: { code: "invalid_identifier", message: "Identificador inválido." } });
      }
    });
  }

  test("history: previousExecutionId malformado também é 400, mesmo com companyId válido", async () => {
    const response = await historyGET(new Request(`http://t/x?previousExecutionId=nope`), params(VALID));
    assert.equal(response.status, 400);
  });

  test("controle: com um UUID válido a rota passa da validação e tenta consultar (lança fora de uma requisição)", async () => {
    await assert.rejects(analyzeGET(new Request("http://t/x"), params(VALID)));
  });
});

describe("Mission 200 — services: malformado = o mesmo 'não encontrado', sem consultar o banco", () => {
  test("getCompanyById() devolve null (o mesmo de inexistente/não autorizado)", async () => {
    for (const malformed of MALFORMED) assert.equal(await getCompanyById(malformed), null);
  });

  test("controle: getCompanyById() com UUID válido tenta consultar", async () => {
    await assert.rejects(getCompanyById(VALID));
  });

  test("mutações de empresa por id: no-op (como um id inexistente) ou a mesma falha de 'não encontrada'", async () => {
    await setCompanyStatus("not-a-uuid", "archived");
    await softDeleteCompany("not-a-uuid");
    await assert.rejects(
      updateCompany("not-a-uuid", {
        razaoSocial: "x", nomeFantasia: null, cnpj: "x", regimeTributario: null, cnae: null,
        segmento: null, porte: null, dataAbertura: null, observacoes: null,
      }),
      /Empresa não encontrada/
    );
  });

  test("documentos: exclusão é no-op; busca por ids descarta malformados (e não-arrays) e devolve []", async () => {
    await softDeleteDocument("not-a-uuid");
    assert.deepEqual(await getDocumentsByIds(["not-a-uuid", "' or 1=1 --"]), []);
    assert.deepEqual(await getDocumentsByIds("not-a-uuid" as unknown as string[]), []);
  });

  test("pertencimento de decisão/diagnóstico/revisão: malformado recebe exatamente o erro de 'não pertence a esta empresa'", async () => {
    const decision = await verifyDecisionBelongsToCompany("not-a-uuid", VALID);
    assert.deepEqual(decision, { code: "DECISION_NOT_FOUND_IN_COMPANY", message: "A decisão informada não existe ou não pertence a esta empresa." });
    assert.deepEqual(await verifyDecisionBelongsToCompany(VALID, "not-a-uuid"), decision);

    assert.deepEqual(await verifyDiagnosisBelongsToCompany("not-a-uuid", VALID), {
      code: "DIAGNOSIS_NOT_FOUND_IN_COMPANY",
      message: "O diagnóstico informado não existe ou não pertence a esta empresa.",
    });
    assert.deepEqual(await verifyReviewBelongsToCompany("not-a-uuid", VALID), {
      code: "REVIEW_NOT_FOUND_IN_COMPANY",
      message: "A revisão informada não existe ou não pertence a esta empresa.",
    });
  });
});
