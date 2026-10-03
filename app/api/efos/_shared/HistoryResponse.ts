import {
  compareExecutions,
  executionPeriodOf,
  resolvePeriodVersion,
  resolvePreviousPeriodComparison,
  selectLatestPeriodExecution,
  type ExecutionComparison,
  type HistoricalExecution,
  type PreviousPeriodState,
} from "@/efos/application/history";
import { periodsEqual } from "@/efos/application/scenario-simulation/periodsEqual";

/**
 * Resumo mínimo de uma execução para exibição — apenas os dois campos
 * que a UI precisa para listar/selecionar (Mission 087 — NEXO
 * Historical & Comparative Intelligence Experience). Nunca expõe
 * `ExecutionSnapshot`/`ExecutiveReport` inteiros — o contrato de
 * apresentação é deliberadamente menor que o contrato interno do EFOS
 * (D-043/D-045: `ExecutiveReport`/`ExecutionSnapshot` continuam a
 * fonte de verdade, este tipo é só uma projeção para a UI).
 */
export interface HistoryExecutionSummary {
  readonly executionId: string;
  readonly executedAt: string;
  /**
   * Mission 204 — período analisado (o dos indicadores da própria
   * execução), para rotular o histórico por "agosto de 2026" em vez da
   * data de execução. Ausente quando a execução não calculou indicadores.
   */
  readonly period?: { readonly startDate: string; readonly endDate: string };
  /** Mission 209 — o mesmo período foi analisado de novo depois desta execução (versão anterior, D-133). */
  readonly earlierVersion?: boolean;
}

/**
 * Contrato de apresentação da rota `GET /api/efos/history/[companyId]`
 * (Mission 087). `currentExecution`/`previousExecution` ausentes
 * significam, respectivamente, "nenhuma execução" e "menos de duas
 * execuções, sem período anterior disponível" — nunca inventados.
 * `comparison` (`ExecutionComparison`, Mission 085/086, D-045/D-046) é
 * repassado exatamente como `compareExecutions()` o produz — nenhuma
 * transformação, nenhum recálculo.
 */
export interface HistoryResponse {
  readonly companyId: string;
  readonly currentExecution?: HistoryExecutionSummary;
  readonly previousExecution?: HistoryExecutionSummary;
  readonly availableExecutions: readonly HistoryExecutionSummary[];
  readonly comparison?: ExecutionComparison;
  /**
   * Mission 209 (D-134) — estado do período anterior canônico da execução
   * atual. Sem seleção explícita, `comparison` só existe quando é `resolved`.
   */
  readonly previousPeriodState?: PreviousPeriodState;
  /** De onde veio `previousExecution`: o período anterior canônico ou a escolha do usuário. */
  readonly comparisonBasis?: "previous-period" | "selected";
  /** A execução escolhida é outra versão do MESMO período: diferença entre versões, não variação no tempo. */
  readonly samePeriod?: boolean;
}

function toSummary(execution: HistoricalExecution, history: readonly HistoricalExecution[] = []): HistoryExecutionSummary {
  const indicators = execution.report?.sections.find((section) => section.type === "indicators");
  const period = indicators?.type === "indicators" ? indicators.indicators.indicators[0]?.period : undefined;
  const earlierVersion = resolvePeriodVersion(history, execution).state === "earlier";
  return {
    executionId: execution.executionId,
    executedAt: execution.executedAt,
    ...(period ? { period: { startDate: period.startDate, endDate: period.endDate } } : {}),
    ...(earlierVersion ? { earlierVersion } : {}),
  };
}

/**
 * Constrói o `HistoryResponse` a partir do histórico já ordenado
 * (`HistoricalExecutionService.getHistory()`, ordem crescente —
 * mais antiga primeiro, D-045) e, opcionalmente, de um
 * `previousExecutionId` explicitamente selecionado pelo usuário
 * (Mission 087, "seleção de períodos"). Função pura — nenhum acesso a
 * Repository/banco, nenhuma transformação de valor.
 *
 * Regras (Mission 209, D-134 — revisa a política padrão de D-047):
 * - histórico vazio → `currentExecution`/`previousExecution`/
 *   `comparison` todos ausentes, `availableExecutions: []`;
 * - `currentExecution` é a versão mais recente do período mais recente
 *   (`selectLatestPeriodExecution`), não a última execução — reanalisar
 *   julho depois de agosto não faz de julho a análise "atual";
 * - sem seleção explícita, `previousExecution`/`comparison` vêm do
 *   período anterior canônico (`resolvePreviousPeriodComparison`); sem
 *   período anterior comparável ou com histórico ambíguo, os dois ficam
 *   ausentes e `previousPeriodState` diz por quê — nunca a execução
 *   imediatamente anterior, que pode ser uma reanálise do mesmo mês;
 * - seleção explícita (`previousExecutionId`) continua permitida para
 *   qualquer outra execução (D-047); quando ela é do mesmo período,
 *   `samePeriod` marca a comparação como diferença entre versões;
 * - `previousExecutionId` igual ao da execução atual, ou que não pertence
 *   ao histórico, é ignorado — nunca compara uma execução consigo mesma.
 *
 * `availableExecutions` é devolvida da mais recente para a mais
 * antiga (ordem invertida em relação a `getHistory()`) — ordem mais
 * natural para uma lista de histórico/seletor na UI.
 */
export function buildHistoryResponse(
  companyId: string,
  history: readonly HistoricalExecution[],
  previousExecutionId?: string
): HistoryResponse {
  const availableExecutions = [...history].reverse().map((execution) => toSummary(execution, history));

  if (history.length === 0) {
    return { companyId, availableExecutions };
  }

  const current = selectLatestPeriodExecution(history) ?? history[history.length - 1];
  const canonical = resolvePreviousPeriodComparison(history, current);

  const selected =
    previousExecutionId !== undefined && previousExecutionId !== current.executionId
      ? history.find((execution) => execution.executionId === previousExecutionId)
      : undefined;

  if (selected) {
    const currentPeriod = executionPeriodOf(current);
    const selectedPeriod = executionPeriodOf(selected);
    return {
      companyId,
      currentExecution: toSummary(current),
      previousExecution: toSummary(selected),
      availableExecutions,
      comparison: compareExecutions(selected, current),
      previousPeriodState: canonical.outcome,
      comparisonBasis: "selected",
      samePeriod: currentPeriod !== undefined && selectedPeriod !== undefined && periodsEqual(currentPeriod, selectedPeriod),
    };
  }

  if (canonical.outcome !== "resolved") {
    return {
      companyId,
      currentExecution: toSummary(current),
      availableExecutions,
      previousPeriodState: canonical.outcome,
    };
  }

  return {
    companyId,
    currentExecution: toSummary(current),
    previousExecution: toSummary(canonical.baseline),
    availableExecutions,
    comparison: canonical.comparison,
    previousPeriodState: "resolved",
    comparisonBasis: "previous-period",
    samePeriod: false,
  };
}
