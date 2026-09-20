import type { EngineId } from "@/efos/types";

/**
 * Contrato comum a todo Engine do EFOS Core. Apenas a forma que todo
 * engine devera seguir quando implementado — nenhum engine implementa
 * este contrato ainda (Missao "EFOS Core Skeleton").
 */
export interface EfosEngine<TInput = unknown, TOutput = unknown> {
  readonly id: EngineId;
  execute(input: TInput, context: EfosEngineContext): Promise<TOutput>;
}

/**
 * Contexto comum passado a todo engine em execucao — identifica a
 * empresa e a execucao do pipeline (ciclo de analise) em curso.
 * Ver docs/11_FINANCIAL_ENGINE.md (historico) e
 * docs/ARCHITECTURE_AUDIT.md para o conceito de pipeline_run.
 */
export interface EfosEngineContext {
  companyId: string;
  pipelineRunId: string;
}

/**
 * Envelope comum de resultado de um engine — todo engine, ao ser
 * implementado, deve poder reportar seu proprio status de execucao.
 */
export interface EfosEngineResult<TOutput = unknown> {
  status: "completed" | "failed";
  output?: TOutput;
  error?: string;
}
