# Infrastructure — Shared

Status: **abstração de persistência criada (Mission 031 — Persistence Client Abstraction).** Nenhuma implementação concreta, nenhuma conexão, nenhum SDK.

## Responsabilidade

Utilitários e abstrações exclusivos da Infrastructure Layer, reutilizáveis por `repositories/`, `providers/` e `storage/` — nunca lógica de negócio, nunca contrato já pertencente à Application Layer duplicado aqui (mesmo papel de `efos/application/shared/` para a Application Layer, agora nesta camada).

## Conteúdo

### `PersistenceClient` / `PersistenceQuery` / `PersistenceResult` (Mission 031)

A abstração oficial do cliente de persistência — pensada para que Supabase, PostgreSQL, SQLite, um Mock ou um client de testes possam implementar exatamente o mesmo contrato:

```ts
interface PersistenceClient {
  insert(query: PersistenceQuery): Promise<PersistenceResult>;
  update(query: PersistenceQuery): Promise<PersistenceResult>;
  select(query: PersistenceQuery): Promise<PersistenceResult>;
  delete(query: PersistenceQuery): Promise<PersistenceResult>;
}

interface PersistenceQuery {
  readonly collection: string;
  readonly filters?: Readonly<Record<string, unknown>>;
  readonly data?: Readonly<Record<string, unknown>>;
}

interface PersistenceResult<TData = unknown> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: string;
}
```

`PersistenceQuery` é puramente declarativa — nunca contém SQL, nunca contém sintaxe específica do Supabase (`.eq()`, `.match()`, etc.); descreve *o quê* consultar/gravar (`collection`, `filters`, `data`), nunca *como*. `PersistenceResult` é o retorno padronizado — `error` é `string`, não `ApplicationErrorCode` (`efos/application/shared/Errors.ts`), porque essa tradução é responsabilidade de quem consome o resultado, não da abstração em si (ver `PersistenceResult.ts` para o racional completo).

### `SupabasePersistenceClient` (Mission 032, em `efos/infrastructure/providers/`)

Primeira implementação concreta de `PersistenceClient` — usa a API oficial do SDK `@supabase/supabase-js` (`.from().insert()/.update()/.select()/.delete()`), recebendo um `SupabaseClient` já criado via construtor (reutiliza as fábricas já existentes em `lib/supabase/`, nunca cria uma segunda). Ver `efos/infrastructure/providers/README.md` para o racional completo e a limitação documentada (nenhuma tabela de execução existe hoje em `types/database.ts`).

## Integração com os Repositories (Mission 032)

`SupabaseExecutionRepository` (`efos/infrastructure/repositories/SupabaseExecutionRepository.ts`, Mission 030) **foi alterado** por esta missão: recebe `persistenceClient: PersistenceClient` via construtor em vez de `supabaseClient: unknown`. `save()`/`findByExecutionId()`/`findByCompany()` continuam lançando `Error("Not implemented.")` — traduzi-los em chamadas reais a `insert()`/`select()`/etc. depende de uma tabela de execução que ainda não existe, fora do escopo desta missão.

## Dependências permitidas

- Nenhuma — `PersistenceClient`/`PersistenceQuery`/`PersistenceResult` são autocontidos, sem dependência de `efos/application/*`, `efos/domain` ou qualquer SDK.

## Dependências proibidas

- **Engines** (`efos/engines/*`) — nunca conhecidos aqui.
- **SDK concreto** (Supabase, Prisma, drivers de PostgreSQL/Mongo/Redis) — esta camada é a abstração, nunca a implementação.
- **SQL/Query concreta** — `PersistenceQuery` é declarativa, nunca sintaxe de um mecanismo específico.
- **Regra financeira** — pertence exclusivamente aos Builders dos Engines.
