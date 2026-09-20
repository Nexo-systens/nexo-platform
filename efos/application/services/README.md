# Application Layer — Services

Status: **`AnalysisService` (Mission 021) e `ReportService` (Mission 022) implementados de verdade; `RecommendationService`/`DecisionService` continuam esqueleto.** Um Service coordena o Orchestrator (`efos/application/orchestrators`) e/ou Ports (`efos/application/ports`) para prover uma capacidade da aplicação — nenhum Service contém regra de negócio (isso pertence aos Builders dos Engines, `efos/engines/*`) nem chama `Engine.execute()` diretamente; só o Orchestrator tem essa autorização (D-002, `docs/ARCHITECTURE.md`).

## Conteúdo

| Service | Responsabilidade | Interface pública | Status |
|---|---|---|---|
| `AnalysisService.ts` / `DefaultAnalysisService.ts` | Obter uma análise financeira completa de uma empresa. | `analyze(request: AnalyzeCompanyRequest, documents?: readonly RawFinancialDocument[], priorPeriods?: readonly EvidenceHistoricalPeriod[]): Promise<ApplicationResult<{ response: AnalyzeCompanyResponse; execution: PipelineExecution; metadata: PipelineMetadata }>>` | Implementado (Mission 021, retorno revisado na Mission 023 — D-020, parâmetro `documents` na Mission 026 — D-022, retorno revisado de novo na Mission 066 — D-038, `metadata` adicionado, parâmetro `priorPeriods` na Mission 174) — ver "AnalysisService" abaixo. |
| `ReportService.ts` / `DefaultReportService.ts` | Transformar um `PipelineExecution` em um `ExecutiveReport` estruturado. | `generateReport(execution: PipelineExecution): Promise<ExecutiveReport>` | Implementado (Mission 022) — ver "ReportService" abaixo. |
| `RecommendationService.ts` | Obter recomendações executivas de uma empresa. | `getRecommendations(companyId: string): Promise<unknown>` | Esqueleto. |
| `DecisionService.ts` | Obter decisões priorizadas de uma empresa. | `getDecisions(companyId: string): Promise<unknown>` | Esqueleto. |

Todos estendem `ApplicationService` (`efos/application/contracts/ApplicationService.ts`). O retorno `unknown` dos dois Services ainda esqueleto é deliberado — a forma real de recomendações/decisões na Application Layer ainda não foi decidida; especializá-la agora seria regra de negócio implícita, fora do escopo desta missão.

## `AnalysisService` (Mission 021)

Primeiro Service com implementação concreta (`DefaultAnalysisService`) e primeiro consumidor oficial do `EFOSPipelineRuntime` — nunca diretamente, sempre através do contrato `EFOSPipelineOrchestrator` (`efos/application/orchestrators/EFOSPipelineOrchestrator.ts`), injetado via construtor, ao lado do contrato `DocumentIntake` (`efos/application/intake/DocumentIntake.ts`, Mission 026). `analyze()`:

1. Recebe `AnalyzeCompanyRequest` (`{ companyId }`, `efos/application/dto/AnalyzeCompany.dto.ts`, Mission 017 — nenhum DTO novo criado), `documents` — parâmetro opcional, `readonly RawFinancialDocument[]`, default `[]` (Mission 026 — não é um DTO, reaproveita o contrato oficial do Data Engine) — e `priorPeriods` — parâmetro opcional, `readonly EvidenceHistoricalPeriod[]` (Mission 174 — histórico comparável já canonicalizado por `buildCanonicalPriorPeriods()`, `efos/application/history/`; este Service nunca busca/canonicaliza sozinho, quem decide o que fornecer é sempre o chamador, `DefaultEFOSFacade`, mesmo princípio de D-002 já aplicado a `documents`/`DocumentIntake`).
2. Passa `documents` por `this.documentIntake.prepareDocuments(documents)` (Mission 026, D-022) — remove nulos/duplicatas por `documentId`, preserva ordem.
3. Monta `PipelineContext` (`companyId` do request; `requestId`/`executionId` gerados via `node:crypto` `randomUUID()`; `timestamp` via `new Date().toISOString()`; `metadata: { documents: preparedDocuments, ...(priorPeriods ? { priorPeriods } : {}) }`, D-016 — `priorPeriods` na Mission 174, mesmo mecanismo de transporte já usado para `documents` desde a Mission 044, nunca um parâmetro novo em `EFOSPipelineOrchestrator.execute()`).
4. Aciona `EFOSPipelineOrchestrator.execute(context)`.
5. Recebe `PipelineResult` (`ApplicationResult<{ metadata, execution }>`, Mission 020B). Na falha, retorna o mesmo `error`.
6. No sucesso, traduz para `ApplicationResult<{ response: AnalyzeCompanyResponse; execution: PipelineExecution; metadata: PipelineMetadata }>`: `response` é o placeholder mínimo definido pela Mission 017 (`{ companyId: request.companyId }`, `AnalyzeCompanyResponse` em si não foi alterado), `execution` é o `PipelineExecution` já produzido (`result.value.execution`, D-020 — permite que um consumidor como `EFOSFacade`, Mission 023, encadeie `ReportService` sem conhecer o Orchestrator) e `metadata` é o `PipelineMetadata` já produzido (`result.value.metadata`, D-017).

