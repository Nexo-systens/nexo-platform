import { traceRecommendationReference, type ExecutiveDiagnosis } from "@/efos/application/executive-diagnosis";
import { resolveRecommendationReviewStatus, type DiagnosisReview } from "@/efos/application/diagnosis-review";
import { deriveDecisionExecutionState, type DecisionExecutionEvent } from "@/efos/application/decision-execution";
import type { Decision, Knowledge, LearningRecord, Outcome } from "@/efos/domain";

import type {
  RecommendationGovernanceEvidenceFlag,
  RecommendationGovernanceState,
} from "./RecommendationGovernanceState";

/**
 * Mission 154 — Executive Recommendation Governance & Decision
 * Readiness.
 *
 * Reconstrói o ciclo de vida operacional de UM item citável específico
 * de um `ExecutiveDiagnosis` já persistido — nunca o contrário
 * (`traceDecisionRecommendation()`, D-084, parte de uma `Decision` já
 * escolhida; esta função parte da Recommendation e pergunta "que
 * Decision, se houver, a cita?"). Função pura: nenhum acesso a
 * Supabase/banco/relógio/IA, nenhum `randomUUID()`, nenhuma mutação de
 * nenhum argumento recebido — mesmo input sempre produz o mesmo output
 * (Etapa 15).
 *
 * **Boundary (Etapa 18/19)**: `companyId` é sempre um parâmetro
 * explícito e separado (mesmo precedente de D-083/D-084) — nunca
 * inferido do próprio diagnóstico (que não carrega `companyId`, D-059).
 * Qualquer `Decision` cujo `basedOnDiagnosisId`/`basedOnRecommendationId`
 * casam com esta Recommendation, mas cujo `companyId` diverge do
 * parâmetro, produz `COMPANY_MISMATCH` — nenhum lineage é montado nesse
 * caso, mesmo que o restante dos dados pareça consistente.
 *
 * **Temporalidade (Etapa 17)**: eventos de execução/outcome/learning
 * cronologicamente anteriores à própria `Decision` que os originou
 * produzem `TEMPORAL_INCONSISTENCY` — o estado é reportado
 * explicitamente inconsistente, nunca "corrigido" silenciosamente.
 * Sempre `Date.parse()`, nunca `localeCompare()` (lição da Mission 138).
 */
