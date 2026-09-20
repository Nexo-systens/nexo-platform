# Infrastructure — Repositories

Status: **esqueleto, sem implementação (Mission 029 — Infrastructure Layer Foundation).**

## Responsabilidade

Implementar os contratos de persistência já definidos na Application Layer — nunca definir contratos novos, nunca conter regra financeira, nunca conhecer Engines internamente.

## Conteúdo previsto

| Implementação futura | Contrato (Application Layer) | Responsabilidade |
|---|---|---|
| `SupabaseExecutionRepository` (exemplo, nome não decidido) | `ExecutionRepository` (`efos/application/persistence/ExecutionRepository.ts`, Mission 027) | Persistir/consultar `ExecutionSnapshot` — uma execução completa do EFOS. |
| `SupabaseCompanyRepository` (exemplo) | `CompanyRepository` (`efos/application/ports/CompanyRepository.ts`, Mission 017) | Ler `Company` (`efos/domain`) por id. |
| `SupabaseDocumentRepository` (exemplo) | `DocumentRepository` (`efos/application/ports/DocumentRepository.ts`, Mission 017) | Ler documentos financeiros brutos por id/empresa. |

Nenhuma dessas implementações existe nesta missão — os nomes acima são ilustrativos, não uma decisão de nomenclatura. Nenhum Supabase, Prisma, SQL, PostgreSQL, MongoDB ou Redis foi criado.

`SupabaseExecutionRepository` (`SupabaseExecutionRepository.ts`, Mission 030; construtor revisado na Mission 032) já existe — esqueleto funcional de `ExecutionRepository`, recebendo `persistenceClient: PersistenceClient` via construtor, todos os métodos ainda lançando `Error("Not implemented.")`.

## Integração com `PersistenceClient` (Mission 032 — Supabase Persistence Client)

`PersistenceClient`/`PersistenceQuery`/`PersistenceResult` (`efos/infrastructure/shared/`, Mission 031 — Persistence Client Abstraction) são a abstração oficial de acesso a qualquer mecanismo de persistência (Supabase, PostgreSQL, SQLite, Mock, Testes), implementada concretamente por `SupabasePersistenceClient` (`efos/infrastructure/providers/SupabasePersistenceClient.ts`, Mission 032). `SupabaseExecutionRepository` **foi revisado** por esta missão: recebe `persistenceClient: PersistenceClient` via construtor em vez de `supabaseClient: unknown`. Os corpos de `save()`/`findByExecutionId()`/`findByCompany()` continuam lançando `Error("Not implemented.")` — traduzi-los em chamadas reais a `this.persistenceClient.insert()`/`select()`/etc. depende de uma tabela de execução que ainda não existe em `types/database.ts` (confirmado nesta missão: apenas `companies`, `users`, `documents`), fora do escopo desta missão.

**Estado real desde a Mission 035:** `save()`/`findByExecutionId()`/`findByCompany()` estão de fato implementados (Missions 033/034/035), não mais `Not implemented.` — o parágrafo acima descreve o estado desta pasta em Mission 032, preservado por não reescrever histórico.

**Desde a Mission 068 (Supabase Execution Repository Alignment, corrigindo D-039/Mission 067):** `save()` monta explicitamente o payload de `insert()` como um objeto plano com as colunas físicas reais de `public.executions` — `{ execution_id, company_id, metadata, execution, report }` — extraindo `execution_id`/`company_id` de `snapshot.execution.pipelineContext` (Mission 020B), em vez de repassar `ExecutionSnapshot` inteiro (que só tem `metadata`/`execution`/`report` no nível superior, e por isso nunca teria os dois campos `NOT NULL` exigidos pela tabela). `findByExecutionId()`/`findByCompany()` passam `filters: { execution_id }`/`{ company_id }` (nomes de coluna físicos, snake_case) para `persistenceClient.select()`, em vez de `{ executionId }`/`{ companyId }` (nomes de campo do contrato, camelCase, que não correspondem a nenhuma coluna real). `ExecutionRepository`/`ExecutionSnapshot` (contratos da Application Layer) não mudaram — só a tradução feita dentro desta classe, que é exatamente o papel de um Repository entre o modelo da aplicação e o modelo físico do banco.

## Dependências permitidas

- `efos/application/persistence` (`ExecutionRepository`, `ExecutionSnapshot`).
- `efos/application/ports` (`CompanyRepository`, `DocumentRepository`).
- `efos/domain` — apenas por tipo, quando o contrato já oficial exige.

## Dependências proibidas

- **Engines** (`efos/engines/*`) — nunca conhecidos aqui.
- **Definição de contrato novo** — todo contrato já existe na Application Layer; esta pasta só implementa.
- **Regra financeira** — pertence exclusivamente aos Builders dos Engines.
