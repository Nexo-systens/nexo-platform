import type { Result } from "@/efos/application/shared";
import { compareExecutions, executionPeriodOf, type HistoricalExecution } from "@/efos/application/history";
import type { DecisionExecutionState } from "@/efos/application/decision-execution";

import {
  type FinancialMetricObservation,
  type FinancialOutcomeObservation,
  type ObservationWindow,
} from "./FinancialOutcomeObservation";
import { validateFinancialOutcomeObservation } from "./FinancialOutcomeObservation.validator";
import { classifyObservationTiming } from "./observationTiming";

export interface FinancialObservationInputDecision {
  readonly id: string;
  readonly companyId: string;
  readonly createdAt: string;
}

/**
 * Mission 211 (D-136) — a base financeira da decisão, resolvida por
 * LINHAGEM pelo chamador (`modules/decisions/lib/resolveDecisionFinancialBase.ts`):
 * a execução do diagnóstico que originou a decisão, ou a execução cuja
 * verdade financeira o cenário confirmado usou. Uma decisão manual sem
 * diagnóstico e sem cenário não tem base — nunca "a última análise".
 */
export type FinancialObservationBase =
  | { readonly outcome: "anchored"; readonly execution: HistoricalExecution }
  | { readonly outcome: "unanchored" }
  | { readonly outcome: "unavailable" };

/**
 * Mission 211 (D-136) — a verdade financeira observada: a verdade atual
 * canônica (`resolveCurrentFinancialExecution()`, falha fechada com versões
 * divergentes), resolvida pelo chamador. Nunca "a última execução gravada".
 */
export type FinancialObservationTarget =
  | { readonly outcome: "resolved"; readonly execution: HistoricalExecution }
  | { readonly outcome: "no-history" }
  | { readonly outcome: "ambiguous" };

export type BuildFinancialOutcomeObservationError =
  | { readonly code: "EXECUTION_NOT_COMPLETED"; readonly message: string }
  | { readonly code: "NO_FINANCIAL_BASE"; readonly message: string }
  | { readonly code: "NO_COMPARABLE_FINANCIAL_TRUTH"; readonly message: string }
  | { readonly code: "NOT_AFTER_DECISION_BASE"; readonly message: string }
  | { readonly code: "INVALID_OBSERVATION"; readonly errors: readonly string[] };

type MessageErrorCode = Exclude<BuildFinancialOutcomeObservationError["code"], "INVALID_OBSERVATION">;

function failure(code: MessageErrorCode, message: string): { readonly success: false; readonly error: BuildFinancialOutcomeObservationError } {
  return { success: false, error: { code, message } };
}

/**
 * `buildFinancialOutcomeObservation()` (Mission 139, revisada pela Mission
 * 211 — D-136) — único ponto de composição autorizado a transformar
 * `Decision`+`DecisionExecutionEvent`s (Mission 138) numa
 * `FinancialOutcomeObservation`. Função pura — nunca acessa banco, nunca
 * gera `randomUUID()`/`Date.now()` internamente.
 *
 * **Janela (D-136, revisa a de D-071).**
 * - `baseline` = a base financeira da DECISÃO, por linhagem — não mais "a
 *   execução mais recente com `executedAt <= decision.createdAt`", que podia
 *   ser uma reanálise atrasada de outro período ou uma análise que a decisão
 *   nunca viu. Sem base, não há observação financeira (`NO_FINANCIAL_BASE`);
 *   o resultado humano (`Outcome`) continua podendo ser registrado.
 * - `observation` = a verdade financeira atual canônica — não mais "a última
 *   execução gravada", que podia ser uma reanálise do mesmo período ou um
 *   período anterior processado tarde.
 * - **Invariante temporal**: o período observado precisa ser ESTRITAMENTE
 *   posterior ao período da base (`classifyObservationTiming`, sobre
 *   `periodPrecedes`). Mesmo período, anterior ou sobreposto:
 *   `NOT_AFTER_DECISION_BASE`. Lacuna de períodos é aceita.
 * - Mantido de D-071: execução `COMPLETED` e verdade observada processada
 *   depois da conclusão (`executedAt >= completedAt`) — "a Financial Truth
 *   foi atualizada desde então". É uma pré-condição de frescor do Outcome,
 *   nunca a regra de ordem temporal, que é sempre por período.
 *
 * **Reaproveita `compareExecutions()` inteiramente** (D-045/D-046) — nenhum
 * cálculo de indicador é duplicado aqui.
 */
