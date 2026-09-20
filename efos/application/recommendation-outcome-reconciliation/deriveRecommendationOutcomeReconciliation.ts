import {
  RECOMMENDATION_REFERENCE_CATEGORIES,
  type ExecutiveDiagnosis,
  type InterpretationBasis,
} from "@/efos/application/executive-diagnosis";
import type { RecommendationGovernanceState } from "@/efos/application/recommendation-governance";
import type { FinancialOutcomeObservation } from "@/efos/application/financial-observation";

import type {
  FinancialObservationSummary,
  ReconciliationEvidenceFlag,
  RecommendationOutcomeReconciliation,
} from "./RecommendationOutcomeReconciliation";

/**
 * Mission 155 — Recommendation vs Outcome Reconciliation.
 *
 * Localiza a `basis` original de um item citável — nunca reimplementa a
 * identidade `(diagnosisId, itemId)` (`traceRecommendationReference()`,
 * D-082), reusa exatamente `RECOMMENDATION_REFERENCE_CATEGORIES` na
 * mesma ordem fixa. Devolve a MESMA referência do objeto já existente
 * no `ExecutiveDiagnosis`, nunca uma cópia (Etapa 3: "não copiar basis
 * para outro modelo se uma referência puder ser mantida").
 */
function findRecommendationBasis(diagnosis: ExecutiveDiagnosis, recommendationId: string): InterpretationBasis | undefined {
  for (const category of RECOMMENDATION_REFERENCE_CATEGORIES) {
    const items = diagnosis[category] as readonly { readonly id: string; readonly basis?: InterpretationBasis }[];
    const match = items.find((item) => item.id === recommendationId);
    if (match) return match.basis;
  }
  return undefined;
}

/**
 * `deriveRecommendationOutcomeReconciliation()` — reconstrói a relação
 * FACTUAL entre uma Recommendation e o que foi observado depois dela
 * ter sido decidida/executada, **consumindo** um `RecommendationGovernanceState`
 * (D-085, Mission 154) já computado como precondição — nunca
 * reimplementa `traceRecommendationReference()`/lineage de
 * Decision/`deriveDecisionExecutionState()`/veredito de Review, todos
 * já corretos em D-085. Adiciona exclusivamente as duas dimensões que
 * D-085 nunca cobriu: `FinancialOutcomeObservation` (D-071, Mission
 * 139, comparação objetiva de Financial Truth) e a `basis` original da
 * proposta (`InterpretationBasis`) — sempre expostas lado a lado do
 * `outcomeStatus` humano, nunca fundidas num veredito ("SUCCESSFUL"/
 * "FAILED"/"CAUSED_*" nunca existem neste vocabulário).
 *
 * Pura: nenhum acesso a Supabase/banco/relógio/IA, nenhuma mutação de
 * nenhum argumento recebido, nenhuma criação de Decision/Outcome/
 * LearningRecord/Knowledge. Quando `governance.outcome` já não é
 * `GOVERNED` (Recommendation inexistente, boundary de empresa quebrado,
 * inconsistência temporal), o motivo é repassado verbatim — nunca
 * recalculado, nunca uma segunda tentativa de "consertar" o resultado.
 */
export function deriveRecommendationOutcomeReconciliation(
  diagnosis: ExecutiveDiagnosis,
  governance: RecommendationGovernanceState,
  financialObservations: readonly FinancialOutcomeObservation[]
): RecommendationOutcomeReconciliation {
  const base = {
    governanceOutcome: governance.outcome,
    recommendationId: governance.recommendationId,
    diagnosisId: governance.diagnosisId,
    companyId: governance.companyId,
    recommendationCategory: governance.recommendationCategory,
    recommendationStatement: governance.recommendationStatement,
    recommendationBasis: findRecommendationBasis(diagnosis, governance.recommendationId),
  };

  if (governance.outcome !== "GOVERNED") {
    return {
      ...base,
      outcome: governance.outcome,
      reason: `Governança de base não pôde ser montada (${governance.outcome}) — reconciliação nunca é tentada sobre uma base inválida: ${governance.reason}`,
    };
  }

  // Etapa 14 — boundary de empresa reforçado defensivamente também para
  // FinancialOutcomeObservation, mesmo princípio de D-085 para Decision/
  // Execution/Outcome/Learning: uma observação financeira de outra
  // empresa nunca é aceita, mesmo que o decisionId coincida.
  const matchingAnyCompany = financialObservations.filter((observation) => observation.decisionId === governance.decisionId);
  const companyMismatch = matchingAnyCompany.find((observation) => observation.companyId !== governance.companyId);
  if (companyMismatch) {
    return {
      ...base,
      outcome: "COMPANY_MISMATCH",
      reason: `Uma FinancialOutcomeObservation ("${companyMismatch.id}") referencia a mesma Decision mas pertence a uma empresa diferente ("${companyMismatch.companyId}") da informada ("${governance.companyId}") — nenhuma reconciliação é montada sobre um boundary de empresa quebrado.`,
    };
  }

  const matchingObservations = matchingAnyCompany.filter((observation) => observation.companyId === governance.companyId);
  const observationSummaries: FinancialObservationSummary[] = matchingObservations.map((observation) => ({
    id: observation.id,
    classification: observation.classification,
    metrics: observation.metrics.length,
  }));

  const evidence: ReconciliationEvidenceFlag[] = [
    governance.decisionId ? "DECISION_PRESENT" : "NO_DECISION",
    governance.executionStatus && governance.executionStatus !== "NOT_STARTED" ? "EXECUTION_PRESENT" : "NO_EXECUTION",
    governance.outcomeStatus ? "OUTCOME_PRESENT" : "NO_OUTCOME",
    matchingObservations.length > 0 ? "FINANCIAL_OBSERVATION_PRESENT" : "NO_FINANCIAL_OBSERVATION",
    governance.learningRecordId ? "LEARNING_PRESENT" : "NO_LEARNING",
  ];

  // Etapa 9/10 — estado de reconstrução, nunca de mérito. Sempre o
  // estágio mais avançado evidenciado; nunca inferido além dos fatos
  // (Learning sem Outcome nunca acontece na prática, pois D-085 já
  // garante essa ordem, mas a precedência aqui é sempre defensiva).
  let reconciliationState: RecommendationOutcomeReconciliation["reconciliationState"];
  if (governance.learningRecordId) {
    reconciliationState = "LEARNING_RECORDED";
  } else if (matchingObservations.length > 0) {
    reconciliationState = "FINANCIAL_OBSERVATION_AVAILABLE";
  } else if (governance.outcomeStatus) {
    reconciliationState = "OUTCOME_RECORDED";
  } else if (governance.executionStatus && governance.executionStatus !== "NOT_STARTED") {
    reconciliationState = "EXECUTED_NO_OUTCOME";
  } else if (governance.decisionId) {
    reconciliationState = "DECIDED_NOT_EXECUTED";
  } else {
    reconciliationState = "NOT_DECIDED";
  }

  return {
    ...base,
    outcome: "RECONCILED",
    reconciliationState,
    evidence,
    decisionId: governance.decisionId,
    executionStatus: governance.executionStatus,
    outcomeStatus: governance.outcomeStatus,
    financialObservations: observationSummaries,
    learningRecordId: governance.learningRecordId,
    reason: "Relação factual reconstruída a partir de Governance (D-085) + FinancialOutcomeObservation (D-071) — Outcome humano e observação financeira permanecem sempre separados, nenhuma causalidade inferida, nenhum veredito de sucesso/fracasso produzido.",
  };
}
