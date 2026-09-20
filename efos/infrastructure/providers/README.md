# Infrastructure — Providers

Status: **primeira implementação concreta criada (Mission 032 — Supabase Persistence Client).**

## Responsabilidade

Implementar os Ports/contratos de infraestrutura transversal já definidos na Application Layer e na própria Infrastructure Layer — nunca definir contratos novos, nunca conter regra financeira, nunca conhecer Engines internamente.

## Conteúdo

### `SupabasePersistenceClient` (Mission 032)

Implementa `PersistenceClient` (`efos/infrastructure/shared/PersistenceClient.ts`, Mission 031) usando a API oficial do SDK `@supabase/supabase-js` (`.from().insert()/.update()/.select()/.delete()`), nunca SQL manual, nunca Prisma. Recebe um `SupabaseClient` já criado via construtor — nunca chama `createClient()`/`createBrowserClient()`/`createServerClient()` internamente, reutilizando qualquer instância já criada pelas fábricas existentes do projeto (`lib/supabase/client.ts`, `lib/supabase/server.ts`). Tipado como `SupabaseClient` genérico (sem o `Database` de `types/database.ts`) porque `PersistenceQuery.collection` é uma `string` neutra, não restrita ao schema atual (D-026).

**Limitação documentada**: `types/database.ts` hoje só define `companies`, `users`, `documents` — nenhuma tabela relacionada a execução do EFOS existe. Os métodos funcionam para qualquer `collection` real, mas uma chamada com `collection: "executions"` falha em tempo de execução (relação inexistente no Postgres), reportado via `PersistenceResult.error`. Criar essa tabela está fora do escopo desta missão.

## Conteúdo previsto (ainda não implementado)

| Implementação futura | Contrato (Application Layer) | Responsabilidade |
|---|---|---|
| `Logger` concreto (exemplo, nome não decidido) | `Logger` (`efos/application/ports/Logger.ts`, Mission 017) | Log estruturado (`info`/`warn`/`error`). Pontos de extensão já marcados em `EFOSPipelineRuntime.prepare()`/`validate()`/`finalize()` (Mission 019). |
| `Clock` concreto (exemplo) | `Clock` (`efos/application/ports/Clock.ts`, Mission 017) | Abstração de tempo (`now()`) — hoje contornada por `new Date()` diretamente em `EFOSPipelineRuntime`/`DefaultAnalysisService`/`DefaultReportService` (D-018/D-019). |
| `UuidGenerator` concreto (exemplo) | `UuidGenerator` (`efos/application/ports/UuidGenerator.ts`, Mission 017) | Geração de identificador único — hoje contornada por `node:crypto` `randomUUID()` diretamente em `DefaultAnalysisService` (D-018). |

Nenhuma dessas implementações existe ainda — os nomes acima são ilustrativos, não uma decisão de nomenclatura.

## Dependências permitidas

- `efos/application/ports` (`Logger`, `Clock`, `UuidGenerator`).
- `efos/infrastructure/shared` (`PersistenceClient`, `PersistenceQuery`, `PersistenceResult`).
- `@supabase/supabase-js` (tipo `SupabaseClient` apenas — nunca `createClient()`).

## Dependências proibidas

- **Engines** (`efos/engines/*`) — nunca conhecidos aqui.
- **Definição de contrato novo** — todo contrato já existe na Application Layer ou em `efos/infrastructure/shared`; esta pasta só implementa.
- **Regra financeira** — pertence exclusivamente aos Builders dos Engines.
- **Criação de client Supabase** — `SupabasePersistenceClient` sempre recebe o client já criado, nunca chama `createClient()`/`createBrowserClient()`/`createServerClient()`.
