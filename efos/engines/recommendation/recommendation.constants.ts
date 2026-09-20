/**
 * Constantes do Recommendation Engine — id/versao, mensagens de
 * validacao, tipos de Reasoning reconhecidos por regra, e as escalas
 * de traducao de prioridade/confianca. Nenhuma logica de recomendacao
 * aqui (isso pertence a recommendation.builder.ts).
 */

import type {
  ContextSeverity,
  ReasoningConfidence,
  ReasoningType,
  RecommendationConfidence,
  RecommendationPriority,
} from "@/efos/domain";

export const RECOMMENDATION_ENGINE_CONSTANTS = {
  id: "recommendation",
  name: "Recommendation Engine",
  version: "0.1.0",
  /** Prefixo do id deterministico de cada Recommendation (ver recommendation.mapper.ts). */
  idPrefix: "recommendation",
} as const;

export const RECOMMENDATION_ENGINE_MESSAGES = {
  invalidInput: "Entrada invalida para o Recommendation Engine.",
  missingCompanyId: "companyId e obrigatorio.",
  missingFinancialModel: "financialModel e obrigatorio.",
  missingFinancialModelRoot: "financialModel.root e obrigatorio.",
  missingIndicators: "indicators e obrigatorio.",
  missingFinancialKnowledgeGraph: "financialKnowledgeGraph e obrigatorio.",
  missingEvidence: "evidence e obrigatorio.",
  missingContext: "context e obrigatorio.",
  missingReasoning: "reasoning e obrigatorio.",
  financialModelCompanyMismatch:
    "financialModel.root.companyId nao corresponde ao companyId informado.",
  indicatorsCompanyMismatch:
    "indicators.companyId nao corresponde ao companyId informado.",
  indicatorsFinancialModelMismatch:
    "indicators.financialModelId nao corresponde ao financialModel.root.id.",
  graphCompanyMismatch:
    "financialKnowledgeGraph.companyId nao corresponde ao companyId informado.",
  graphFinancialModelMismatch:
    "financialKnowledgeGraph.financialModelId nao corresponde ao financialModel.root.id.",
  evidenceCompanyMismatch:
    "evidence.companyId nao corresponde ao companyId informado.",
  evidenceFinancialModelMismatch:
    "evidence.financialModelId nao corresponde ao financialModel.root.id.",
  contextCompanyMismatch:
    "context.companyId nao corresponde ao companyId informado.",
  contextFinancialModelMismatch:
    "context.financialModelId nao corresponde ao financialModel.root.id.",
  reasoningCompanyMismatch:
    "reasoning.companyId nao corresponde ao companyId informado.",
  reasoningFinancialModelMismatch:
    "reasoning.financialModelId nao corresponde ao financialModel.root.id.",
} as const;

/** `ReasoningType` (efos/domain/enums/reasoning.ts) reconhecido pela regra "Reforçar geração de caixa". */
export const IMPROVE_CASH_FLOW_REASONING_TYPE: ReasoningType = "cash_risk";

/** `ReasoningType` reconhecido pela regra "Revisar estrutura de custos". */
export const REDUCE_COSTS_REASONING_TYPE: ReasoningType = "profitability_risk";

/** `ReasoningType` reconhecido pela regra "Revisar operações em múltiplas frentes". */
export const REVIEW_OPERATIONS_REASONING_TYPE: ReasoningType = "operational_risk";

/**
 * Escala ordinal de `ReasoningConfidence` (formato de
 * `Reasoning.confidence`, efos/domain/entities/Reasoning.ts) — usada
 * para traduzir a confianca do Reasoning de origem para
 * `RecommendationConfidence`. Definida localmente (nao importada de
 * efos/engines/reasoning) para manter este Engine desacoplado dos
 * internos de outro Engine (D-002) — mesmo precedente de
 * evidence.builder.ts/context.builder.ts/reasoning.builder.ts.
 */
export const REASONING_CONFIDENCE_SCALE: readonly ReasoningConfidence[] = [
  "low",
  "medium",
  "high",
  "verified",
];

/** Escala ordinal de `RecommendationConfidence` — mesmas posicoes de `REASONING_CONFIDENCE_SCALE`. */
export const RECOMMENDATION_CONFIDENCE_SCALE: readonly RecommendationConfidence[] = [
  "low",
  "medium",
  "high",
  "verified",
];

/**
 * Escala ordinal de `ContextSeverity` (efos/domain/enums/context.ts) —
 * usada para ranquear a severidade dos Contexts de origem (via
 * `ContextAggregate`, alcancados pelos IDs em `Reasoning.contexts`) ao
 * derivar a prioridade de uma Recommendation.
 */
export const CONTEXT_SEVERITY_SCALE: readonly ContextSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

/** Escala ordinal de `RecommendationPriority` — mesmas posicoes de `CONTEXT_SEVERITY_SCALE`. */
export const RECOMMENDATION_PRIORITY_SCALE: readonly RecommendationPriority[] = [
  "low",
  "medium",
  "high",
  "critical",
];
