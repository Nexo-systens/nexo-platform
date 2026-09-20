/**
 * Constantes do Learning Engine — id/versao, mensagens de validacao, e
 * os tipos de Reasoning reconhecidos pela regra de padrao recorrente.
 * Nenhuma logica de consolidacao aqui (isso pertence a
 * learning.builder.ts).
 */

import type { ReasoningType } from "@/efos/domain";

export const LEARNING_ENGINE_CONSTANTS = {
  id: "learning",
  name: "Learning Engine",
  version: "0.1.0",
  /** Prefixo do id deterministico de cada LearningRecord (ver learning.mapper.ts). */
  idPrefix: "learning",
} as const;

export const LEARNING_ENGINE_MESSAGES = {
  invalidInput: "Entrada invalida para o Learning Engine.",
  missingCompanyId: "companyId e obrigatorio.",
  missingEvidence: "evidence e obrigatorio.",
  missingContext: "context e obrigatorio.",
  missingReasoning: "reasoning e obrigatorio.",
  missingRecommendation: "recommendation e obrigatorio.",
  missingDecision: "decision e obrigatorio.",
  evidenceCompanyMismatch:
    "evidence.companyId nao corresponde ao companyId informado.",
  contextCompanyMismatch:
    "context.companyId nao corresponde ao companyId informado.",
  reasoningCompanyMismatch:
    "reasoning.companyId nao corresponde ao companyId informado.",
  recommendationCompanyMismatch:
    "recommendation.companyId nao corresponde ao companyId informado.",
  decisionCompanyMismatch:
    "decision.companyId nao corresponde ao companyId informado.",
  evidenceFinancialModelMismatch:
    "evidence.financialModelId nao corresponde ao decision.financialModelId.",
  contextFinancialModelMismatch:
    "context.financialModelId nao corresponde ao decision.financialModelId.",
  reasoningFinancialModelMismatch:
    "reasoning.financialModelId nao corresponde ao decision.financialModelId.",
  recommendationFinancialModelMismatch:
    "recommendation.financialModelId nao corresponde ao decision.financialModelId.",
} as const;

/** `ReasoningType` (efos/domain/enums/reasoning.ts) reconhecido pela regra "Padrão de Risco Recorrente". */
export const RECURRING_RISK_REASONING_TYPE: ReasoningType = "operational_risk";
