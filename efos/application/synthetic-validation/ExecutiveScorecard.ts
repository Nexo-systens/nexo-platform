import type { GroundTruthCategory } from "./SyntheticGroundTruth";

/**
 * Mission 164 — Executive CFO Validation Lab (Etapa 4).
 *
 * Vocabulario fechado de veredito categorico — nunca uma nota numerica
 * "de qualidade de IA" (Etapa 4 proibe explicitamente inventar um
 * placar arbitrario sem metodologia defensavel). Cada veredito e uma
 * classificacao estrutural, sempre acompanhada de uma `rationale`
 * legivel que explica a evidencia real por tras dele.
 */
export const EXECUTIVE_SCORECARD_VERDICTS = [
  "SUPPORTED",
  "PARTIALLY_SUPPORTED",
  "NOT_SUPPORTED",
  "NOT_COMPARABLE",
] as const;
export type ExecutiveScorecardVerdict = (typeof EXECUTIVE_SCORECARD_VERDICTS)[number];

/**
 * Os 9 pontos de comparacao exigidos pela Etapa 4 da missao, na mesma
 * ordem em que a missao os enumerou. `financial_facts` corresponde ao
 * `FinancialModelAggregate` (Financial Truth); os demais correspondem
 * 1:1 aos aggregates/estruturas reais ja produzidos pelo pipeline.
 */
export const EXECUTIVE_SCORECARD_STAGES = [
  "financial_facts",
  "indicators",
  "evidence",
  "context",
  "reasoning",
  "recommendations",
  "executive_financial_context",
  "executive_knowledge_context",
  "executive_ai_instruction",
] as const;
export type ExecutiveScorecardStage = (typeof EXECUTIVE_SCORECARD_STAGES)[number];

/**
 * `forward` — o output real de um estagio sustenta (ou nao) uma
 * afirmacao de `SyntheticGroundTruth` conhecida de antemao (Etapa 4/5:
 * "o EFOS detectou o que deveria detectar?"). `reverse` — um item de
 * output real e economicamente coerente e sustentado pela Financial
 * Truth, independente de qualquer expectativa previa (Etapa 6: analise
 * de falso-positivo, "o EFOS afirmou algo que os dados nao sustentam?").
 * As duas direcoes reaproveitam o mesmo vocabulario de veredito —
 * nunca duas taxonomias paralelas para a mesma pergunta binaria
 * "os dados sustentam esta afirmacao".
 */
export const EXECUTIVE_SCORECARD_DIRECTIONS = ["forward", "reverse"] as const;
export type ExecutiveScorecardDirection = (typeof EXECUTIVE_SCORECARD_DIRECTIONS)[number];

export interface ExecutiveScorecardEntry {
  readonly scenarioId: string;
  readonly stage: ExecutiveScorecardStage;
  readonly direction: ExecutiveScorecardDirection;
  /** Presente apenas em entradas `forward`, que verificam uma `GroundTruthAssertion` concreta. */
  readonly groundTruthCategory?: GroundTruthCategory;
  readonly statement: string;
  readonly verdict: ExecutiveScorecardVerdict;
  readonly rationale: string;
}

/**
 * Construtor puro — nunca reexecuta nenhuma Engine, nunca acessa
 * banco/IA. O harness de teste (que le os aggregates reais) decide o
 * veredito com base em evidencia observada; esta funcao apenas
 * normaliza o formato para que o relatorio final e o README possam
 * apresentar as 3 empresas numa unica tabela consistente.
 */
export function buildExecutiveScorecardEntry(
  scenarioId: string,
  stage: ExecutiveScorecardStage,
  direction: ExecutiveScorecardDirection,
  statement: string,
  verdict: ExecutiveScorecardVerdict,
  rationale: string,
  groundTruthCategory?: GroundTruthCategory
): ExecutiveScorecardEntry {
  return {
    scenarioId,
    stage,
    direction,
    statement,
    verdict,
    rationale,
    ...(groundTruthCategory ? { groundTruthCategory } : {}),
  };
}
