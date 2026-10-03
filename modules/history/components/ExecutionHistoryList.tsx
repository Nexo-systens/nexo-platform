import type { HistoryExecutionSummary } from "@/app/api/efos/_shared/HistoryResponse";
import { cn } from "@/lib/utils";
import { describeExecution } from "@/modules/history/lib/formatExecutedAt";

interface ExecutionHistoryListProps {
  executions: readonly HistoryExecutionSummary[];
  currentExecutionId?: string;
}

// Execuções já persistidas de uma empresa (Mission 087), da mais recente
// para a mais antiga. Mission 204 — cada análise é nomeada pelo período
// analisado ("ago/2026"), com a data de execução como detalhe; a atual
// fica destacada. Nenhum cálculo, nenhuma interpretação.
export function ExecutionHistoryList({ executions, currentExecutionId }: ExecutionHistoryListProps) {
  return (
    <ol aria-label="Análises desta empresa" className="flex flex-wrap gap-2">
      {executions.map((execution) => {
        const description = describeExecution(execution);
        const current = execution.executionId === currentExecutionId;
        return (
          <li
            key={execution.executionId}
            title={description.detail}
            className={cn(
              "flex items-baseline gap-2 rounded-full border px-3 py-1 text-[0.8125rem]",
              current ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border text-foreground-secondary"
            )}
          >
            <span className="num font-medium">{description.short}</span>
            {current && <span className="text-[0.6875rem]">atual</span>}
            {!current && execution.earlierVersion && <span className="text-[0.6875rem]">versão anterior</span>}
            <span className="sr-only">{description.detail}</span>
          </li>
        );
      })}
    </ol>
  );
}
