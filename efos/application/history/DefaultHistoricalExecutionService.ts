import type { ExecutionRepository, ExecutionSnapshot } from "../persistence";

import type { HistoricalExecution } from "./HistoricalExecution";
import type { HistoricalExecutionService } from "./HistoricalExecutionService";

/**
 * Extrai um `HistoricalExecution` de um `ExecutionSnapshot` já
 * persistido — reagrupamento raso, nenhuma transformação. Exportada
 * pela Mission 173 (Production Executive Financial Context
 * Orchestrator) para reuso por `DefaultEFOSFacade`, que precisa
 * representar a execução ATUAL (ainda não persistida no momento da
 * composição, Mission 172 Fix/D-089) exatamente da mesma forma que
 * `getHistory()` representa cada execução já persistida — nunca uma
 * segunda implementação da mesma extração.
 */
export function toHistoricalExecution(snapshot: ExecutionSnapshot): HistoricalExecution {
  return {
    executionId: snapshot.execution.pipelineContext.executionId,
    companyId: snapshot.execution.pipelineContext.companyId,
    executedAt: snapshot.metadata.startedAt,
    report: snapshot.report,
    snapshot,
  };
}

/**
 * Ordena por `executedAt` crescente; em caso de empate (duas execuções
 * com o mesmo `startedAt`), desempata por `executionId` (comparação
 * lexicográfica de string) — critério único, determinístico, nunca
 * arbitrário. Não muta o array recebido.
 */
function orderByExecutedAt(
  executions: readonly HistoricalExecution[]
): readonly HistoricalExecution[] {
  return [...executions].sort((a, b) => {
    const dateDiff = a.executedAt.localeCompare(b.executedAt);
    if (dateDiff !== 0) return dateDiff;
    return a.executionId.localeCompare(b.executionId);
  });
}

/**
 * Primeira implementação concreta de `HistoricalExecutionService`
 * (Mission 085 — Historical Financial Intelligence / Multi-Period
 * Execution). Depende exclusivamente do contrato `ExecutionRepository`
 * (`efos/application/persistence/ExecutionRepository.ts`, Mission 027)
 * — injetado via construtor, nunca instanciado internamente — mesmo
 * padrão de inversão de dependência já usado por
 * `DefaultAnalysisService`/`DefaultEFOSFacade`.
 *
 * `getHistory()`: `ExecutionRepository.findByCompany(companyId)` →
 * mapeia cada `ExecutionSnapshot` para `HistoricalExecution`
 * (extração, nenhuma transformação de conteúdo) → ordena por
 * `executedAt` crescente. `findByCompany()` já filtra por `companyId`
 * (RLS na implementação real, `SupabaseExecutionRepository`) — este
 * serviço nunca mistura execuções de empresas diferentes porque nunca
 * combina o resultado de duas chamadas a `findByCompany()`.
 */
export class DefaultHistoricalExecutionService
  implements HistoricalExecutionService
{
  constructor(private readonly executionRepository: ExecutionRepository) {}

  async getHistory(companyId: string): Promise<readonly HistoricalExecution[]> {
    const snapshots = await this.executionRepository.findByCompany(companyId);
    const historicalExecutions = snapshots.map(toHistoricalExecution);
    return orderByExecutedAt(historicalExecutions);
  }
}
