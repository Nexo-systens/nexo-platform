import type { ExecutionSnapshot } from "../persistence";
import type { ExecutiveReport } from "../report";

/**
 * Visão histórica mínima de uma execução já persistida (Mission 085 —
 * Historical Financial Intelligence / Multi-Period Execution). Nunca
 * uma segunda fonte de verdade — `snapshot` preserva a referência
 * completa e original ao `ExecutionSnapshot` (nenhum campo copiado
 * além dos três extraídos abaixo, todos já existentes dentro dele);
 * existe apenas para dar a `HistoricalExecutionService` um formato
 * direto de ordenar/comparar sem que cada consumidor precise navegar
 * `snapshot.execution.pipelineContext`/`snapshot.metadata.startedAt`
 * repetidamente.
 *
 * `executedAt` é lido de `snapshot.metadata.startedAt`
 * (`PipelineMetadata`, Mission 020B) — o único campo temporal oficial
 * de uma execução (quando o `EFOSPipelineRuntime` de fato começou a
 * rodar), nunca uma data nova inventada. `executionId`/`companyId` são
 * lidos de `snapshot.execution.pipelineContext` — os mesmos
 * identificadores oficiais já usados por `SupabaseExecutionRepository`
 * para as colunas físicas `execution_id`/`company_id` (Mission 068).
 */
export interface HistoricalExecution {
  readonly executionId: string;
  readonly companyId: string;
  readonly executedAt: string;
  readonly report?: ExecutiveReport;
  readonly snapshot: ExecutionSnapshot;
}
