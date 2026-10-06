import { readScenarioDecisionContext, type ScenarioDecisionContext } from "@/efos/application/decision-lifecycle";
import { keepPosteriorObservations, type FinancialOutcomeObservation } from "@/efos/application/financial-observation";
import { positionedExecutionOf, type HistoricalExecution } from "@/efos/application/history";
import type { Knowledge, LearningRecord, Outcome } from "@/efos/domain";
import type { PersistedDecision } from "@/modules/decisions/services/decision-persistence.service";
import type { PersistedExecutiveDiagnosis } from "@/modules/decisions/services/executive-diagnosis-persistence.service";
import { scenarioContextMatchesExecution } from "@/modules/scenarios/lib/scenarioBaselineIdentity";


/**
 * Mission 208 — o que pertence a um relatório executivo além do próprio
 * `ExecutiveReport`.
 *
 * Só vínculo explícito já gravado, nunca proximidade de datas:
 *
 * - **Leitura da Executive AI**: `executive_diagnoses.execution_id` igual à
 *   execução do relatório (gravado na ativação do diagnóstico).
 * - **Decisões**: as que nasceram de uma recomendação dessa leitura
 *   (`decisions.diagnosis_id` / `basedOnDiagnosisId`) ou de um cenário
 *   avaliado sobre ESTA verdade financeira — mesmo período e mesma
 *   impressão do Financial Model (`scenarioContext.baselineFingerprint`,
 *   Mission 184 Closure).
 * - **Resultados observados neste período**: observações financeiras cuja
 *   execução de observação é a do relatório
 *   (`financial_observations.observation_execution_id`) — e só as de
 *   período estritamente posterior à base da decisão (Mission 211, D-136:
 *   `keepPosteriorObservations`, a mesma regra da leitura no banco). Uma
 *   reanálise do mesmo período ou um período anterior nunca vira resultado.
 * - **Aprendizados**: Knowledge cuja origem (learning records ou outcomes)
 *   leva a uma dessas decisões.
 *
 * Toda entrada é filtrada pela empresa do relatório, mesmo que o chamador
 * já tenha consultado por empresa (defesa em profundidade, como
 * `buildDecisionCenterQueue`). Função pura.
 */

export type ReportDecisionOrigin =
  | { readonly kind: "diagnosis"; readonly diagnosisId: string }
  | { readonly kind: "scenario"; readonly scenario: ScenarioDecisionContext };

export interface ReportDecisionLink {
  readonly decision: PersistedDecision;
  readonly origin: ReportDecisionOrigin;
}

export interface ReportLineageInputs {
  readonly current: HistoricalExecution;
  /** Mission 211 — histórico da empresa, para posicionar as execuções citadas pelas observações. */
  readonly history: readonly HistoricalExecution[];
  readonly diagnoses: readonly PersistedExecutiveDiagnosis[];
  readonly decisions: readonly PersistedDecision[];
  readonly financialObservations: readonly FinancialOutcomeObservation[];
  readonly outcomes: readonly Outcome[];
  readonly learningRecords: readonly LearningRecord[];
  readonly knowledge: readonly Knowledge[];
}

export interface ReportLineage {
  /** Leituras da IA desta execução, a mais recente primeiro. */
  readonly diagnoses: readonly PersistedExecutiveDiagnosis[];
  readonly decisions: readonly ReportDecisionLink[];
  /** Mission 211 — todas as observações válidas da empresa (posteriores à base, com períodos). */
  readonly financialObservations: readonly FinancialOutcomeObservation[];
  /** Observações financeiras ancoradas na execução deste relatório. */
  readonly observationsInPeriod: readonly FinancialOutcomeObservation[];
  /** Decisões (de qualquer período) cujos resultados foram observados neste período. */
  readonly observedDecisions: readonly PersistedDecision[];
  readonly knowledge: readonly Knowledge[];
}

export function selectReportLineage(inputs: ReportLineageInputs): ReportLineage {
  const { current } = inputs;
  const companyId = current.companyId;

  const diagnoses = inputs.diagnoses
    .filter((diagnosis) => diagnosis.companyId === companyId && diagnosis.executionId === current.executionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const diagnosisIds = new Set(diagnoses.map((diagnosis) => diagnosis.id));

  const companyDecisions = inputs.decisions.filter(
    (persisted) => persisted.companyId === companyId && persisted.decision.companyId === companyId
  );

  const decisions: ReportDecisionLink[] = [];
  for (const persisted of companyDecisions) {
    const diagnosisId = persisted.diagnosisId ?? persisted.decision.basedOnDiagnosisId;
    if (diagnosisId && diagnosisIds.has(diagnosisId)) {
      decisions.push({ decision: persisted, origin: { kind: "diagnosis", diagnosisId } });
      continue;
    }
    const scenario = readScenarioDecisionContext(persisted.decision.supportingData);
    if (scenario && scenarioContextMatchesExecution(scenario, current)) {
      decisions.push({ decision: persisted, origin: { kind: "scenario", scenario } });
    }
  }
  decisions.sort((a, b) => a.decision.createdAt.localeCompare(b.decision.createdAt));

  const financialObservations = keepPosteriorObservations(
    inputs.financialObservations.filter((observation) => observation.companyId === companyId),
    inputs.history.filter((execution) => execution.companyId === companyId).map(positionedExecutionOf)
  );
  const observationsInPeriod = financialObservations.filter(
    (observation) => observation.window.observationExecutionId === current.executionId
  );
  const observedDecisionIds = new Set(observationsInPeriod.map((observation) => observation.decisionId));
  const observedDecisions = companyDecisions.filter((persisted) => observedDecisionIds.has(persisted.id));

  const relatedDecisionIds = new Set([...decisions.map((link) => link.decision.id), ...observedDecisionIds]);
  const relatedLearningIds = new Set(
    inputs.learningRecords
      .filter(
        (record) => record.companyId === companyId && record.decisions.some((decisionId) => relatedDecisionIds.has(decisionId))
      )
      .map((record) => record.id)
  );
  const relatedOutcomeIds = new Set(
    inputs.outcomes
      .filter((outcome) => outcome.companyId === companyId && relatedDecisionIds.has(outcome.decisionId))
      .map((outcome) => outcome.id)
  );
  const knowledge = inputs.knowledge.filter(
    (record) =>
      record.companyId === companyId &&
      ((record.derivedFromLearningRecordIds ?? []).some((id) => relatedLearningIds.has(id)) ||
        record.derivedFromOutcomeIds.some((id) => relatedOutcomeIds.has(id)))
  );

  return { diagnoses, decisions, financialObservations, observationsInPeriod, observedDecisions, knowledge };
}