Entre as Missions 037 e 065, este método também persistia a execução automaticamente (`ExecutionRepository.save()`, com `report` sempre `undefined`, D-028). **Desde a Mission 066 (Executive Report Persistence, D-038, revisando D-028), essa responsabilidade migrou para `DefaultEFOSFacade`** — o único ponto que já possui `metadata`+`execution`+`report` juntos, depois de `ReportService.generateReport()` retornar; ver "EFOSFacade" em `efos/application/facade/README.md`. `DefaultAnalysisService` já não recebe `ExecutionRepository` via construtor e não conhece persistência nenhuma — `metadata` passou a ser devolvido para que a Facade consiga montar o `ExecutionSnapshot` sem reconstruir nada.

Nenhuma regra financeira existe em `DefaultAnalysisService` — nenhum cálculo, nenhuma leitura de `PipelineExecution`/Aggregates além de repassar a referência recebida do Orchestrator, nenhuma lógica de limpeza de documentos própria (isso é responsabilidade exclusiva de `DocumentIntake`). Nenhum Use Case chama este Service ainda (`AnalyzeCompanyUseCase` continua contrato puro, `efos/application/use-cases/`); `efos/application/facade/DefaultEFOSFacade` (Mission 023) é o primeiro consumidor real de `analyze()`.

## `ReportService` (Mission 022)

Segundo Service com implementação concreta (`DefaultReportService`) — diferente de `AnalysisService`, **nunca aciona o Orchestrator nem executa Engine nenhum**. Consome exclusivamente um `PipelineExecution` (`efos/application/orchestrators/PipelineExecution.ts`, Mission 020B) já produzido por quem chamou — desde a Mission 023, `EFOSFacade` (`efos/application/facade/`) é quem encadeia `AnalysisService.analyze()` → `ReportService.generateReport()`, passando `execution` de um para o outro (D-020). `generateReport()`:

1. Recebe `PipelineExecution` diretamente — sem DTO, sem `ApplicationResult` de entrada (D-019, diferente do padrão de `AnalysisService`).
2. Lê apenas os campos já preenchidos (`pipelineContext`, `financialModel`, `indicators`, `evidence`, `context`, `reasoning`, `recommendation`, `decision`) — nunca modifica nenhum Aggregate, nunca executa cálculo financeiro.
3. Monta `ExecutiveReport` (`efos/application/report/`, novo módulo — ver `report/README.md`): `metadata` (identificadores + `generatedAt`), `summary` (contagens estruturais dos Aggregates de coleção) e `sections` (um por estágio "legível por um executivo" — Indicators, Evidence, Context, Reasoning, Recommendation, Decision — presente apenas se o Aggregate correspondente existir em `PipelineExecution`).
4. Retorna `Promise<ExecutiveReport>` diretamente — sem `ApplicationResult`, pois é uma transformação estrutural pura que nunca falha por si só (D-019).

**Desde a Mission 062 (Report Layer Builder Integration, D-035/D-036):** sempre que `execution.indicators` existir, `buildSections()` também organiza `execution.indicators.indicators` com `DefaultKPIBuilder`/`DefaultFinancialHealthBuilder`/`DefaultFinancialRiskBuilder` (`efos/engines/financial-model/builders/`, Missions 057–059), produzindo três seções adicionais (`"kpi"`, `"financialHealth"`, `"financialRisk"`).

**Desde a Mission 064 (Financial Statement Builders Integration, D-037):** sempre que `execution.data` existir, `buildSections()` também organiza essa coleção (`readonly NormalizedFinancialRecord[]`, produzida pelo Data Engine e preservada em `PipelineExecution.data` desde a Mission 020B) com `DefaultBalanceSheetBuilder`/`DefaultIncomeStatementBuilder`/`DefaultCashFlowBuilder`, produzindo três seções adicionais (`"balanceSheet"`, `"incomeStatement"`, `"cashFlow"`) — cada Builder chamado **independentemente sobre `execution.data`**, nunca encadeado com o resultado de outro Builder, para que a ordenação de uma demonstração nunca contamine outra. A Mission 062 (D-036) havia concluído que esses três Builders não tinham dado disponível na Report Layer; a Mission 063 (D-037) corrigiu essa premissa ao auditar `PipelineExecution.data` — um campo distinto de `financialModel` que D-036 não havia verificado. Agora 6 dos 7 Builders financeiros (Missions 053–059) estão integrados — apenas `FinancialStatementBuilder` permanece sem seção, pois exige `CandidateFinancialRecord[]` (Data Engine, forma pré-normalização), nunca preservado em lugar algum (D-033, não afetado por D-037). Nenhum Builder é chamado por nenhum Engine; `DefaultReportService` nunca executa `Engine.execute()`, apenas instancia os Builders (funções puras de organização) diretamente, mesmo princípio já usado por `EFOSPipelineRuntime` ao importar `FinancialModelEngine`.

