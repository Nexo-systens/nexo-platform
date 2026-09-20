import type { ApplicationResult } from "../contracts";
import type { PipelineExecution } from "./PipelineExecution";
import type { PipelineMetadata } from "./PipelineMetadata";

/**
 * Contrato de saída de uma execução do pipeline — `ApplicationResult`
 * (efos/application/contracts/ApplicationResult.ts) especializado,
 * sem criar um novo envelope (Mission 020B — Pipeline Execution
 * State, revisão de D-015). No caminho de sucesso, carrega
 * `PipelineMetadata` (quando começou/terminou, estágio atual,
 * estágios concluídos, status) **e** `PipelineExecution` (a saída de
 * cada estágio já executado, armazenada tal como produzida pelos
 * Engines — Mission 020B). No caminho de falha (`success: false`),
 * `Result` (`efos/application/shared/Result.ts`) só carrega `error` —
 * nenhuma execução parcial é exposta por este contrato.
 */
export type PipelineResult = ApplicationResult<{
  readonly metadata: PipelineMetadata;
  readonly execution: PipelineExecution;
}>;
