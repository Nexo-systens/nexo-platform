import type { HistoryExecutionSummary } from "@/app/api/efos/_shared/HistoryResponse";
import { formatExecutedAt } from "./formatExecutedAt";

/**
 * Resolve o rótulo executivo de uma execução a partir do seu
 * `executionId` (Mission 099, Etapa 5/10 — Correção C). Existe porque
 * `Select.Value` (`@base-ui/react/select`) só sabe o rótulo de um
 * `value` se conseguir casar com um `SelectItem` já registrado no
 * store interno — registro que só acontece quando o item monta. Como
 * `SelectContent` (`components/ui/select.tsx`) fica dentro de um
 * `Portal`/`Popup` fechado por padrão, o item correspondente pode
 * nunca ter montado antes do valor ser selecionado programaticamente
 * (`HistoricalAnalysisPanel`, ao carregar o histórico já define
 * `selectedPreviousId` para a execução anterior) — sem rótulo
 * encontrado, `Select.Value` cai no fallback de
 * `@base-ui/react/internals/resolveValueLabel.ts`
 * (`stringifyAsLabel`/`serializeValue`), que devolve o `value` bruto —
 * o UUID técnico da execução, exatamente o vazamento observado na
 * Mission 099. Usar esta função como `children` de `SelectValue`
 * (função explícita, não a resolução implícita do Base UI) elimina a
 * dependência de timing de registro do item — nunca depende de o
 * dropdown já ter sido aberto.
 *
 * Nunca devolve o `executionId` bruto — mesmo para um id não
 * encontrado na lista (`availableExecutions` desatualizada/vazia),
 * devolve um texto executivo genérico, nunca o UUID.
 */
export function resolveExecutionLabel(
  executionId: string | undefined,
  executions: readonly HistoryExecutionSummary[]
): string {
  if (executionId === undefined) {
    return "Comparar com...";
  }

  const match = executions.find(
    (execution) => execution.executionId === executionId
  );

  return match ? formatExecutedAt(match.executedAt) : "Execução não encontrada";
}
