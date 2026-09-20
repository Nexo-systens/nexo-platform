import { Badge } from "@/components/ui/badge";
import type { HistoryExecutionSummary } from "@/app/api/efos/_shared/HistoryResponse";
import { formatExecutedAt } from "@/modules/history/lib/formatExecutedAt";

interface ExecutionHistoryListProps {
  executions: readonly HistoryExecutionSummary[];
  currentExecutionId?: string;
}

// Lista de execucoes ja persistidas de uma empresa — apenas data e
// indicacao de "Atual" (Mission 087). Nenhum calculo, nenhuma
// interpretacao — `executions` ja vem ordenada da mais recente para a
// mais antiga (`HistoryResponse.availableExecutions`).
export function ExecutionHistoryList({
  executions,
  currentExecutionId,
}: ExecutionHistoryListProps) {
  return (
    <ul className="flex flex-col gap-1.5">
      {executions.map((execution) => (
        <li
          key={execution.executionId}
          className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
        >
          <span className="text-foreground">
            {formatExecutedAt(execution.executedAt)}
          </span>
          {execution.executionId === currentExecutionId && (
            <Badge variant="secondary">Atual</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
