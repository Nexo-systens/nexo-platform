import type { EngineStatus } from "@/efos/types";
import type { PipelineStage } from "./PipelineStage";

/**
 * Informações comuns de uma execução do pipeline — nunca o resultado
 * de negócio produzido pelos Engines (isso pertence a
 * `PipelineResult`/aos próprios Engines). `status` reaproveita
 * `EngineStatus` (`efos/types/common.ts`) — vocabulário já existente
 * no EFOS Core, nunca antes consumido por nenhum Engine (identificado
 * na auditoria da Mission 016), agora com seu primeiro consumidor real
 * — evita duplicar um vocabulário de status que já existia
 * (`docs/DECISIONS.md`, mesmo princípio de D-009/D-011/D-014: revisar
 * enums existentes antes de criar um novo).
 */
export interface PipelineMetadata {
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly duration?: number;
  readonly currentStage?: PipelineStage;
  readonly completedStages: readonly PipelineStage[];
  readonly failedStage?: PipelineStage;
  readonly status: EngineStatus;
}
