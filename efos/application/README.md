# EFOS — Application Layer

Status: **fundação estrutural (Mission 017); Orchestrator com encadeamento real dos 10 Engines (Mission 020A) e estado completo da execução preservado (Mission 020B).** Contracts, DTOs, Ports, Services e Use Cases continuam esqueleto — sem lógica de negócio, sem infraestrutura. `orchestrators/EFOSPipelineRuntime` é a exceção: já chama de fato `Engine.execute()` de cada Engine da cadeia principal e armazena a saída de cada estágio em `PipelineExecution` (ver `orchestrators/README.md`).

## Objetivo da camada

A Application Layer coordena o domínio (`efos/domain`) e os Engines do EFOS Core (`efos/engines/*`) para atender casos de uso executivos concretos (ex.: "analisar uma empresa", "gerar um relatório executivo"). O Orchestrator (`orchestrators/EFOSPipelineRuntime`) já encadeia a execução dos 10 Engines da cadeia principal (`efos/types/pipeline.ts`, `EFOS_PIPELINE`, Mission 020A) — nenhum Engine chama outro (D-002); nenhuma rota da Plataforma chama um Engine ou o Orchestrator ainda.

Referência normativa: `docs/ARCHITECTURE.md` (camada "Application" já reservada na ordem de dependências desde a Mission 006) e `docs/AI_START.md` (ordem de dependências: `Domain → Domain Events → EFOS Engines → Application → Experience → Infrastructure`).

## Responsabilidades

- **Contracts** (`contracts/`) — contratos comuns que todo Service/UseCase segue: `ApplicationService`, `UseCase`, `ApplicationResult`, `ApplicationError`.
- **DTOs** (`dto/`) — objetos de transferência de dados imutáveis que atravessam a fronteira da camada, nunca reutilizando entidades do domínio.
- **Ports** (`ports/`) — interfaces (padrão *ports & adapters*) que a Infrastructure implementará no futuro: `CompanyRepository`, `AnalysisRepository`, `DocumentRepository`, `ReportRepository`, `StorageProvider`, `Clock`, `Logger`, `UuidGenerator`.
- **Services** (`services/`) — coordenam Ports para prover uma capacidade da aplicação: `AnalysisService`, `RecommendationService`, `DecisionService`, `ReportService`.
- **Use Cases** (`use-cases/`) — cada um com responsabilidade única, dependendo apenas de Services: `AnalyzeCompanyUseCase`, `GenerateExecutiveReportUseCase`, `RunFinancialDiagnosisUseCase`.
- **Shared** (`shared/`) — objetos genéricos reutilizáveis entre as pastas acima: `Result`, `Errors` (vocabulário de códigos), `ApplicationMetadata`.

Nenhuma dessas pastas contém lógica de negócio nesta missão — são contratos e esqueletos, análogos ao que `efos/engines/<nome>/` era antes da Mission 004 (primeira implementação real de Engine).

## Dependências permitidas

- `efos/domain` — a Application Layer pode ler entidades/agregados do domínio (ex.: `CompanyRepository` retorna `Company`, `efos/domain`).
- `efos/interfaces` — o contrato `EfosEngine`/`EfosEngineContext`/`EfosEngineResult` é a forma que o Orchestrator usa para invocar cada Engine.
- `efos/types` — `EngineId`, `EFOS_PIPELINE`.

## Dependências proibidas (por princípio arquitetural)

- **Engines** (`efos/engines/*`) fora de `orchestrators/` — nenhum Service, DTO, Port ou Use Case chama `Engine.execute()` diretamente. Desde a Mission 020A, `efos/application/orchestrators/EFOSPipelineRuntime.ts` é a **única** exceção — o Orchestrator é a única peça autorizada a importar e encadear Engines (D-002: Engines nunca chamam outros Engines; a coordenação vive na Application Layer, nunca em nenhum Engine).
- **HTTP/Controllers/API** — a Application Layer não sabe que existe uma API REST/HTTP. Rotas futuras (Next.js) vão *chamar* Use Cases desta camada, nunca o inverso.
- **Next.js** — nenhum import de `next/*`, nenhuma rota, nenhum Server Action.
- **Supabase/Banco/Persistência real** — Ports definem contratos; a implementação concreta (ex.: um `SupabaseCompanyRepository`) pertence a uma futura camada de Infrastructure, fora do EFOS Core.

## Relação com o Domain

A Application Layer **consome** o Domain (`efos/domain`) por leitura — nunca o modifica, nunca adiciona regra de negócio a ele. Toda regra de negócio determinística continua exclusivamente nos Builders dos Engines (`efos/engines/*/.builder.ts`), nunca em um Service ou Use Case desta camada. A ordem de dependência (`docs/AI_START.md`) é sempre de fora para dentro: `Domain → EFOS Engines → Application` — a Application Layer nunca é importada por `efos/domain` nem por `efos/engines`.

## Relação com Infrastructure

A Application Layer define os **Ports** (`ports/`) que a Infrastructure deve implementar — ela nunca importa nada de uma futura pasta de Infrastructure. Essa é a inversão de dependência clássica de Clean Architecture: a camada mais interna (Application) declara o que precisa; a camada mais externa (Infrastructure) se adapta a essa declaração, nunca o contrário.

## Relação futura com a API

Nenhuma API existe hoje. Quando uma API (REST, Server Actions do Next.js, etc.) for construída, ela deve depender apenas dos **Use Cases** desta camada (`use-cases/`), nunca diretamente de Services, Ports ou Engines — o Use Case é o único ponto de entrada externo da Application Layer. Nenhuma rota, controller ou handler HTTP foi criado nesta missão.

## Estrutura

```
efos/application/
├── README.md          — este arquivo
├── index.ts             — ponto de entrada público
├── contracts/            — ApplicationService, UseCase, ApplicationResult, ApplicationError
├── dto/                   — AnalyzeCompany{Request,Response}, GenerateReport{Request,Response}
├── ports/                 — CompanyRepository, AnalysisRepository, DocumentRepository, ReportRepository, StorageProvider, Clock, Logger, UuidGenerator
├── services/               — AnalysisService, RecommendationService, DecisionService, ReportService
├── shared/                 — Result, Errors (ApplicationErrorCode), ApplicationMetadata
└── use-cases/               — AnalyzeCompanyUseCase, GenerateExecutiveReportUseCase, RunFinancialDiagnosisUseCase
```

Cada subpasta tem seu próprio `README.md` detalhando conteúdo, dependências permitidas/proibidas e racional de design.

## Estado atual

`contracts/`, `dto/`, `ports/`, `services/`, `shared/`, `use-cases/` permanecem contratos TypeScript (`interface`/`type`) — nenhuma classe concreta, nenhum método com corpo, nenhuma regra de negócio. `unknown` é usado deliberadamente onde a forma real de um dado (análise, documento, relatório) ainda não foi decidida por nenhuma missão — nunca inventado. `orchestrators/` é a exceção desde a Mission 020A: `EFOSPipelineRuntime` é uma classe concreta que encadeia os 10 Engines de verdade. A próxima fase natural é conectar um Service (ex.: `AnalysisService`) ao Orchestrator, fora do escopo da Mission 020A.
