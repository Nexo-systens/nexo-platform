import {
  FINANCIAL_CORRELATION_CLASSIFICATIONS,
  type FinancialOutcomeObservation,
} from "./FinancialOutcomeObservation";

export interface FinancialOutcomeObservationValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function isNonEmptyString(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Valida um `FinancialOutcomeObservation` antes de persistir — mesma
 * disciplina de `validateOutcome()`/`validateDecisionExecutionEvent()`
 * (Mission 138): nunca valida o CONTEÚDO financeiro em si (isso já foi
 * calculado deterministicamente por `compareExecutions()`, D-045/
 * D-046, uma área fechada e não revisada por esta missão), apenas a
 * forma estrutural mínima e as invariantes que garantem "Correlation ≠
 * Causation" e "sem dado futuro vazando para o baseline".
 */
export function validateFinancialOutcomeObservation(
  observation: FinancialOutcomeObservation
): FinancialOutcomeObservationValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyString(observation.id)) errors.push("FinancialOutcomeObservation.id é obrigatório.");
  if (!isNonEmptyString(observation.decisionId)) errors.push("FinancialOutcomeObservation.decisionId é obrigatório.");
  if (!isNonEmptyString(observation.companyId)) errors.push("FinancialOutcomeObservation.companyId é obrigatório.");
  if (!isNonEmptyString(observation.computedBy)) {
    errors.push("FinancialOutcomeObservation.computedBy é obrigatório — nenhuma observação financeira pode ser anônima.");
  }
  if (!isNonEmptyString(observation.computedAt)) errors.push("FinancialOutcomeObservation.computedAt é obrigatório.");

  if (!FINANCIAL_CORRELATION_CLASSIFICATIONS.includes(observation.classification)) {
    errors.push(`classification desconhecida: "${observation.classification}".`);
  }

  const w = observation.window;
  if (!isNonEmptyString(w?.baselineExecutionId) || !isNonEmptyString(w?.observationExecutionId)) {
    errors.push("ObservationWindow precisa de baselineExecutionId e observationExecutionId, ambos rastreáveis a uma execução real.");
  }
  if (w && w.baselineExecutionId === w.observationExecutionId) {
    errors.push("baselineExecutionId e observationExecutionId nunca podem ser a mesma execução — uma observação exige 2 pontos no tempo distintos.");
  }
  if (w && Date.parse(w.baselineExecutedAt) >= Date.parse(w.observationExecutedAt)) {
    errors.push("baselineExecutedAt precisa ser estritamente anterior a observationExecutedAt — nenhum dado futuro pode ser tratado como baseline (Etapa 5.F).");
  }
  // decisionCreatedAt/executionCompletedAt são opcionais no tipo (só
  // presentes na construção, nunca persistidos — ver ObservationWindow)
  // — estas duas checagens só rodam quando de fato presentes; nunca
  // travam a validação de uma observação relida do banco.
  if (w && isNonEmptyString(w.decisionCreatedAt) && Date.parse(w.baselineExecutedAt) > Date.parse(w.decisionCreatedAt!)) {
    errors.push("baselineExecutedAt nunca pode ser posterior a decisionCreatedAt — o baseline representa a Financial Truth ANTES da decisão.");
  }
  if (w && isNonEmptyString(w.executionCompletedAt) && Date.parse(w.observationExecutedAt) < Date.parse(w.executionCompletedAt!)) {
    errors.push("observationExecutedAt nunca pode ser anterior a executionCompletedAt — a observação representa a Financial Truth DEPOIS da execução concluída.");
  }

  if (observation.metrics.length === 0) {
    errors.push("metrics não pode ser vazio — uma observação sem nenhuma métrica numericamente comparável não deveria ter sido construída (deveria ter sido NO_COMPARABLE_FINANCIAL_TRUTH).");
  }
  observation.metrics.forEach((metric, index) => {
    if (!isNonEmptyString(metric.metricName)) errors.push(`metrics[${index}] sem metricName.`);
    if (!["increased", "decreased", "unchanged"].includes(metric.direction)) {
      errors.push(`metrics[${index}] tem direction "${metric.direction}" — apenas increased/decreased/unchanged são numericamente comparáveis, o resto deveria ter sido filtrado antes de chegar aqui.`);
    }
  });

  return { valid: errors.length === 0, errors };
}
