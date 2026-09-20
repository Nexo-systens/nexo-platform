/**
 * Vocabulario da Recomendacao Executiva (Mission 012 — Recommendation
 * Engine). Conjuntos fechados — qualquer Recommendation fora deste
 * vocabulario nao e uma Recommendation valida. `RecommendationPriority`
 * ja existia (`efos/domain/enums/decision.ts`, Mission 003) e continua
 * la — apenas seus valores foram atualizados (D-010).
 */

/**
 * Natureza da acao proposta. Nesta fase, so `improve_cash_flow`,
 * `reduce_costs` e `review_operations` sao produzidos — os demais
 * estao reservados para regras futuras que dependam de Reasoning
 * types ainda nao produzidos pelo Reasoning Engine (ver
 * efos/engines/recommendation/README.md, "Limitacoes").
 */
export const RECOMMENDATION_TYPES = [
  "improve_cash_flow",
  "reduce_costs",
  "review_pricing",
  "renegotiate_debt",
  "improve_working_capital",
  "reduce_expenses",
  "improve_margin",
  "review_operations",
  "strengthen_liquidity",
] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

/**
 * Confianca na recomendacao. Enum proprio do Recommendation Engine —
 * por instrucao explicita da Mission 012, nao reaproveita
 * `ReasoningConfidence` (efos/domain/enums/reasoning.ts) nem nenhum
 * outro enum de confianca existente, apesar do mesmo formato de 4
 * niveis. Consolidada a partir da confianca do Reasoning de origem
 * (docs/DECISIONS.md D-010).
 */
export const RECOMMENDATION_CONFIDENCE_LEVELS = [
  "low",
  "medium",
  "high",
  "verified",
] as const;
export type RecommendationConfidence =
  (typeof RECOMMENDATION_CONFIDENCE_LEVELS)[number];
