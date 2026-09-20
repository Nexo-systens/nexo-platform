import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildConflictingDre,
  buildRealisticBalance,
  buildRealisticBankStatement,
  buildRealisticDre,
} from "../financial-ingestion/fixtures";
import { runIngestion, statusOf } from "../financial-ingestion/helpers";
import { resolveActivationState } from "@/modules/activation/resolveActivationState";
import { isAnalyzableDocumentName } from "@/modules/documents/utils/file";

/**
 * Mission 195 — Founding Company Production Onboarding & First
 * Executive Value, Seção 45/46/47/49/51. Prova, sobre o pipeline REAL
 * (Data → FinancialModel → Indicators — mesmo runner de
 * `tests/financial-ingestion/helpers.ts`, nunca uma segunda
 * implementação), que uma Founding Company real alcança valor
 * executivo genuíno SEM IA externa, e que `resolveActivationState()`
 * classifica corretamente cada cenário a partir de contagens que
 * espelham o que a produção reportaria (`analyzableDocumentsCount`
 * calculado pelo mesmo predicado de produção, `isAnalyzableDocumentName()`).
 *
 * O caso "Failed Document Fixture" (Seção 48 — um documento corrompido
 * nunca bloqueia a ativação do restante) já está integralmente provado
 * por `tests/financial-ingestion/document-governance/parser-resilience.test.ts`
 * (Mission 193 Closure, PDF corrompido real via `File`/`Buffer`) —
 * deliberadamente não duplicado aqui.
 */

function analyzableCount(names: readonly string[]): number {
  return names.filter((name) => isAnalyzableDocumentName(name)).length;
}

describe("Seção 45 — Founding Company: conjunto completo de documentos suportados alcança valor executivo real, sem IA", () => {
  test("DRE + Balanço compatível + Extrato: FinancialModel real, indicadores disponíveis, activation=ready_for_analysis antes da execução", async () => {
    const companyId = "activation-founding-company";
    const documents = [
      buildRealisticDre("dre-founding", companyId),
      buildRealisticBalance("bal-founding", companyId),
      buildRealisticBankStatement("bank-founding", companyId),
    ];

    const result = await runIngestion(companyId, documents);

    assert.equal(result.indicatorsStatus, "completed", "pipeline real deve produzir indicadores sem nenhuma IA");
    assert.equal(statusOf(result.indicators, "Margem Bruta"), "available");
    assert.equal(statusOf(result.indicators, "Liquidez Corrente"), "available");
    assert.equal(statusOf(result.indicators, "ROA"), "available", "DRE+Balanço compatíveis — cross-source disponível");

    // Nomes reais de documento — os três são .pdf, todos analisáveis.
    const documentNames = documents.map((d) => d.source);
    const activation = resolveActivationState({
      documentsCount: documentNames.length,
      analyzableDocumentsCount: analyzableCount(documentNames),
      executionsCount: 0, // ainda não persistido nesta simulação de pipeline
      diagnosesCount: 0,
    });
    assert.equal(activation.state, "ready_for_analysis");

    // Depois que uma execução real persistir (EFOSPlatform.analyzeCompany,
    // fora do escopo deste teste de pipeline puro), o mesmo resolver
    // avançaria corretamente para analysis_available — provado
    // separadamente pela matriz completa em resolveActivationState.test.ts.
    const afterAnalysis = resolveActivationState({
      documentsCount: documentNames.length,
      analyzableDocumentsCount: analyzableCount(documentNames),
      executionsCount: 1,
      diagnosesCount: 0,
    });
    assert.equal(afterAnalysis.state, "analysis_available");
  });
});

describe("Seção 46 — Partial Company: apenas DRE ainda produz valor executivo parcial, nunca 'empresa quebrada'", () => {
  test("DRE sozinho: indicadores de resultado disponíveis, indicadores de Balanço/cross-source indisponíveis (nunca fabricados)", async () => {
    const companyId = "activation-partial-company";
    const documents = [buildRealisticDre("dre-partial", companyId)];

    const result = await runIngestion(companyId, documents);

    assert.equal(statusOf(result.indicators, "Margem Bruta"), "available");
    assert.equal(statusOf(result.indicators, "Liquidez Corrente"), "unavailable");
    assert.equal(statusOf(result.indicators, "ROA"), "unavailable");

    const activation = resolveActivationState({
      documentsCount: 1,
      analyzableDocumentsCount: analyzableCount(documents.map((d) => d.source)),
      executionsCount: 0,
      diagnosesCount: 0,
    });
    assert.equal(
      activation.state,
      "ready_for_analysis",
      "verdade parcial ainda é suficiente para liberar a análise — nunca bloqueada por 'incompleta'"
    );
  });
});

describe("Seção 47 — Conflict Company: conflito de DRE nunca bloqueia a ativação; Balanço válido não relacionado permanece útil", () => {
  test("duas DREs conflitantes + Balanço válido: conflito visível, Balanço ainda contribui, ativação continua possível", async () => {
    const companyId = "activation-conflict-company";
    const documents = [
      buildRealisticDre("dre-conflict-a", companyId, { source: "dre_a.pdf" }),
      buildConflictingDre("dre-conflict-b", companyId, "dre_b.pdf"),
      buildRealisticBalance("bal-conflict-company", companyId),
    ];

    const result = await runIngestion(companyId, documents);

    assert.equal(result.conflicts.length, 1, "conflito de DRE deve ser registrado, nunca um vencedor arbitrário");
    assert.equal(statusOf(result.indicators, "Margem Bruta"), "unavailable");
    assert.equal(
      statusOf(result.indicators, "Liquidez Corrente"),
      "available",
      "Balanço válido, não relacionado ao conflito de DRE, continua útil (Seção 12 da Mission 194 Closure)"
    );

    // Todos os TRÊS documentos são .pdf — analisáveis por nome/formato,
    // mesmo que dois deles tenham sido excluídos por conflito de
    // CONTEÚDO (uma decisão de governança financeira, D-113 — nunca de
    // formato). A empresa permanece em estado de ativação genuíno, nunca
    // travada por um conflito que o próprio produto já explica.
    const activation = resolveActivationState({
      documentsCount: documents.length,
      analyzableDocumentsCount: analyzableCount(documents.map((d) => d.source)),
      executionsCount: 0,
      diagnosesCount: 0,
    });
    assert.equal(activation.state, "ready_for_analysis");
  });
});
