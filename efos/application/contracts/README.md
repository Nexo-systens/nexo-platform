# Application Layer — Contracts

Status: **esqueleto, sem implementação.** Contratos comuns que todo Service e todo Use Case da Application Layer devem seguir — puramente estruturais, nenhuma lógica de negócio, sem dependência de HTTP.

## Conteúdo

- **`ApplicationService.ts`** — `ApplicationService`, contrato base de todo Service (`efos/application/services/*`). Hoje apenas `{ readonly name: string }` — cada Service concreto estende este contrato com sua interface pública mínima.
- **`UseCase.ts`** — `UseCase<TRequest, TResponse>`, contrato base de todo Use Case (`efos/application/use-cases/*`): `execute(request): Promise<ApplicationResult<TResponse>>`. Mesmo espírito de `EfosEngine` (`efos/interfaces/engine.ts`) para os Engines.
- **`ApplicationResult.ts`** — `ApplicationResult<TOutput>`, o envelope de retorno de todo `UseCase.execute()`. É `Result<TOutput, ApplicationError>` (`efos/application/shared/Result.ts`) especializado — mesmo princípio de `EfosEngineResult` para os Engines.
- **`ApplicationError.ts`** — `ApplicationError`, forma comum de erro (`code` + `message` + `details?`), usando o vocabulário de códigos definido em `efos/application/shared/Errors.ts`.

## Relação com `shared/`

Ver `efos/application/shared/README.md`, seção "Relação com `contracts/`".

## Dependências

Nenhuma dependência de `efos/domain`, `efos/engines`, `efos/interfaces` ou infraestrutura. Dependem apenas de `efos/application/shared` (import de tipo).