**Desde a Mission 065 (Executive Financial Report Assembly):** as seis seções financeiras (`"financialHealth"`, `"financialRisk"`, `"kpi"`, `"balanceSheet"`, `"incomeStatement"`, `"cashFlow"`) passaram a ser montadas em uma **ordem executiva determinística fixa** — `buildFinancialSections()`, um novo método privado, monta exatamente essa ordem, independentemente da ordem de construção interna. As demais seções (`"indicators"`, `"evidence"`, `"context"`, `"reasoning"`, `"recommendation"`, `"decision"`) permanecem na mesma ordem relativa de antes, ao final. Nenhum dado de nenhuma seção é alterado — apenas reordenação de posição no array `sections`; uma seção ausente continua simplesmente omitida, nunca criada artificialmente.

Nenhuma regra financeira existe em `DefaultReportService` — nenhum cálculo (além de `.length` de coleções já existentes), nenhuma inferência, nenhuma renderização (HTML/Markdown/PDF pertencem a uma camada futura). Nenhum Use Case chama este Service ainda (`GenerateExecutiveReportUseCase` continua contrato puro). `DefaultReportService` nunca conheceu persistência e continua sem conhecer — a Mission 066 não alterou este arquivo.

## Dependências permitidas

- `efos/application/contracts` (contrato base `ApplicationService`, `ApplicationResult`).
- `efos/application/dto` (`AnalyzeCompanyRequest`/`AnalyzeCompanyResponse`) — apenas `DefaultAnalysisService`; `DefaultReportService` não usa DTO nenhum (D-019).
- `efos/application/orchestrators` (`EFOSPipelineOrchestrator`, `PipelineContext`, `PipelineExecution`, `PipelineMetadata`) — `DefaultAnalysisService` via injeção de dependência do Orchestrator (nunca `EFOSPipelineRuntime` diretamente, Mission 021), devolvendo `metadata` desde a Mission 066; `DefaultReportService` só pelo tipo `PipelineExecution`, nunca o Orchestrator (Mission 022).
- `efos/application/intake` (`DocumentIntake`) — `DefaultAnalysisService` via injeção de dependência (nunca `DefaultDocumentIntake` diretamente, Mission 026).
- `@/efos/engines/data` (`RawFinancialDocument`) — apenas por tipo, para o parâmetro `documents` de `DefaultAnalysisService.analyze()` (Mission 026).
- `efos/application/report` (`ExecutiveReport` e suas partes) — apenas `DefaultReportService` (Mission 022).
- `efos/engines/financial-model/builders` (`DefaultKPIBuilder`, `DefaultFinancialHealthBuilder`, `DefaultFinancialRiskBuilder`, `DefaultBalanceSheetBuilder`, `DefaultIncomeStatementBuilder`, `DefaultCashFlowBuilder`) — apenas `DefaultReportService` (Missions 062/064, D-035/D-036/D-037); funções puras de organização, nunca `Engine.execute()`.
- `efos/application/ports` (quando implementados de verdade, para acessar dados) — ainda não usado por nenhum Service.
- `node:crypto` (`randomUUID`) — biblioteca padrão do runtime, não infraestrutura; mesmo espírito de `EFOSPipelineRuntime` usar `new Date()` diretamente sem um Port `Clock` (`DefaultReportService` também usa `new Date()` diretamente, para `generatedAt`).

**Desde a Mission 066** — `efos/application/persistence` (`ExecutionRepository`, `ExecutionSnapshot`) deixou de ser dependência de `DefaultAnalysisService`; a injeção migrou para `DefaultEFOSFacade` (`efos/application/facade/README.md`). Nenhum Service deste diretório depende de `ExecutionRepository` hoje.

## Dependências proibidas

- **Engines** (`efos/engines/*`) — nenhum Service chama `Engine.execute()`; essa autorização pertence exclusivamente ao Orchestrator.
- **Domain** (`efos/domain`) — um Service nunca importa entidades/agregados do domínio diretamente; só via os tipos já usados pelo Orchestrator/`PipelineResult`/`PipelineExecution`, nunca para regra de negócio própria.
- **`EFOSPipelineRuntime`** (a classe concreta) — um Service depende apenas do contrato `EFOSPipelineOrchestrator` (quando precisa dele), nunca da implementação concreta.
- **`DefaultDocumentIntake`** (a classe concreta) — `DefaultAnalysisService` depende apenas do contrato `DocumentIntake`, recebido via construtor.
- **`ExecutionRepository`/persistência** — desde a Mission 066, nenhum Service deste diretório conhece persistência; essa responsabilidade vive exclusivamente em `DefaultEFOSFacade`.
- **Renderização** (HTML, Markdown, PDF, template engine, React, IA) — `DefaultReportService` produz apenas estrutura; renderização pertence a uma camada futura.
- **Infraestrutura** (Supabase, banco, Next.js, HTTP) — Services dependem de Ports (interfaces) e do Orchestrator, nunca de implementações concretas de infraestrutura.
