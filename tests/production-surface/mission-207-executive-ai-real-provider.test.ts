import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { executeExecutiveAnalysis, type ExecutiveAIProvider, type ExecutiveAIResponse } from "@/efos/application/executive-ai";
import { buildExecutiveAIInstruction, EXECUTIVE_AI_CONSTRAINTS } from "@/efos/application/executive-ai-instruction";
import { buildExecutiveChatInstruction } from "@/efos/application/executive-chat";
import { DIAGNOSIS_BOUNDARIES } from "@/efos/application/executive-diagnosis";
import { assessExecutiveFigureFidelity } from "@/efos/application/executive-output-policy";
import { describeCitableBasisReferences } from "@/efos/infrastructure/executive-ai/basisTransport";
import { buildExecutiveAIStageSystemPrompt } from "@/efos/infrastructure/executive-ai/buildExecutiveAISystemPrompt";
import { buildExecutiveChatSystemPrompt } from "@/efos/infrastructure/executive-chat/buildExecutiveChatSystemPrompt";

import { MARGIN_DETERIORATING, MISSING_INDICATOR, NET_MARGIN } from "./fixtures/executive-ai-contexts";

/**
 * Mission 207 — achados da validação real controlada com a Anthropic
 * (contexto sintético, nada persistido), fixados como regressão sem rede:
 *
 * 1. o modelo usava o prefixo "context:" para qualquer coisa dentro do
 *    bloco JSON `context` (ids de indicador/evidência, historicalIntelligence,
 *    unknowns, nomes) — 9 de 12 respostas reais caíam na validação de
 *    referências. Correção só de instrução: a lista exata das referências
 *    citáveis de cada chamada; o contrato de aceitação não muda;
 * 2. texto real "… Endividamento Geral para o período de agosto de 2026"
 *    era rejeitado como número atribuído a indicador indisponível (o ano);
 * 3. texto real expunha termos internos ("knowledgeContext", "Financial
 *    Truth", id de evidência) — a política de tom passa a proibir.
 */

describe("Mission 207 — referências citáveis explícitas", () => {
  test("lista cada indicador e evidência com o nome; prefixos sem entidades aparecem como 'nenhum'", () => {
    const text = describeCitableBasisReferences(MARGIN_DETERIORATING);
    assert.match(text, /"indicator:ind-margem-liquida" \(Margem Líquida\)/);
    assert.match(text, /"evidence:evd-declinio-margem-liquida" \(Declínio sustentado de Margem Líquida\)/);
    assert.match(text, /- context: none in this call — never use this prefix/);
    assert.match(text, /- conflict: none in this call/);
    assert.match(text, /- knowledge: none in this call/);
    assert.match(text, /refers ONLY to entries of context\.deterministicIntelligence\.contexts/);
    assert.match(text, /historicalIntelligence comparisons, unknowns, financialEpisodes.* have no reference of their own/);
  });

  test("os três prompts reais (Diagnosis core/interpretation e Chat) levam a mesma lista", () => {
    const expected = describeCitableBasisReferences(MARGIN_DETERIORATING);
    const diagnosis = buildExecutiveAIInstruction(MARGIN_DETERIORATING, "instr");
    for (const prompt of [
      buildExecutiveAIStageSystemPrompt(diagnosis, "core"),
      buildExecutiveAIStageSystemPrompt(diagnosis, "interpretation"),
      buildExecutiveChatSystemPrompt(buildExecutiveChatInstruction(MARGIN_DETERIORATING, "instr", { text: "Como está minha empresa?" })),
    ]) {
      assert.ok(prompt.includes(expected));
    }
  });

  test("o contrato de aceitação não afrouxou: 'context:' com id de indicador continua rejeitado", async () => {
    const diagnosis = {
      id: "d",
      basedOn: { generatedAt: "2026-09-01T00:00:00.000Z" },
      executiveSummary: { statement: "A Margem Líquida está em -4,26% neste período.", basis: { indicatorIds: [NET_MARGIN] } },
      interpretations: [],
      hypotheses: [
        {
          id: "h",
          statement: "A queda pode estar ligada ao aumento de custos.",
          basis: { contextIds: [NET_MARGIN] },
          confidence: "low",
          validationNeeded: "Confirmar com a DRE detalhada.",
        },
      ],
      risks: [],
      priorities: [],
      possibleActions: [],
      questions: [],
      uncertainties: [],
      conflictInterpretations: [],
      boundaries: DIAGNOSIS_BOUNDARIES,
    };
    const provider: ExecutiveAIProvider = {
      providerName: "stub",
      analyze: async (): Promise<ExecutiveAIResponse> => ({ providerName: "stub", model: "m", output: diagnosis, receivedAt: "t" }),
    };
    const result = await executeExecutiveAnalysis(provider, MARGIN_DETERIORATING, "instr");
    assert.equal(result.success, false);
    if (!result.success) assert.match(result.error.message, /contextId "ind-margem-liquida" que não pertence/);
  });
});

describe("Mission 207 — falso positivo real corrigido sem afrouxar a regra", () => {
  test("ano e data junto ao nome de indicador indisponível não são valor do indicador", () => {
    for (const ok of [
      "Avaliar a recuperação ou apuração do indicador Endividamento Geral para o período de agosto de 2026.",
      "O Endividamento Geral não pôde ser apurado em 31/08/2026.",
    ]) {
      assert.equal(assessExecutiveFigureFidelity([{ path: "p", text: ok }], MISSING_INDICATOR).valid, true, ok);
    }
    for (const bad of ["O Endividamento Geral está em 76,25%.", "Endividamento Geral de 0 neste período."]) {
      assert.equal(assessExecutiveFigureFidelity([{ path: "p", text: bad }], MISSING_INDICATOR).valid, false, bad);
    }
  });
});

describe("Mission 207 — termos internos fora do texto", () => {
  test("a política de tom proíbe ids, referências, chaves JSON e jargão interno no texto", () => {
    const tone = EXECUTIVE_AI_CONSTRAINTS.find((constraint) => constraint.code === "USE_EXECUTIVE_BRAZILIAN_TONE")?.description ?? "";
    assert.match(tone, /Never write internal identifiers, basis reference strings, JSON key names or internal system terms/);
    assert.match(tone, /knowledgeContext.*Financial Truth/);
  });
});
