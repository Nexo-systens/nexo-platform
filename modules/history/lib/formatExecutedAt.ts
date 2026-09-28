/**
 * Formata `executedAt` (ISO 8601, `HistoricalExecution.executedAt`/
 * `metadata.startedAt`, D-045) para exibição — apenas formatação de
 * texto, nenhuma interpretação/cálculo de data. `Intl.DateTimeFormat`
 * já disponível no runtime, nenhuma biblioteca nova.
 */
import { formatPeriodLabel } from "@/modules/analysis/lib/period-label";

export function formatExecutedAt(executedAt: string): string {
  return new Date(executedAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Mission 204 — como uma execução é nomeada no histórico: pelo período
 * analisado ("agosto de 2026"); a data de execução vira detalhe.
 */
export function describeExecution(execution: {
  readonly executedAt: string;
  readonly period?: { readonly startDate: string; readonly endDate: string };
}): { readonly title: string; readonly short: string; readonly detail: string } {
  const executed = new Date(execution.executedAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!execution.period) {
    return {
      title: `Análise de ${formatExecutedAt(execution.executedAt)}`,
      short: formatExecutedAt(execution.executedAt),
      detail: `executada em ${executed}`,
    };
  }
  const label = formatPeriodLabel(execution.period);
  return { title: label.long, short: label.short, detail: `executada em ${executed}` };
}
