import type { DecisionExecutionStatus } from "@/efos/application/decision-execution";
import type { InterpretationBasis, RecommendationReferenceCategory } from "@/efos/application/executive-diagnosis";
import type { RecommendationGovernanceOutcome } from "@/efos/application/recommendation-governance";
import type { OutcomeStatus } from "@/efos/domain";

/**
 * Mission 155 — Recommendation vs Outcome Reconciliation.
 *
 * **Achado central da auditoria (Etapa 1)**: `RecommendationGovernanceState`
 * (D-085, Mission 154) já reconstrói presença/ausência de Decision/
 * Execution/Outcome/Learning/Knowledge para uma Recommendation
 * específica — mas nunca expõe `FinancialOutcomeObservation` (D-071,
 * Mission 139) nem a `basis` original da Recommendation. Esta missão
 * NUNCA reimplementa o que D-085 já faz — `deriveRecommendationOutcomeReconciliation()`
 * **consome** um `RecommendationGovernanceState` já computado como
 * precondição, adicionando exclusivamente as duas dimensões genuinamente
 * novas: a comparação financeira objetiva (D-071) e a base original da
 * proposta (`InterpretationBasis`), sempre lado a lado, nunca fundidas
 * num veredito único.
 *
 * **REGRA DE OURO (nunca violada por este tipo)**: `outcomeStatus`
 * (julgamento humano) e `financialObservations` (comparação objetiva de
 * Financial Truth) permanecem SEMPRE campos separados — nunca existe um
 * campo "success"/"failure"/"effective" que os combine. `Outcome.status
 * = POSITIVE` nunca vira `Recommendation: SUCCESSFUL`; uma
 * `FinancialMetricObservation` com `direction: "increased"` nunca vira
 * "a Recommendation causou o aumento".
 */
export const RECONCILIATION_EVIDENCE_FLAGS = [
  "DECISION_PRESENT",
  "NO_DECISION",
  "EXECUTION_PRESENT",
  "NO_EXECUTION",
  "OUTCOME_PRESENT",
  "NO_OUTCOME",
  "FINANCIAL_OBSERVATION_PRESENT",
  "NO_FINANCIAL_OBSERVATION",
  "LEARNING_PRESENT",
  "NO_LEARNING",
] as const;
export type ReconciliationEvidenceFlag = (typeof RECONCILIATION_EVIDENCE_FLAGS)[number];

/**
 * Estado estrutural de RECONSTRUÇÃO (não de mérito) — responde "até
 * onde o ciclo proposta→observação pôde ser reconstruído", nunca "a
 * Recommendation foi boa". Deliberadamente mais grosseiro que
 * `RecommendationGovernanceLifecycleState` (D-085) na dimensão de
 * execução (`EXECUTING`/`BLOCKED`/`COMPLETED`/`CANCELLED` são todos
 * `EXECUTED_NO_OUTCOME` aqui — o detalhe fino continua disponível via
 * `executionStatus`, sem duplicação) e mais fino na dimensão financeira,
 * que D-085 nunca tinha (`FINANCIAL_OBSERVATION_AVAILABLE`).
 */
export const RECONCILIATION_STATES = [
  "NOT_DECIDED",
  "DECIDED_NOT_EXECUTED",
  "EXECUTED_NO_OUTCOME",
  "OUTCOME_RECORDED",
  "FINANCIAL_OBSERVATION_AVAILABLE",
  "LEARNING_RECORDED",
] as const;
export type ReconciliationState = (typeof RECONCILIATION_STATES)[number];

/**
 * Vocabulário fechado de `outcome` (mesmo padrão de
 * `RecommendationGovernanceOutcome`, D-085) — quando a governança de
 * base não pôde ser montada (`RECOMMENDATION_NOT_FOUND`/
 * `COMPANY_MISMATCH`/`TEMPORAL_INCONSISTENCY`), o motivo é repassado
 * verbatim, NUNCA recalculado — só o caso `RECONCILED` é produzido por
 * lógica genuinamente nova desta missão.
 */
export const RECONCILIATION_OUTCOMES = [
  "RECOMMENDATION_NOT_FOUND",
  "COMPANY_MISMATCH",
  "TEMPORAL_INCONSISTENCY",
  "RECONCILED",
] as const;
export type ReconciliationOutcome = (typeof RECONCILIATION_OUTCOMES)[number];

export interface FinancialObservationSummary {
  readonly id: string;
  readonly classification: string;
  readonly metrics: number;
}

export interface RecommendationOutcomeReconciliation {
  readonly outcome: ReconciliationOutcome;
  readonly governanceOutcome: RecommendationGovernanceOutcome;
  readonly recommendationId: string;
  readonly diagnosisId: string;
  readonly companyId: string;
  readonly recommendationCategory?: RecommendationReferenceCategory;
  readonly recommendationStatement?: string;
  /**
   * Etapa 3 — nunca copiada para outro modelo; sempre a mesma
   * referência do objeto original dentro do `ExecutiveDiagnosis`
   * (`InterpretationBasis`), nunca julgada como "correta"/"incorreta".
   */
  readonly recommendationBasis?: InterpretationBasis;
  readonly reconciliationState?: ReconciliationState;
  readonly evidence?: readonly ReconciliationEvidenceFlag[];
  readonly decisionId?: string;
  readonly executionStatus?: DecisionExecutionStatus;
  /** Fato humano bruto — nunca traduzido em sucesso/fracasso da Recommendation (Etapa 11). */
  readonly outcomeStatus?: OutcomeStatus;
  /** Fatos objetivos de Financial Truth — sempre separados de `outcomeStatus` (Etapa 12). */
  readonly financialObservations?: readonly FinancialObservationSummary[];
  readonly learningRecordId?: string;
  readonly reason: string;
}