export function deriveRecommendationGovernanceState(
  recommendationId: string,
  diagnosis: ExecutiveDiagnosis,
  companyId: string,
  review: DiagnosisReview | undefined,
  decisions: readonly Decision[],
  executionEvents: readonly DecisionExecutionEvent[],
  outcomes: readonly Outcome[],
  learningRecords: readonly LearningRecord[],
  knowledgeRecords: readonly Knowledge[] = []
): RecommendationGovernanceState {
  const base = { recommendationId, diagnosisId: diagnosis.id, companyId };

  const trace = traceRecommendationReference(diagnosis, recommendationId);
  if (!trace) {
    return {
      ...base,
      outcome: "RECOMMENDATION_NOT_FOUND",
      reason: "O recommendationId informado não corresponde a nenhum item real deste ExecutiveDiagnosis — nenhuma governança é montada sobre uma referência inventada.",
    };
  }

  // Etapa 9/19 — só Decisions que citam EXATAMENTE este item, desta
  // exata Diagnosis, nunca uma Decision de outra Recommendation (mesmo
  // diagnóstico) nem de outra Diagnosis (mesmo id de item, reusando a
  // proteção de colisão cross-categoria da Mission 153/D-059).
  const matchingAnyCompany = decisions.filter(
    (decision) => decision.basedOnDiagnosisId === diagnosis.id && decision.basedOnRecommendationId === recommendationId
  );
  const companyMismatch = matchingAnyCompany.find((decision) => decision.companyId !== companyId);
  if (companyMismatch) {
    return {
      ...base,
      outcome: "COMPANY_MISMATCH",
      recommendationCategory: trace.category,
      recommendationStatement: trace.statement,
      reason: `Uma Decision ("${companyMismatch.id}") cita esta Recommendation mas pertence a uma empresa diferente ("${companyMismatch.companyId}") da informada ("${companyId}") — nenhum lineage é montado sobre um boundary de empresa quebrado, mesmo que diagnosisId/recommendationId coincidam.`,
    };
  }

  const matching = matchingAnyCompany.filter((decision) => decision.companyId === companyId);
  const reviewStatus = review ? resolveRecommendationReviewStatus(recommendationId, review) : undefined;

  if (matching.length === 0) {
    const evidence: RecommendationGovernanceEvidenceFlag[] = [
      review ? "REVIEW_PRESENT" : "REVIEW_ABSENT",
      "DECISION_ABSENT",
      "EXECUTION_ABSENT",
      "OUTCOME_ABSENT",
      "LEARNING_ABSENT",
      "KNOWLEDGE_ABSENT",
    ];
    return {
      ...base,
      outcome: "GOVERNED",
      recommendationCategory: trace.category,
      recommendationStatement: trace.statement,
      lifecycleState: review ? "REVIEWED" : "NOT_REVIEWED",
      evidence,
      reviewStatus,
      reason: review
        ? "Esta Recommendation já foi revisada, mas nenhuma Decision humana a cita ainda — julgamento humano registrado, escolha ainda não tomada."
        : "Nenhuma Review nem Decision existe ainda para esta Recommendation — proposta gerada pelo EFOS, ainda não avaliada por um humano.",
    };
  }

  // Decision mais recente entre as que citam esta Recommendation
  // (Date.parse, nunca localeCompare — lição da Mission 138).
  const decision = [...matching].sort((a, b) => Date.parse(b.audit.createdAt) - Date.parse(a.audit.createdAt))[0];

  const matchingEvents = executionEvents.filter(
    (event) => event.decisionId === decision.id && event.companyId === companyId
  );
  const eventsBeforeDecision = matchingEvents.find(
    (event) => Date.parse(event.occurredAt) < Date.parse(decision.audit.createdAt)
  );
  if (eventsBeforeDecision) {
    return {
      ...base,
      outcome: "TEMPORAL_INCONSISTENCY",
      recommendationCategory: trace.category,
      recommendationStatement: trace.statement,
      decisionId: decision.id,
      reason: `Um evento de execução ("${eventsBeforeDecision.id}", ${eventsBeforeDecision.occurredAt}) ocorre ANTES da própria Decision que o originou ("${decision.id}", ${decision.audit.createdAt}) — inconsistência temporal real nos dados, reportada honestamente, nunca corrigida silenciosamente.`,
    };
  }

  const matchingOutcomes = outcomes.filter((outcome) => outcome.decisionId === decision.id && outcome.companyId === companyId);
  const outcomesBeforeDecision = matchingOutcomes.find(
    (outcome) => Date.parse(outcome.observedAt) < Date.parse(decision.audit.createdAt)
  );
  if (outcomesBeforeDecision) {
    return {
      ...base,
      outcome: "TEMPORAL_INCONSISTENCY",
      recommendationCategory: trace.category,
      recommendationStatement: trace.statement,
      decisionId: decision.id,
      reason: `Um Outcome ("${outcomesBeforeDecision.id}", ${outcomesBeforeDecision.observedAt}) foi observado ANTES da própria Decision que o originou ("${decision.id}", ${decision.audit.createdAt}) — inconsistência temporal real nos dados, reportada honestamente, nunca corrigida silenciosamente.`,
    };
  }

  const matchingLearningRecords = learningRecords.filter(
    (record) => record.companyId === companyId && record.decisions.includes(decision.id)
  );
  const learningBeforeDecision = matchingLearningRecords.find(
    (record) => Date.parse(record.audit.createdAt) < Date.parse(decision.audit.createdAt)
  );
  if (learningBeforeDecision) {
    return {
      ...base,
      outcome: "TEMPORAL_INCONSISTENCY",
      recommendationCategory: trace.category,
      recommendationStatement: trace.statement,
      decisionId: decision.id,
      reason: `Um LearningRecord ("${learningBeforeDecision.id}", ${learningBeforeDecision.audit.createdAt}) foi derivado ANTES da própria Decision que o originou ("${decision.id}", ${decision.audit.createdAt}) — inconsistência temporal real nos dados, reportada honestamente, nunca corrigida silenciosamente.`,
    };
  }

  const executionState = matchingEvents.length > 0 ? deriveDecisionExecutionState(matchingEvents) : undefined;

  const learningRecordIds = new Set(matchingLearningRecords.map((record) => record.id));
  const outcomeIds = new Set(matchingOutcomes.map((outcome) => outcome.id));
  const relatedKnowledge = knowledgeRecords.find(
    (knowledge) =>
      knowledge.companyId === companyId &&
      ((knowledge.derivedFromLearningRecordIds ?? []).some((id) => learningRecordIds.has(id)) ||
        knowledge.derivedFromOutcomeIds.some((id) => outcomeIds.has(id)))
  );

  const evidence: RecommendationGovernanceEvidenceFlag[] = [
    review ? "REVIEW_PRESENT" : "REVIEW_ABSENT",
    "DECISION_PRESENT",
    matchingEvents.length > 0 ? "EXECUTION_PRESENT" : "EXECUTION_ABSENT",
    matchingOutcomes.length > 0 ? "OUTCOME_PRESENT" : "OUTCOME_ABSENT",
    matchingLearningRecords.length > 0 ? "LEARNING_PRESENT" : "LEARNING_ABSENT",
    relatedKnowledge ? "KNOWLEDGE_PRESENT" : "KNOWLEDGE_ABSENT",
  ];

  // Etapa 2/4/5/6 — progressão em ordem de precedência (mais avançado
  // vence), nunca uma inferência automática de um estágio a partir do
  // anterior (DECIDED nunca vira EXECUTING sem eventos reais; COMPLETED
  // nunca vira OUTCOME positivo/negativo — apenas presença, nunca
  // polaridade).
  const latestOutcome = matchingOutcomes.length > 0
    ? [...matchingOutcomes].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0]
    : undefined;

  const EXECUTION_TO_GOVERNANCE_STATE = {
    IN_PROGRESS: "EXECUTING",
    BLOCKED: "BLOCKED",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
  } as const;

  let lifecycleState: RecommendationGovernanceState["lifecycleState"];
  if (matchingLearningRecords.length > 0) {
    lifecycleState = "LEARNING_OBSERVED";
  } else if (matchingOutcomes.length > 0) {
    lifecycleState = "OUTCOME_RECORDED";
  } else if (executionState && executionState.status !== "NOT_STARTED") {
    lifecycleState = EXECUTION_TO_GOVERNANCE_STATE[executionState.status];
  } else {
    lifecycleState = "DECIDED";
  }

  return {
    ...base,
    outcome: "GOVERNED",
    recommendationCategory: trace.category,
    recommendationStatement: trace.statement,
    lifecycleState,
    evidence,
    reviewStatus,
    decisionId: decision.id,
    executionStatus: executionState?.status,
    outcomeStatus: latestOutcome?.status,
    learningRecordId: matchingLearningRecords[0]?.id,
    knowledgeId: relatedKnowledge?.id,
    reason: "Ciclo de vida reconstruído a partir de fatos reais fornecidos pelo chamador — nenhum dado fabricado, nenhuma inferência de estágio não evidenciado.",
  };
}
