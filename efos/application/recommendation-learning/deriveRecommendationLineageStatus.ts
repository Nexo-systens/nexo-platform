import type { DecisionRecommendationTrace } from "./traceDecisionRecommendation";

/**
 * Mission 152 — Production Recommendation-to-Decision Learning Loop
 * (Etapa 16).
 *
 * Responde honestamente, para uma `Decision` já traçada
 * (`traceDecisionRecommendation()`), quais elos do lineage completo
 * (`Recommendation → Decision → Execution → Outcome → LearningRecord
 * → Pattern Evidence`) já existem de fato e quais ainda estão
 * ausentes — nunca preenche uma ausência com dado fabricado (Etapa 16:
 * "Não preencher ausências com dados fictícios").
 *
 * Todos os arrays de entrada (`executionEventCount`/`outcomeCount`/
 * `learningRecordCount`) já devem ter sido filtrados pelo CHAMADOR
 * para pertencerem exclusivamente a esta `Decision`
 * (`decisionId === trace.decisionId`) — esta função nunca acessa
 * banco, nunca filtra por conta própria, apenas conta o que já foi
 * fornecido. `hasSufficientPatternEvidence` reflete diretamente o
 * `state` de um `RecommendationOutcomePatternResult` (D-083) já
 * calculado pelo chamador, quando disponível — `FAVORABLE`/
 * `UNFAVORABLE`/`MIXED` contam como `SUFFICIENT`, `EMERGING`/
 * `INSUFFICIENT`/ausente contam como `INSUFFICIENT`.
 *
 * Pura, determinística — nenhum acesso a Supabase/banco/relógio.
 */
export const PRESENCE_STATES = ["PRESENT", "ABSENT"] as const;
export type PresenceState = (typeof PRESENCE_STATES)[number];

export const PATTERN_EVIDENCE_STATES = ["SUFFICIENT", "INSUFFICIENT"] as const;
export type PatternEvidenceState = (typeof PATTERN_EVIDENCE_STATES)[number];

export interface RecommendationLineageStatus {
  readonly recommendation: PresenceState;
  readonly decision: PresenceState;
  readonly execution: PresenceState;
  readonly outcome: PresenceState;
  readonly learningRecord: PresenceState;
  readonly patternEvidence: PatternEvidenceState;
}

export function deriveRecommendationLineageStatus(
  trace: DecisionRecommendationTrace,
  counts: {
    readonly executionEventCount: number;
    readonly outcomeCount: number;
    readonly learningRecordCount: number;
  },
  patternState?: "EMERGING" | "INSUFFICIENT" | "FAVORABLE" | "UNFAVORABLE" | "MIXED"
): RecommendationLineageStatus {
  const patternEvidence: PatternEvidenceState =
    patternState === "FAVORABLE" || patternState === "UNFAVORABLE" || patternState === "MIXED" ? "SUFFICIENT" : "INSUFFICIENT";

  return {
    recommendation: trace.outcome === "TRACEABLE" ? "PRESENT" : "ABSENT",
    decision: "PRESENT",
    execution: counts.executionEventCount > 0 ? "PRESENT" : "ABSENT",
    outcome: counts.outcomeCount > 0 ? "PRESENT" : "ABSENT",
    learningRecord: counts.learningRecordCount > 0 ? "PRESENT" : "ABSENT",
    patternEvidence,
  };
}
