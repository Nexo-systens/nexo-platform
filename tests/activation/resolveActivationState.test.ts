import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  hasReachedFirstAnalysis,
  resolveActivationState,
} from "@/modules/activation/resolveActivationState";

/**
 * Mission 195 — Founding Company Production Onboarding & First
 * Executive Value. `resolveActivationState()` é PURA — nenhuma
 * chamada de rede, nenhum Supabase real — apenas a árvore de
 * precedência sobre contagens já canônicas. Cobre a matriz completa
 * dos 5 estados e a invariante central da Seção 39 ("existing customer
 * safety"): uma vez que `executionsCount > 0`, o estado NUNCA regride
 * para um estado de onboarding, mesmo que os documentos atuais estejam
 * zerados/não-analisáveis.
 */

describe("resolveActivationState() — matriz completa dos 5 estados", () => {
  test("nenhum documento → no_documents", () => {
    const result = resolveActivationState({
      documentsCount: 0,
      analyzableDocumentsCount: 0,
      executionsCount: 0,
      diagnosesCount: 0,
    });
    assert.equal(result.state, "no_documents");
  });

  test("documentos existem, nenhum analisável → documents_not_analyzable", () => {
    const result = resolveActivationState({
      documentsCount: 2,
      analyzableDocumentsCount: 0,
      executionsCount: 0,
      diagnosesCount: 0,
    });
    assert.equal(result.state, "documents_not_analyzable");
  });

  test("ao menos um documento analisável, nenhuma execução → ready_for_analysis", () => {
    const result = resolveActivationState({
      documentsCount: 1,
      analyzableDocumentsCount: 1,
      executionsCount: 0,
      diagnosesCount: 0,
    });
    assert.equal(result.state, "ready_for_analysis");
  });

  test("ao menos uma execução, nenhum diagnóstico → analysis_available", () => {
    const result = resolveActivationState({
      documentsCount: 1,
      analyzableDocumentsCount: 1,
      executionsCount: 1,
      diagnosesCount: 0,
    });
    assert.equal(result.state, "analysis_available");
  });

  test("ao menos um diagnóstico → diagnosis_available", () => {
    const result = resolveActivationState({
      documentsCount: 1,
      analyzableDocumentsCount: 1,
      executionsCount: 1,
      diagnosesCount: 1,
    });
    assert.equal(result.state, "diagnosis_available");
  });
});

describe("Seção 39 — Existing Customer Safety: uma empresa madura nunca regride ao onboarding", () => {
  test("execução existe mesmo com documentos atuais zerados (ex.: todos removidos depois) → ainda analysis_available", () => {
    const result = resolveActivationState({
      documentsCount: 0,
      analyzableDocumentsCount: 0,
      executionsCount: 3,
      diagnosesCount: 0,
    });
    assert.equal(
      result.state,
      "analysis_available",
      "uma execução histórica real nunca deve ser escondida só porque os documentos atuais mudaram"
    );
  });

  test("execução existe mesmo com todos os documentos atuais não-analisáveis → ainda analysis_available, nunca documents_not_analyzable", () => {
    const result = resolveActivationState({
      documentsCount: 5,
      analyzableDocumentsCount: 0,
      executionsCount: 2,
      diagnosesCount: 0,
    });
    assert.equal(result.state, "analysis_available");
  });

  test("diagnóstico existe mesmo sem nenhum documento atual → ainda diagnosis_available", () => {
    const result = resolveActivationState({
      documentsCount: 0,
      analyzableDocumentsCount: 0,
      executionsCount: 0,
      diagnosesCount: 1,
    });
    assert.equal(
      result.state,
      "diagnosis_available",
      "diagnóstico persistido é um fato histórico — nunca revertido por ausência de documento atual"
    );
  });
});

describe("hasReachedFirstAnalysis() — gate de capacidades secundárias (Seção 28)", () => {
  test("estados de onboarding (no_documents/documents_not_analyzable/ready_for_analysis) nunca destravam capacidades secundárias", () => {
    assert.equal(hasReachedFirstAnalysis("no_documents"), false);
    assert.equal(hasReachedFirstAnalysis("documents_not_analyzable"), false);
    assert.equal(hasReachedFirstAnalysis("ready_for_analysis"), false);
  });

  test("analysis_available e diagnosis_available sempre destravam capacidades secundárias", () => {
    assert.equal(hasReachedFirstAnalysis("analysis_available"), true);
    assert.equal(hasReachedFirstAnalysis("diagnosis_available"), true);
  });
});

describe("Seção 37 — nenhuma porcentagem de conclusão fabricada", () => {
  test("description nunca contém um símbolo de porcentagem (nenhum onboarding=NN% inventado)", () => {
    const allStates = [
      { documentsCount: 0, analyzableDocumentsCount: 0, executionsCount: 0, diagnosesCount: 0 },
      { documentsCount: 1, analyzableDocumentsCount: 0, executionsCount: 0, diagnosesCount: 0 },
      { documentsCount: 1, analyzableDocumentsCount: 1, executionsCount: 0, diagnosesCount: 0 },
      { documentsCount: 1, analyzableDocumentsCount: 1, executionsCount: 1, diagnosesCount: 0 },
      { documentsCount: 1, analyzableDocumentsCount: 1, executionsCount: 1, diagnosesCount: 1 },
    ];
    for (const inputs of allStates) {
      const result = resolveActivationState(inputs);
      assert.doesNotMatch(result.description, /%/, JSON.stringify(inputs));
    }
  });

  test("description nunca reivindica suporte a formato diferente de PDF/CSV", () => {
    const result = resolveActivationState({
      documentsCount: 0,
      analyzableDocumentsCount: 0,
      executionsCount: 0,
      diagnosesCount: 0,
    });
    assert.doesNotMatch(result.description, /xlsx|docx?|xls\b|png|jpe?g/i);
  });
});
