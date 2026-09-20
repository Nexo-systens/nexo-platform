import type { PipelineContext } from "./PipelineContext";
import type { PipelineResult } from "./PipelineResult";

/**
 * Contrato do EFOS Pipeline Orchestrator — a peça responsável por
 * encadear a execução dos 10 Engines da cadeia principal
 * (`EFOS_PIPELINE`, efos/types/pipeline.ts), na ordem oficial (D-006,
 * D-012). Nesta missão é apenas um contrato: nenhum método tem
 * implementação, nenhum Engine é executado, nenhuma lógica de
 * sequenciamento existe ainda. A implementação concreta pertence à
 * Mission 019.
 *
 * `execute()` recebe um `PipelineContext` e retorna um
 * `PipelineResult` — apenas metadados da execução, nunca os agregados
 * de negócio produzidos pelos Engines (ver README.md, "Fluxo completo
 * da execução").
 */
export interface EFOSPipelineOrchestrator {
  execute(context: PipelineContext): Promise<PipelineResult>;
}
