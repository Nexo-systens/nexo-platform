/**
 * Vocabulario da Evidencia (Mission 009 — Evidence Engine). Conjuntos
 * fechados — qualquer Evidence fora deste vocabulario nao e uma
 * Evidence valida.
 */

/**
 * Natureza do fato identificado. `positive`/`information` estao
 * reservados para regras futuras (ex.: tendencia de melhora, fato
 * neutro) — este Engine, nesta fase, so produz `negative`/`warning`
 * (ver README.md, "Limitacoes").
 */
export const EVIDENCE_TYPES = [
  "positive",
  "negative",
  "warning",
  "information",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

/**
 * Gravidade do fato. Substitui `EvidenceImpact` (Mission 003, nunca
 * consumido por nenhum Engine ate esta missao) — mesmo vocabulario de 4
 * valores, agora com o Evidence Engine como primeiro consumidor real
 * (docs/DECISIONS.md D-007).
 */
export const EVIDENCE_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type EvidenceSeverity = (typeof EVIDENCE_SEVERITIES)[number];

/**
 * Confianca no fato em si — distinta de `Provenance.confidence`
 * (`ConfidenceScore`/`ConfidenceLevel`, herdada de `DomainEntity`), que
 * descreve a confianca no processo que gerou o dado. `EvidenceConfidence`
 * descreve o quao bem fundamentado o fato esta: `verified` quando
 * calculado diretamente de um Indicator oficial (Indicators Engine),
 * `high` quando depende de uma convencao de classificacao adicional
 * (ver docs/DECISIONS.md D-007).
 */
export const EVIDENCE_CONFIDENCE_LEVELS = [
  "low",
  "medium",
  "high",
  "verified",
] as const;
export type EvidenceConfidence = (typeof EVIDENCE_CONFIDENCE_LEVELS)[number];

/**
 * Categoria tematica do fato. Vocabulario proprio da Evidencia, mais
 * granular que `FinancialStateCategory` (usado por `Indicator`) e
 * parcialmente sobreposto a ele de proposito — uma Evidencia responde
 * "sobre o que e este fato" em linguagem executiva, nao "em qual
 * classificacao contabil-tecnica ele se encaixa".
 */
export const EVIDENCE_CATEGORIES = [
  "cash_flow",
  "profitability",
  "liquidity",
  "working_capital",
  "debt",
  "costs",
  "revenue",
  "expense",
  "operational",
] as const;
export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

/**
 * Tipo de elemento de origem referenciado por `EvidenceSource`
 * (`efos/domain/value-objects/EvidenceSource.ts`) — garante
 * rastreabilidade explicita de toda Evidence ate os elementos que a
 * originaram.
 */
export const EVIDENCE_SOURCE_TYPES = [
  "indicator",
  "graph_node",
  "graph_edge",
  "financial_event",
  "resource",
] as const;
export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];
