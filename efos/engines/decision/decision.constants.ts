/**
 * Constantes do Decision Engine — id/versao, mensagens de validacao, e
 * as escalas de prioridade/confianca (reaproveitadas de
 * RecommendationPriority/RecommendationConfidence — D-011, sem enums
 * proprios). Nenhuma logica de priorizacao aqui (isso pertence a
 * decision.builder.ts).
 */

import type { RecommendationConfidence, RecommendationPriority } from "@/efos/domain";

export const DECISION_ENGINE_CONSTANTS = {
  id: "decision",
  name: "Decision Engine",
  version: "0.1.0",
  /** Prefixo do id deterministico de cada Decision (ver decision.mapper.ts). */
  idPrefix: "decision",
} as const;

export const DECISION_ENGINE_MESSAGES = {
  invalidInput: "Entrada invalida para o Decision Engine.",
  missingCompanyId: "companyId e obrigatorio.",
  missingEvidence: "evidence e obrigatorio.",
  missingContext: "context e obrigatorio.",
  missingReasoning: "reasoning e obrigatorio.",
  missingRecommendation: "recommendation e obrigatorio.",
  evidenceCompanyMismatch:
    "evidence.companyId nao corresponde ao companyId informado.",
  contextCompanyMismatch:
    "context.companyId nao corresponde ao companyId informado.",
  reasoningCompanyMismatch:
    "reasoning.companyId nao corresponde ao companyId informado.",
  recommendationCompanyMismatch:
    "recommendation.companyId nao corresponde ao companyId informado.",
  evidenceFinancialModelMismatch:
    "evidence.financialModelId nao corresponde ao recommendation.financialModelId.",
  contextFinancialModelMismatch:
    "context.financialModelId nao corresponde ao recommendation.financialModelId.",
  reasoningFinancialModelMismatch:
    "reasoning.financialModelId nao corresponde ao recommendation.financialModelId.",
} as const;

/**
 * Numero minimo de Recommendations para caracterizar uma decisao de
 * "priorizar sequencia" (2+ recomendacoes concorrendo por atencao
 * executiva). Abaixo disso (exatamente 1), a regra de "executar
 * imediatamente" e considerada (ver decision.builder.ts).
 */
export const MINIMUM_RECOMMENDATIONS_FOR_SEQUENCE = 2;

/** Prioridades de Recommendation que, isoladas (unica recomendacao), justificam execucao imediata sem necessidade de priorizacao entre concorrentes. */
export const IMMEDIATE_EXECUTION_PRIORITIES: readonly RecommendationPriority[] = [
  "high",
  "critical",
];

/**
 * Escala ordinal de `RecommendationPriority` — usada para ordenar
 * Recommendations por prioridade decrescente e para consolidar a
 * prioridade mais grave entre as Recommendations combinadas.
 */
export const RECOMMENDATION_PRIORITY_SCALE: readonly RecommendationPriority[] = [
  "low",
  "medium",
  "high",
  "critical",
];

/**
 * Escala ordinal de `RecommendationConfidence` — usada como criterio
 * de desempate na ordenacao por prioridade, e para consolidar a
 * confianca mais fraca entre as Recommendations combinadas.
 */
export const RECOMMENDATION_CONFIDENCE_SCALE: readonly RecommendationConfidence[] = [
  "low",
  "medium",
  "high",
  "verified",
];
