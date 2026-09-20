/**
 * Enums do raciocinio (docs/00_FUNDACION/03_EFOS REASONING MODEL.md).
 */

export const CONFIDENCE_LEVELS = [
  "weak",
  "moderate",
  "high",
  "very_high",
] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const HYPOTHESIS_STATUSES = [
  "candidate",
  "confirmed",
  "refuted",
] as const;
export type HypothesisStatus = (typeof HYPOTHESIS_STATUSES)[number];

/**
 * Natureza da conclusao executiva produzida pelo Reasoning Engine
 * (Mission 011). Conjunto fechado — qualquer Reasoning fora deste
 * vocabulario nao e um Reasoning valido. Nesta fase, so
 * `cash_risk`/`profitability_risk`/`operational_risk` sao produzidos —
 * os demais estao reservados para regras futuras que dependam de
 * Context types ainda nao produzidos pelo Context Engine (ver
 * efos/engines/reasoning/README.md, "Limitacoes").
 */
export const REASONING_TYPES = [
  "cash_risk",
  "liquidity_risk",
  "profitability_risk",
  "operational_risk",
  "working_capital_risk",
  "debt_risk",
  "growth_opportunity",
  "cost_pressure",
  "revenue_pressure",
] as const;
export type ReasoningType = (typeof REASONING_TYPES)[number];

/**
 * Confianca na conclusao executiva. Enum proprio do Reasoning Engine —
 * por instrucao explicita da Mission 011, nao reaproveita
 * `EvidenceConfidence` (efos/domain/enums/evidence.ts) nem
 * `ConfidenceLevel` (acima), apesar do mesmo formato de 4 niveis.
 * Consolidada a partir da confianca dos Contexts combinados (o elo
 * mais fraco) — nunca um julgamento independente deste Engine (ver
 * docs/DECISIONS.md D-009).
 */
export const REASONING_CONFIDENCE_LEVELS = [
  "low",
  "medium",
  "high",
  "verified",
] as const;
export type ReasoningConfidence = (typeof REASONING_CONFIDENCE_LEVELS)[number];
