import type { ExecutionComparison } from "@/efos/application/history";
import type { HistoricalExecution } from "@/efos/application/history";
import { compareExecutions } from "@/efos/application/history";

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
}

function toSummary(execution: HistoricalExecution): HistoryExecutionSummary {
  return { executionId: execution.executionId, executedAt: execution.executedAt };
}

/**
 * Constrói o `HistoryResponse` a partir do histórico já ordenado
 * (`HistoricalExecutionService.getHistory()`, ordem crescente —
 * mais antiga primeiro, D-045) e, opcionalmente, de um
 * `previousExecutionId` explicitamente selecionado pelo usuário
 * (Mission 087, "seleção de períodos"). Função pura — nenhum acesso a
 * Repository/banco, nenhuma transformação de valor.
 *
 * Regras:
 * - histórico vazio → `currentExecution`/`previousExecution`/
 *   `comparison` todos ausentes, `availableExecutions: []`;
 * - uma execução → `currentExecution` presente, `previousExecution`/
 *   `comparison` ausentes (nenhum período anterior existe);
 * - duas ou mais execuções → `currentExecution` é sempre a mais
 *   recente; `previousExecution` é a execução selecionada
 *   (`previousExecutionId`, quando válida e diferente da atual) ou,
 *   por padrão, a execução imediatamente anterior à mais recente;
 *   `comparison` é `compareExecutions(previous, current)`, repassado
 *   sem alteração.
 * - `previousExecutionId` igual ao `executionId` da execução atual, ou
 *   que não pertence ao histórico, é ignorado silenciosamente —
 *   nunca compara uma execução consigo mesma, nunca lança.
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
  const availableExecutions = [...history].reverse().map(toSummary);

  if (history.length === 0) {
    return { companyId, availableExecutions };
  }

  const current = history[history.length - 1];

  if (history.length === 1) {
    return {
      companyId,
      currentExecution: toSummary(current),
      availableExecutions,
    };
  }

  const defaultPrevious = history[history.length - 2];
  const selectedPrevious =
    previousExecutionId !== undefined &&
    previousExecutionId !== current.executionId
      ? history.find((execution) => execution.executionId === previousExecutionId)
      : undefined;
  const previous = selectedPrevious ?? defaultPrevious;

  return {
    companyId,
    currentExecution: toSummary(current),
    previousExecution: toSummary(previous),
    availableExecutions,
    comparison: compareExecutions(previous, current),
  };
}
