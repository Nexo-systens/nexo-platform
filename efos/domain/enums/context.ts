/**
 * Vocabulario do Contexto Financeiro (Mission 010 — Context Engine).
 * Conjunto fechado — qualquer Context fora deste vocabulario nao e um
 * Context valido.
 */

/**
 * Natureza da situacao composta identificada. Este Engine, nesta fase,
 * so produz `cash_pressure` e `profitability` — os demais estao
 * reservados para regras futuras que dependam de tipos de Evidence
 * ainda nao produzidos (ex.: `growth` exigiria Evidence de tendencia,
 * que o Evidence Engine ainda nao gera — ver
 * efos/engines/context/README.md, "Limitacoes").
 */
export const CONTEXT_TYPES = [
  "cash_pressure",
  "liquidity",
  "profitability",
  "growth",
  "working_capital",
  "debt",
  "operational",
  "cost_structure",
  "revenue",
  "expense",
] as const;
export type ContextType = (typeof CONTEXT_TYPES)[number];

/**
 * Gravidade consolidada da situacao composta. Vocabulario proprio do
 * Context — mesmo conjunto de 4 valores de `EvidenceSeverity`
 * (efos/domain/enums/evidence.ts), mas um eixo conceitualmente
 * distinto: `EvidenceSeverity` classifica um fato individual,
 * `ContextSeverity` classifica a situacao composta resultante do
 * agrupamento (docs/DECISIONS.md D-008).
 */
export const CONTEXT_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type ContextSeverity = (typeof CONTEXT_SEVERITIES)[number];
