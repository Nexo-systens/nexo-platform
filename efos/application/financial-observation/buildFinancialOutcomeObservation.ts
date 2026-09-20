import type { Period } from "@/efos/domain";
import type { Result } from "@/efos/application/shared";
import { compareExecutions, type HistoricalExecution } from "@/efos/application/history";
import type { DecisionExecutionState } from "@/efos/application/decision-execution";

import {
  type FinancialMetricObservation,
  type FinancialOutcomeObservation,
  type ObservationWindow,
} from "./FinancialOutcomeObservation";
import { validateFinancialOutcomeObservation } from "./FinancialOutcomeObservation.validator";

export interface FinancialObservationInputDecision {
  readonly id: string;
  readonly companyId: string;
  readonly createdAt: string;
}

export type BuildFinancialOutcomeObservationError =
  | { readonly code: "EXECUTION_NOT_COMPLETED"; readonly message: string }
  | { readonly code: "NO_COMPARABLE_FINANCIAL_TRUTH"; readonly message: string }
  | { readonly code: "INVALID_OBSERVATION"; readonly errors: readonly string[] };

/**
 * Extrai o `Period` do primeiro `Indicator` disponível na seção
 * `"indicators"` de um `HistoricalExecution` — todos os indicadores de
 * uma mesma execução compartilham o mesmo período (derivado uma única
 * vez por `derivePeriod()` no Indicators Engine, nunca recalculado por
 * indicador), então o primeiro já representa o período da execução
 * inteira. `undefined` quando a execução não tem seção de indicadores
 * — nunca um período inventado.
 */
function extractExecutionPeriod(execution: HistoricalExecution): Period | undefined {
  const section = execution.report?.sections.find((s) => s.type === "indicators");
  if (!section || section.type !== "indicators") return undefined;
  return section.indicators.indicators[0]?.period;
}

/**
 * Seleciona, dentre um histórico já ordenado (`executedAt` crescente,
 * `HistoricalExecutionService.getHistory()`), a execução mais recente
 * que satisfaz um predicado — nunca a mais antiga, nunca uma escolha
 * arbitrária. Função auxiliar pura, sem acesso a rede/banco.
 */
function latestMatching(
  history: readonly HistoricalExecution[],
  predicate: (execution: HistoricalExecution) => boolean
): HistoricalExecution | undefined {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (predicate(history[i])) return history[i];
  }
  return undefined;
}

/**
 * `buildFinancialOutcomeObservation()` (Mission 139) — único ponto de
 * composição autorizado a transformar `Decision`+`DecisionExecutionEvent`s
 * (Mission 138)+histórico de execuções (`HistoricalExecutionService`,
 * D-045) numa `FinancialOutcomeObservation`. Função pura — nunca
 * acessa Repository/banco diretamente (quem chama já resolveu
 * `history`/`executionState` antes), nunca gera `randomUUID()`/
 * `Date.now()` internamente (`id`/`computedAt` sempre parâmetros).
 *
 * **Seleção determinística da janela de observação (Etapa 8/5.D)**:
 * `baseline` = a execução mais recente com `executedAt <=
 * decision.createdAt` (Financial Truth de quando a decisão foi
 * tomada); `observation` = a execução mais recente com `executedAt >=
 * executionState.completedAt` (Financial Truth mais atual disponível,
 * nunca antes da execução terminar). Ambas as condições, juntas,
 * impedem estruturalmente que dado futuro vaze para o baseline (Etapa
 * 5.F) — nunca uma checagem best-effort, é a própria forma da seleção.
 *
 * **Sem Financial Truth fabricada (Etapa 10)**: se a `Decision` não
 * tem execução `COMPLETED` (`efos/application/decision-execution`,
 * Mission 138), devolve `EXECUTION_NOT_COMPLETED` — nunca tenta
 * comparar de qualquer forma. Se nenhum baseline/observação existir,
 * ou se ambos apontarem para a mesma execução, ou se nenhuma métrica
 * sobrar após filtrar apenas direções numericamente comparáveis
 * (`increased`/`decreased`/`unchanged` — nunca `added`/`removed`/
 * `not-comparable`/`became-available`/`became-unavailable`/
 * `unavailable`, Etapa 18.G), devolve `NO_COMPARABLE_FINANCIAL_TRUTH`
 * — um resultado honesto, nunca um valor interpolado/estimado.
 *
 * **Reaproveita `compareExecutions()` inteiramente** (D-045/D-046,
 * `efos/application/history`) — nenhum cálculo de indicador é
 * duplicado ou reimplementado aqui; esta função só filtra/renomeia/
 * anota o resultado já produzido por uma área fechada e testada desde
 * a Mission 085/086.
 */
export function buildFinancialOutcomeObservation(
  decision: FinancialObservationInputDecision,
  executionState: DecisionExecutionState,
  history: readonly HistoricalExecution[],
  humanOutcomeId: string | undefined,
  computedBy: string,
  id: string,
  computedAt: string
): Result<FinancialOutcomeObservation, BuildFinancialOutcomeObservationError> {
  if (executionState.status !== "COMPLETED" || !executionState.completedAt) {
    return {
      success: false,
      error: {
        code: "EXECUTION_NOT_COMPLETED",
        message: "A execução desta Decision ainda não foi concluída (status COMPLETED) — nenhuma observação financeira final pode ser construída automaticamente enquanto isso não acontecer.",
      },
    };
  }

  const decisionCreatedAtMs = Date.parse(decision.createdAt);
  const executionCompletedAtMs = Date.parse(executionState.completedAt);

  const baseline = latestMatching(history, (e) => Date.parse(e.executedAt) <= decisionCreatedAtMs);
  const observation = latestMatching(history, (e) => Date.parse(e.executedAt) >= executionCompletedAtMs);

  if (!baseline || !observation || baseline.executionId === observation.executionId) {
    return {
      success: false,
      error: {
        code: "NO_COMPARABLE_FINANCIAL_TRUTH",
        message: !baseline
          ? "Nenhuma execução financeira existe em ou antes da data da decisão — sem baseline, nenhuma comparação é possível."
          : !observation
            ? "Nenhuma execução financeira existe em ou depois da conclusão da execução da decisão — a Financial Truth ainda não foi atualizada desde então."
            : "A execução mais recente disponível como baseline e como observação são a mesma — nenhum dado financeiro novo existe para comparar.",
      },
    };
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
    baselinePeriod: extractExecutionPeriod(baseline),
    observationExecutionId: observation.executionId,
    observationExecutedAt: observation.executedAt,
    observationPeriod: extractExecutionPeriod(observation),
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
