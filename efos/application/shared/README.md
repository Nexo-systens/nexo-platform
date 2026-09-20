# Application Layer — Shared

Status: **esqueleto, sem implementação.** Objetos compartilhados, puramente estruturais — nenhuma lógica de negócio.

## Conteúdo

- **`Result.ts`** — `Result<TValue, TError>`, wrapper genérico de sucesso/erro. Reutilizável por qualquer Service/Port internamente, não apenas pelo envelope oficial de `UseCase` (`ApplicationResult`, `efos/application/contracts/ApplicationResult.ts`, que é este mesmo tipo especializado com `ApplicationError` como erro).
- **`Errors.ts`** — `ApplicationErrorCode`, vocabulário fechado de códigos de erro (`not_found | invalid_input | conflict | unauthorized | unexpected`), como array `as const` + tipo derivado (mesma convenção do EFOS Core, `efos/domain/enums/*`). Distinto de `ApplicationError` (`efos/application/contracts/`): este arquivo define o vocabulário; `ApplicationError` é a forma que o usa.
- **`ApplicationMetadata.ts`** — `ApplicationMetadata` (`requestId`, `timestamp`), metadados comuns de uma operação — mesmo papel de `EfosEngineContext` (`efos/interfaces/engine.ts`) para os Engines, agora no nível da Application Layer.

## Relação com `contracts/`

`shared/` contém os tipos **genéricos e reutilizáveis**; `contracts/` contém os tipos que **especializam** esses genéricos para o uso oficial em Service/UseCase (`ApplicationResult` = `Result<T, ApplicationError>`; `ApplicationError` usa `ApplicationErrorCode`). Nenhuma lógica de negócio em nenhum dos dois — apenas forma.

## Dependências

Nenhuma dependência de `efos/domain`, `efos/engines`, `efos/interfaces` ou infraestrutura. `Result.ts` importa `ApplicationError` de `contracts/` (import de tipo apenas).
