import type { ExecutionSnapshot } from "./ExecutionSnapshot";

/**
 * Port de persistência de uma execução completa do EFOS (Mission 027
 * — Execution Persistence Contracts). Contrato puro — nenhuma
 * implementação concreta nesta missão; a implementação real (ex.:
 * Supabase) pertence a uma futura camada de Infrastructure, fora do
 * EFOS Core (mesmo padrão *ports & adapters* já estabelecido por
 * `efos/application/ports/`, D-014).
 *
 * `save()` persiste um `ExecutionSnapshot` já montado — nunca
 * constrói um a partir de partes soltas; `findByExecutionId()`
 * recupera uma execução específica pelo identificador único
 * (`PipelineContext.executionId`, D-015); `findByCompany()` recupera
 * todas as execuções já persistidas de uma empresa. Nenhuma lógica de
 * negócio, nenhuma regra financeira, nenhum cache.
 */
export interface ExecutionRepository {
  save(snapshot: ExecutionSnapshot): Promise<void>;
  findByExecutionId(
    executionId: string
  ): Promise<ExecutionSnapshot | undefined>;
  findByCompany(companyId: string): Promise<readonly ExecutionSnapshot[]>;
}
