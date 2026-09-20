# EFOS — Infrastructure Layer

Status: **estrutura criada (Mission 029); primeiras implementações concretas desde a Mission 030/032; Composition Root oficial desde a Mission 038.** Onde todas as implementações concretas dos contratos da Application Layer vivem, e onde elas são montadas para uso real.

## Objetivo da camada

A Infrastructure Layer é a camada mais externa da arquitetura (`docs/AI_START.md`, ordem de dependências: `Domain → Domain Events → EFOS Engines → Application → Experience → Infrastructure`) — implementa os Ports e demais contratos que a Application Layer já define (`efos/application/ports/`, Mission 017; `efos/application/persistence/ExecutionRepository`, Mission 027), nunca o contrário. É onde Supabase, um banco relacional, um serviço de storage, ou qualquer outra tecnologia concreta vai efetivamente aparecer — quando uma missão futura decidir implementá-los.

## Responsabilidade

Implementar exclusivamente os contratos já definidos na Application Layer.

- **Nunca define contratos** — todo contrato (`interface`) já existe em `efos/application/ports/` ou `efos/application/persistence/`; a Infrastructure só os implementa (`class ... implements ...`).
- **Nunca contém regra financeira** — toda regra determinística pertence exclusivamente aos Builders dos Engines (`efos/engines/*/.builder.ts`).
- **Nunca conhece Engines internamente** — a Infrastructure não importa `efos/engines/*`; ela só conhece os contratos da Application Layer que implementa.

## Estrutura

```
efos/infrastructure/
├── README.md          — este arquivo
├── index.ts             — ponto de entrada público
├── repositories/          — SupabaseExecutionRepository (Mission 030/033–035); futuras implementações de CompanyRepository, DocumentRepository
├── providers/              — SupabasePersistenceClient (Mission 032); futuras implementações de Logger, Clock, UuidGenerator
├── storage/                 — futura implementação de StorageProvider
├── shared/                   — PersistenceClient/PersistenceQuery/PersistenceResult (Mission 031); demais utilitários exclusivos da Infrastructure
└── composition/            — DefaultInfrastructureContainer (Mission 038) — Composition Root oficial: SupabaseClient → SupabasePersistenceClient → SupabaseExecutionRepository → DefaultEFOSContainer
```

### `repositories/`

Futuras implementações concretas dos Ports/contratos de persistência já definidos na Application Layer:

- `ExecutionRepository` (`efos/application/persistence/ExecutionRepository.ts`, Mission 027) — persistência de uma execução completa do EFOS (`ExecutionSnapshot`).
- `CompanyRepository` (`efos/application/ports/CompanyRepository.ts`, Mission 017) — leitura de `Company` (`efos/domain`).
- `DocumentRepository` (`efos/application/ports/DocumentRepository.ts`, Mission 017) — leitura de documentos financeiros brutos.

Nenhuma implementação criada nesta missão — nenhum Supabase, Prisma, SQL, PostgreSQL, MongoDB ou Redis.

### `providers/`

Futuras implementações concretas dos Ports de infraestrutura transversal já definidos na Application Layer:

- `Logger` (`efos/application/ports/Logger.ts`) — log estruturado.
- `Clock` (`efos/application/ports/Clock.ts`) — abstração de tempo, hoje contornada por `new Date()` diretamente em `EFOSPipelineRuntime`/`DefaultAnalysisService`/`DefaultReportService` (D-018/D-019).
- `UuidGenerator` (`efos/application/ports/UuidGenerator.ts`) — geração de identificador único, hoje contornada por `node:crypto` `randomUUID()` diretamente em `DefaultAnalysisService` (D-018).

### `storage/`

Futura implementação concreta do Port de armazenamento de arquivo já definido na Application Layer:

- `StorageProvider` (`efos/application/ports/StorageProvider.ts`) — upload/download de arquivo bruto.

### `shared/`

`PersistenceClient`/`PersistenceQuery`/`PersistenceResult` (Mission 031) — a abstração oficial de cliente de persistência. Demais utilitários exclusivos da Infrastructure Layer, reutilizáveis pelas pastas acima — ex.: mapeamento de erro de driver/SDK concreto para `ApplicationErrorCode` (`efos/application/shared/Errors.ts`), helpers de configuração de client. Nunca lógica de negócio, nunca contrato novo — apenas suporte às implementações concretas.

### `composition/`

`DefaultInfrastructureContainer` (Mission 038 — Infrastructure Composition) — o Composition Root oficial da Infrastructure Layer. Recebe um `SupabaseClient` já criado via construtor e monta a cadeia completa: `SupabaseClient → SupabasePersistenceClient → SupabaseExecutionRepository → DefaultEFOSContainer`, expondo apenas `getContainer(): EFOSContainer`. Ver `composition/README.md` para o racional completo.

## Dependências permitidas

- `efos/application/ports`, `efos/application/persistence`, `efos/application/contracts`, `efos/application/shared` — os contratos que a Infrastructure implementa.
- `efos/application/composition` (`EFOSContainer`, `DefaultEFOSContainer`) — apenas `composition/DefaultInfrastructureContainer.ts` (Mission 038), o único ponto autorizado a montar a Application Layer a partir da Infrastructure.
- `efos/domain` — apenas por tipo, quando um contrato já oficial exige (ex.: `CompanyRepository` retorna `Company`).
- `@supabase/supabase-js`/`@supabase/ssr` — o SDK concreto que as implementações desta camada traduzem para os contratos da Application Layer.

## Dependências proibidas

- **Engines** (`efos/engines/*`) — a Infrastructure nunca conhece Engines internamente; qualquer execução de pipeline passa exclusivamente pela Application Layer (`EFOSHost`/`EFOSFacade`/`EFOSPipelineOrchestrator`).
- **Domain com regra de negócio** — a Infrastructure lê/escreve entidades do Domain via os contratos já oficiais, nunca modela regra financeira.
- **HTTP/API/Next.js/React** — esta camada não sabe que existe uma rota; isso pertence a `efos/application/api/` (transporte-agnóstica) e a uma futura camada de transporte real.
- **Criação de client Supabase** — `createClient()`/`createBrowserClient()`/`createServerClient()` nunca são chamados dentro de `efos/infrastructure/`; o client sempre chega já pronto via construtor (D-026, reforçado por D-029).