export function buildFinancialOutcomeObservation(
  decision: FinancialObservationInputDecision,
  executionState: DecisionExecutionState,
  base: FinancialObservationBase,
  target: FinancialObservationTarget,
  humanOutcomeId: string | undefined,
  computedBy: string,
  id: string,
  computedAt: string
): Result<FinancialOutcomeObservation, BuildFinancialOutcomeObservationError> {
  if (executionState.status !== "COMPLETED" || !executionState.completedAt) {
    return failure(
      "EXECUTION_NOT_COMPLETED",
      "A execução desta Decision ainda não foi concluída (status COMPLETED) — nenhuma observação financeira final pode ser construída automaticamente enquanto isso não acontecer."
    );
  }

  if (base.outcome === "unanchored") {
    return failure(
      "NO_FINANCIAL_BASE",
      "Esta decisão não tem base financeira explícita — não nasceu de uma leitura da IA nem de um cenário. Sem base, o efeito nos números não é medido contra um período escolhido por conveniência. O resultado observado pela equipe continua podendo ser registrado."
    );
  }
  if (base.outcome === "unavailable" || base.execution.companyId !== decision.companyId) {
    return failure("NO_FINANCIAL_BASE", "A análise em que esta decisão se baseou não está disponível — o efeito nos números não pode ser medido sem ela.");
  }

  if (target.outcome === "no-history") {
    return failure("NO_COMPARABLE_FINANCIAL_TRUTH", "Nenhuma análise disponível para observar o resultado desta decisão.");
  }
  if (target.outcome === "ambiguous" || target.execution.companyId !== decision.companyId) {
    return failure(
      "NO_COMPARABLE_FINANCIAL_TRUTH",
      "A verdade financeira atual desta empresa não pôde ser estabelecida sem ambiguidade — nenhum resultado pode ser observado com segurança."
    );
  }

  const baseline = base.execution;
  const observation = target.execution;
  const baselinePeriod = executionPeriodOf(baseline);
  const observationPeriod = executionPeriodOf(observation);
  const timing = classifyObservationTiming(baselinePeriod, observationPeriod);

  if (timing === "undetermined") {
    return failure(
      "NO_COMPARABLE_FINANCIAL_TRUTH",
      "O período da base ou da análise mais recente não pôde ser determinado — nenhum resultado é observado sem período."
    );
  }
  if (timing === "same-period") {
    return failure(
      "NOT_AFTER_DECISION_BASE",
      "A análise mais recente é do mesmo período em que a decisão foi tomada — uma reanálise não é resultado posterior. O efeito nos números aparece quando um período seguinte for analisado."
    );
  }
  if (timing === "not-after-base") {
    return failure(
      "NOT_AFTER_DECISION_BASE",
      "A análise mais recente não é de um período posterior ao período em que a decisão foi tomada — nenhum resultado posterior existe ainda."
    );
  }

  if (Date.parse(observation.executedAt) < Date.parse(executionState.completedAt)) {
    return failure(
      "NO_COMPARABLE_FINANCIAL_TRUTH",
      "Nenhuma análise foi processada desde a conclusão da execução desta decisão — a verdade financeira ainda não foi atualizada desde então."
    );
  }

  const comparison = compareExecutions(baseline, observation);
  const comparableMetrics = comparison.metrics.filter(
    (m): m is typeof m & { direction: "increased" | "decreased" | "unchanged"; previousValue: number; currentValue: number; absoluteChange: number } =>
      (m.direction === "increased" || m.direction === "decreased" || m.direction === "unchanged") &&
      m.previousValue !== undefined &&
      m.currentValue !== undefined &&
      m.absoluteChange !== undefined
  );

  if (comparableMetrics.length === 0) {
    return {
      success: false,
      error: {
        code: "NO_COMPARABLE_FINANCIAL_TRUTH",
        message: "Nenhum indicador é numericamente comparável entre o baseline e a observação (todos ausentes, incompatíveis em unidade, ou indisponíveis nos dois períodos) — nenhuma observação financeira pode ser construída.",
      },
    };
  }

  const metrics: FinancialMetricObservation[] = comparableMetrics.map((m) => ({
    metricName: m.metricName,
    beforeValue: m.previousValue,
    afterValue: m.currentValue,
    absoluteChange: m.absoluteChange,
    percentageChange: m.previousValue === 0 ? undefined : (m.absoluteChange / m.previousValue) * 100,
    direction: m.direction,
  }));

  const window: ObservationWindow = {
    decisionId: decision.id,
    decisionCreatedAt: decision.createdAt,
    executionCompletedAt: executionState.completedAt,
    baselineExecutionId: baseline.executionId,
    baselineExecutedAt: baseline.executedAt,
    baselinePeriod,
    observationExecutionId: observation.executionId,
    observationExecutedAt: observation.executedAt,
    observationPeriod,
  };

  const built: FinancialOutcomeObservation = {
    id,
    decisionId: decision.id,
    companyId: decision.companyId,
    humanOutcomeId,
    computedBy,
    computedAt,
    classification: "TEMPORAL_ASSOCIATION",
    window,
    metrics,
  };

  const validation = validateFinancialOutcomeObservation(built);
  if (!validation.valid) {
    return { success: false, error: { code: "INVALID_OBSERVATION", errors: validation.errors } };
  }

  return { success: true, value: built };
}
