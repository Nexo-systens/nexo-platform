import { getExecutiveDiagnosesByCompany } from "@/modules/decisions/services/executive-diagnosis-persistence.service";
import { getDiagnosisReviewsByDiagnosis } from "@/modules/decisions/services/diagnosis-review-persistence.service";
import { getDecisionsByCompany } from "@/modules/decisions/services/decision-persistence.service";
import {
  getDecisionExecutionEventsByDecision,
  getOutcomesByDecision,
} from "@/modules/decisions/services/decision-execution-persistence.service";
import { getFinancialObservationsByDecision } from "@/modules/decisions/services/financial-observation-persistence.service";
import { getLearningRecordsByCompany } from "@/modules/decisions/services/learning-record-persistence.service";
import { getKnowledgeByCompany } from "@/modules/decisions/services/knowledge-persistence.service";
import { buildDecisionCenterQueue, type ExecutiveDecisionWorkItem } from "@/modules/decisions/lib/buildDecisionCenterQueue";

/**
 * Mission 204 — carregamento da Central de Decisões extraído do
 * componente (mesmas leituras, mesma fila canônica de
 * `buildDecisionCenterQueue`), para que o workspace e a visão executiva
 * mostrem o mesmo estado sem duplicar a lógica.
 */
export async function loadDecisionCenter(companyId: string) {
  const [diagnoses, decisions] = await Promise.all([
    getExecutiveDiagnosesByCompany(companyId),
    getDecisionsByCompany(companyId),
  ]);

  if (diagnoses.length === 0 && decisions.length === 0) {
    return null;
  }

  const [reviewsPerDiagnosis, learningRecords, knowledgeRecords] = await Promise.all([
    Promise.all(diagnoses.map((diagnosis) => getDiagnosisReviewsByDiagnosis(diagnosis.id))),
    getLearningRecordsByCompany(companyId),
    getKnowledgeByCompany(companyId),
  ]);
  const reviewsByDiagnosis = Object.fromEntries(
    diagnoses.map((diagnosis, index) => [diagnosis.id, reviewsPerDiagnosis[index]])
  );

  const [executionEventsByDecision, outcomesByDecision, financialObservationsByDecision] = await Promise.all([
    Promise.all(decisions.map((decision) => getDecisionExecutionEventsByDecision(decision.id))),
    Promise.all(decisions.map((decision) => getOutcomesByDecision(decision.id))),
    Promise.all(decisions.map((decision) => getFinancialObservationsByDecision(decision.id))),
  ]);

  const queue = buildDecisionCenterQueue({
    companyId,
    diagnoses,
    reviewsByDiagnosis,
    decisions,
    executionEvents: executionEventsByDecision.flat(),
    outcomes: outcomesByDecision.flat(),
    learningRecords,
    knowledgeRecords,
    financialObservations: financialObservationsByDecision.flat(),
  });

  return { diagnoses, decisions, reviewsByDiagnosis, queue, knowledgeCount: knowledgeRecords.length };
}

export interface DecisionCenterSummary {
  readonly pending: number;
  readonly decided: number;
  readonly concluded: number;
  readonly pendingItems: readonly Pick<ExecutiveDecisionWorkItem, "recommendationId" | "statement" | "category">[];
  readonly knowledgeCount: number;
}

export function summarizeDecisionQueue(
  queue: readonly ExecutiveDecisionWorkItem[],
  knowledgeCount: number
): DecisionCenterSummary {
  const pending = queue.filter((item) => item.bucket === "requires-decision");
  return {
    pending: pending.length,
    decided: queue.filter((item) => item.bucket === "decided").length,
    concluded: queue.filter((item) => item.bucket === "concluded").length,
    pendingItems: pending.map(({ recommendationId, statement, category }) => ({ recommendationId, statement, category })),
    knowledgeCount,
  };
}

export async function getDecisionCenterSummary(companyId: string): Promise<DecisionCenterSummary | null> {
  const center = await loadDecisionCenter(companyId);
  return center ? summarizeDecisionQueue(center.queue, center.knowledgeCount) : null;
}
