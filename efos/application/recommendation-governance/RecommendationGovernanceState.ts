import type { DecisionExecutionStatus } from "@/efos/application/decision-execution";
import type { RecommendationReferenceCategory } from "@/efos/application/executive-diagnosis";
import type { RecommendationReviewStatusResult } from "@/efos/application/diagnosis-review";
import type { OutcomeStatus } from "@/efos/domain";

/**
 * Mission 154 — Executive Recommendation Governance & Decision
 * Readiness.
 *
 * **Achado central da auditoria (Etapa 1/9)**: `deriveRecommendationLineageStatus()`
 * (D-084, Mission 152) já computa PRESENT/ABSENT por elo
 * (recommendation/decision/execution/outcome/learningRecord) — mas é
 * DECISION-cêntrico (parte de uma `Decision` já escolhida e pergunta
 * "que Recommendation ela cita?"). Esta missão precisa do sentido
 * INVERSO — RECOMMENDATION-cêntrico ("dado um item específico de um
 * `ExecutiveDiagnosis`, qual Decision, se houver, o cita, e o que
 * aconteceu depois?") — por isso não duplica `RecommendationLineageStatus`,
 * complementa-o a partir da direção oposta, reaproveitando toda a
 * machinery já existente (`traceRecommendationReference()`,
 * `resolveRecommendationReviewStatus()`, `deriveDecisionExecutionState()`)
 * em vez de reimplementar qualquer parte dela.
 *
 * **`lifecycleState`** é um vocabulário fechado de PROGRESSÃO — nunca um
 * booleano por estágio (isso já existe como `evidence`, abaixo). A
 * ordem de precedência (do mais avançado para o menos avançado) reflete
 * exatamente a Etapa 4/5 da missão: `EXECUTING`/`BLOCKED`/`COMPLETED`/
 * `CANCELLED` só aparecem quando eventos de execução REAIS existem
 * (nunca inferidos de `DECIDED`); `OUTCOME_RECORDED` nunca é confundido
 * com "sucesso" (é apenas presença de um registro humano, seu
 * `outcomeStatus` real — positive/negative/neutral/inconclusive/pending
 * — é exposto separadamente, nunca interpretado aqui); `LEARNING_OBSERVED`
 * é estritamente presença de `LearningRecord`, nunca de `Knowledge`
 * (Etapa 7 — recorrência é responsabilidade exclusiva do Knowledge
 * Formation Engine, D-073, nunca replicada aqui).
 */
export const RECOMMENDATION_GOVERNANCE_LIFECYCLE_STATES = [
  "NOT_REVIEWED",
  "REVIEWED",
  "DECIDED",
  "EXECUTING",
  "BLOCKED",
  "COMPLETED",
  "CANCELLED",
  "OUTCOME_RECORDED",
  "LEARNING_OBSERVED",
] as const;
export type RecommendationGovernanceLifecycleState = (typeof RECOMMENDATION_GOVERNANCE_LIFECYCLE_STATES)[number];

/**
 * Evidência estrutural explícita (Etapa 16) — cada flag responde
 * exatamente por que o `lifecycleState` foi derivado daquela forma,
 * nunca uma conclusão sem origem rastreável. Nunca um score/ranking.
 */
export const RECOMMENDATION_GOVERNANCE_EVIDENCE_FLAGS = [
  "REVIEW_PRESENT",
  "REVIEW_ABSENT",
  "DECISION_PRESENT",
  "DECISION_ABSENT",
  "EXECUTION_PRESENT",
  "EXECUTION_ABSENT",
  "OUTCOME_PRESENT",
  "OUTCOME_ABSENT",
  "LEARNING_PRESENT",
  "LEARNING_ABSENT",
  "KNOWLEDGE_PRESENT",
  "KNOWLEDGE_ABSENT",
] as const;
export type RecommendationGovernanceEvidenceFlag = (typeof RECOMMENDATION_GOVERNANCE_EVIDENCE_FLAGS)[number];

/**
 * Vocabulário fechado de `outcome` (mesmo padrão de
 * `DecisionRecommendationTraceOutcome`, D-084) — cada valor responde
 * honestamente por que a governança foi ou não montada, nunca lança
 * exceção, nunca monta lineage sobre um boundary quebrado (Etapa
 * 17/18/19: "não montar lineage", "retornar estado explicitamente
 * inconsistente", "não confiar somente no client").
 */
export const RECOMMENDATION_GOVERNANCE_OUTCOMES = [
  "RECOMMENDATION_NOT_FOUND",
  "COMPANY_MISMATCH",
  "TEMPORAL_INCONSISTENCY",
  "GOVERNED",
] as const;
export type RecommendationGovernanceOutcome = (typeof RECOMMENDATION_GOVERNANCE_OUTCOMES)[number];

export interface RecommendationGovernanceState {
  readonly outcome: RecommendationGovernanceOutcome;
  readonly recommendationId: string;
  readonly diagnosisId: string;
  readonly companyId: string;
  readonly recommendationCategory?: RecommendationReferenceCategory;
  readonly recommendationStatement?: string;
  readonly lifecycleState?: RecommendationGovernanceLifecycleState;
  readonly evidence?: readonly RecommendationGovernanceEvidenceFlag[];
  readonly reviewStatus?: RecommendationReviewStatusResult;
  readonly decisionId?: string;
  readonly executionStatus?: DecisionExecutionStatus;
  readonly outcomeStatus?: OutcomeStatus;
  readonly learningRecordId?: string;
  readonly knowledgeId?: string;
  readonly reason: string;
}
