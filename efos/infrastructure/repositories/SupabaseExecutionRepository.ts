import type {
  ExecutionRepository,
  ExecutionSnapshot,
} from "@/efos/application/persistence";
import type { PersistenceClient } from "../shared";

/**
 * Primeira implementação concreta de `ExecutionRepository`
 * (`efos/application/persistence/ExecutionRepository.ts`, Mission 027)
 * na Infrastructure Layer (Mission 030 — Supabase Execution
 * Repository; construtor revisado na Mission 032 — Supabase
 * Persistence Client; `save()` implementado na Mission 033 —
 * Execution Snapshot Persistence; `findByExecutionId()` implementado
 * na Mission 034 — Find Execution by ID; `findByCompany()`
 * implementado na Mission 035 — Find Executions by Company). Todos os
 * métodos de `ExecutionRepository` estão implementados a partir desta
 * missão.
 *
 * Recebe `persistenceClient: PersistenceClient`
 * (`efos/infrastructure/shared/PersistenceClient.ts`, Mission 031) via
 * construtor em vez de `supabaseClient: unknown` — nunca instancia o
 * client, nunca conecta, nunca importa o SDK do Supabase (`@supabase/*`)
 * diretamente; quem decide o mecanismo real por trás de
 * `PersistenceClient` é o Composition Root
 * (`efos/application/composition/DefaultEFOSContainer.ts`), não esta
 * classe.
 *
 * Desde a Mission 068 (Supabase Execution Repository Alignment,
 * corrigindo a incompatibilidade documentada em D-039, Mission 067):
 * `public.executions` (`supabase/migrations/20260802131410_executions_persistence.sql`,
 * D-027) exige duas colunas físicas próprias — `execution_id`/
 * `company_id` (ambas `NOT NULL`) — que não existem como chave de
 * nível superior em `ExecutionSnapshot` (só `metadata`/`execution`/
 * `report`); esses dois valores sempre existiram, por inteiro, dentro
 * de `snapshot.execution.pipelineContext` (`executionId`/`companyId`,
 * `efos/application/orchestrators/PipelineContext.ts`). Esta classe —
 * o adaptador entre o modelo da Application Layer e o modelo físico
 * do banco — passou a extrair esses dois valores e montar
 * explicitamente o payload de `insert()`/os filtros de `select()` com
 * os nomes de coluna físicos reais (`execution_id`/`company_id`,
 * snake_case), em vez de repassar `ExecutionSnapshot`/`executionId`/
 * `companyId` (camelCase) diretamente. `ExecutionSnapshot` em si, seu
 * contrato conceitual, e `ExecutionRepository` (assinatura de
 * `save`/`findByExecutionId`/`findByCompany`) não mudaram — apenas a
 * tradução feita aqui dentro.
 */
export class SupabaseExecutionRepository implements ExecutionRepository {
  constructor(private readonly persistenceClient: PersistenceClient) {}

  async save(snapshot: ExecutionSnapshot): Promise<void> {
    // `executionId`/`companyId` já existem, por inteiro, dentro de
    // `snapshot.execution.pipelineContext` (Mission 020B) — nenhum
    // identificador novo é criado aqui, apenas extraído para os
    // campos físicos exigidos pela tabela (`execution_id`/
    // `company_id`, ambos NOT NULL). `metadata`/`execution`/`report`
    // continuam sendo os mesmos objetos recebidos, sem alteração de
    // conteúdo — apenas reorganizados num payload plano que
    // corresponde às colunas reais de `public.executions`.
    const result = await this.persistenceClient.insert({
      collection: "executions",
      data: {
        execution_id: snapshot.execution.pipelineContext.executionId,
        company_id: snapshot.execution.pipelineContext.companyId,
        metadata: snapshot.metadata,
        execution: snapshot.execution,
        report: snapshot.report,
      },
    });

    if (!result.success) {
      throw new Error(result.error);
    }
  }

  async findByExecutionId(
    executionId: string
  ): Promise<ExecutionSnapshot | undefined> {
    const result = await this.persistenceClient.select({
      collection: "executions",
      filters: { execution_id: executionId },
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    // `data` é `unknown` em `PersistenceResult` (Mission 031, D-025).
    // Cada linha devolvida por `select("*")` tem colunas físicas
    // extras (`id`, `execution_id`, `company_id`, `created_at`) além
    // das três que `ExecutionSnapshot` declara (`metadata`/
    // `execution`/`report`) — mas essas três existem, com os mesmos
    // nomes e valores, entre as colunas reais da tabela, então a
    // conversão de tipo abaixo não transforma nem inventa nenhum
    // campo; apenas ignora as colunas físicas que `ExecutionSnapshot`
    // não expõe.
    const rows = result.data as
      | readonly ExecutionSnapshot[]
      | undefined;

    if (!rows || rows.length === 0) {
      return undefined;
    }

    return rows[0];
  }

  async findByCompany(
    companyId: string
  ): Promise<readonly ExecutionSnapshot[]> {
    const result = await this.persistenceClient.select({
      collection: "executions",
      filters: { company_id: companyId },
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    // Mesma conversão de tipo de `findByExecutionId()` — ver comentário
    // acima; os registros em si não são transformados.
    const rows = result.data as readonly ExecutionSnapshot[] | undefined;

    return rows ?? [];
  }
}
