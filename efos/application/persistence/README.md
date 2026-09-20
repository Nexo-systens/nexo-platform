# Application Layer — Execution Persistence

Status: **contratos criados, sem implementação (Mission 027 — Execution Persistence Contracts).** Representa oficialmente uma execução completa do EFOS que poderá ser salva futuramente. Esta missão não implementa banco, Supabase ou SQL — apenas os contratos da Application Layer.

## Responsabilidade

Definir a forma canônica de uma execução persistível (`ExecutionSnapshot`) e o Port que a persiste (`ExecutionRepository`) — nenhuma implementação concreta, nenhuma lógica de negócio.

## `ExecutionSnapshot`

Reaproveita por completo três tipos já oficiais — nenhum campo copiado, nenhuma estrutura duplicada:

```ts
interface ExecutionSnapshot extends PipelineExecutionSnapshot {
  readonly report?: ExecutiveReport;
}
```

- **`PipelineExecutionSnapshot`** (`efos/application/orchestrators/PipelineExecutionSnapshot.ts`, Mission 020B) — já combina `metadata: PipelineMetadata` + `execution: PipelineExecution`; `ExecutionSnapshot` estende essa interface em vez de redeclarar seus dois campos. Esta é a primeira missão a de fato consumir `PipelineExecutionSnapshot` — criado na Mission 020B como contrato preparado, "ainda não usado por nenhum componente".
- **`report?: ExecutiveReport`** (`efos/application/report/`, Mission 022) — o relatório executivo já produzido para essa execução, quando existir. Opcional porque `ReportService` é um passo separado de `AnalysisService` (D-019) — uma execução pode, em teoria, ser persistida antes de um relatório ter sido gerado. Entre as Missions 037 e 065, o único consumidor real (`DefaultAnalysisService`) sempre persistia com `report: undefined`, porque salvava antes de `ReportService` rodar — o campo existia no contrato, mas nunca era de fato preenchido. **Desde a Mission 066 (Executive Report Persistence, D-038)**, `DefaultEFOSFacade` (`efos/application/facade/`) passou a ser quem persiste, depois de `ReportService.generateReport()` retornar — `report` agora chega sempre preenchido nesse fluxo. O campo continua opcional no contrato (nenhuma alteração de tipo) porque nada nesta camada obriga um consumidor futuro a sempre ter um relatório disponível no momento de salvar.

## `ExecutionRepository`

Port de persistência — contrato puro, sem implementação:

```ts
interface ExecutionRepository {
  save(snapshot: ExecutionSnapshot): Promise<void>;
  findByExecutionId(executionId: string): Promise<ExecutionSnapshot | undefined>;
  findByCompany(companyId: string): Promise<readonly ExecutionSnapshot[]>;
}
```

Mesmo padrão *ports & adapters* já estabelecido por `efos/application/ports/` (D-014, Mission 017) — a implementação real (ex.: um `SupabaseExecutionRepository`) pertence a uma futura camada de Infrastructure, fora do EFOS Core. Deliberadamente colocado em `efos/application/persistence/`, não em `efos/application/ports/`, por instrução explícita da missão — um módulo próprio para os contratos de persistência de execução, junto de `ExecutionSnapshot`.

## Reutilização de tipos existentes

Nenhum tipo novo de dado de negócio foi criado — `ExecutionSnapshot` é inteiramente composto por referência a `PipelineExecutionSnapshot` (que já reaproveita `PipelineMetadata`+`PipelineExecution`) e `ExecutiveReport`. `ExecutionRepository` não introduz nenhum vocabulário de erro/status novo — `save()`/`findByExecutionId()`/`findByCompany()` são assinaturas puras de Port, mesmo padrão de `CompanyRepository`/`AnalysisRepository` (`efos/application/ports/`).

## Dependências permitidas

- `efos/application/orchestrators` (`PipelineExecutionSnapshot`) — apenas por tipo.
- `efos/application/report` (`ExecutiveReport`) — apenas por tipo.

## Dependências proibidas

- **Supabase/Prisma/SQL/Banco** — nenhuma implementação concreta nesta missão.
- **HTTP/API/React/Next.js** — esta camada não sabe que existe uma rota ou requisição.
- **Storage/Infraestrutura em geral** — pertence a uma futura camada de Infrastructure.
- **Repository concreto** — apenas o contrato `ExecutionRepository`, nenhuma classe que o implemente.
- **Cache** — nenhuma lógica de cache nesta missão.
