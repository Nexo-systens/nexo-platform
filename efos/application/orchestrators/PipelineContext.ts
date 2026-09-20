/**
 * Contexto mínimo necessário para uma execução do pipeline. Mesmo
 * papel de `EfosEngineContext` (efos/interfaces/engine.ts) para um
 * Engine individual, agora no nível do Orchestrator — identifica a
 * empresa e a execução, nunca carrega dado de negócio nem
 * infraestrutura (sem conexão de banco, sem cliente HTTP).
 */
export interface PipelineContext {
  readonly companyId: string;
  readonly requestId: string;
  readonly executionId: string;
  readonly timestamp: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
