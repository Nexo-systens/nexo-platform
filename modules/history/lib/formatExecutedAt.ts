/**
 * Formata `executedAt` (ISO 8601, `HistoricalExecution.executedAt`/
 * `metadata.startedAt`, D-045) para exibição — apenas formatação de
 * texto, nenhuma interpretação/cálculo de data. `Intl.DateTimeFormat`
 * já disponível no runtime, nenhuma biblioteca nova.
 */
export function formatExecutedAt(executedAt: string): string {
  return new Date(executedAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
