# Application Layer — Executive Report

Status: **estrutura implementada (Mission 022 — Executive Report Service; estendida na Mission 062 — Report Layer Builder Integration; estendida novamente na Mission 064 — Financial Statement Builders Integration).** Contratos e mapeamento puro de `PipelineExecution` para `ExecutiveReport` — sem renderização, sem HTML, sem Markdown, sem PDF, sem IA, sem template engine. Essa camada de apresentação é trabalho de uma missão futura, ainda não definida.

## Objetivo

Transformar um `PipelineExecution` (`efos/application/orchestrators/PipelineExecution.ts`, Mission 020B) — já concluído (ou parcialmente concluído, em caso de falha de estágio) — em uma representação estruturada e canônica de relatório executivo, consumível por uma futura camada de apresentação (HTML, PDF, Dashboard). Produzido por `DefaultReportService` (`efos/application/services/DefaultReportService.ts`, Mission 022).

## Estrutura

```
ExecutiveReport
├── metadata    ExecutiveReportMetadata  — companyId, executionId, financialModelId?, generatedAt
├── summary     ExecutiveReportSummary   — contagens estruturais dos Aggregates produzidos
└── sections    ExecutiveReportSection[] — um por estágio legível por um executivo
```

- **`ExecutiveReportMetadata.ts`** — identificadores da execução de origem (`companyId`, `executionId`, reaproveitados de `PipelineExecution.pipelineContext`) e do Financial Model (`financialModelId`, de `PipelineExecution.financialModel.root.id`, ausente se a execução não alcançou esse estágio); `generatedAt` marca quando o relatório foi montado.
- **`ExecutiveReportSummary.ts`** — uma contagem (`number`) por Aggregate de coleção já produzido (`indicatorsCount`, `evidenceCount`, `contextCount`, `reasoningCount`, `recommendationCount`, `decisionCount`) — sempre `0` para um estágio não alcançado, nunca `undefined`. Nenhum cálculo financeiro, nenhuma inferência — apenas `.length` de coleções já existentes.
- **`ExecutiveReportSection.ts`** — union discriminada por `type` (`"indicators" | "evidence" | "context" | "reasoning" | "recommendation" | "decision" | "kpi" | "financialHealth" | "financialRisk" | "balanceSheet" | "incomeStatement" | "cashFlow"`), cada variante carregando `title` (rótulo fixo) e o Aggregate/lista correspondente por referência. Os 6 estágios "legíveis por um executivo" da cadeia principal — Data, Financial Model, Financial Knowledge Graph (estágios internos/técnicos) e Learning (meta-conhecimento) ficam fora do relatório, por escolha explícita da Mission 022 (mesmos 6 exemplos dados por ela). Desde a Mission 062 (D-035/D-036), três variantes aditivas — `"kpi"`, `"financialHealth"`, `"financialRisk"` — carregam `execution.indicators.indicators` já reorganizado por `KPIBuilder`/`FinancialHealthBuilder`/`FinancialRiskBuilder` (`efos/engines/financial-model/builders/`, Missions 057–059). Desde a Mission 064 (D-037), mais três variantes aditivas — `"balanceSheet"`, `"incomeStatement"`, `"cashFlow"` — carregam `execution.data` já reorganizado por `BalanceSheetBuilder`/`IncomeStatementBuilder`/`CashFlowBuilder`; ver "Builders financeiros integrados" abaixo.
- **`ExecutiveReport.ts`** — agrega os três acima. Puramente estrutural.

## Por que apenas estrutura

A Mission 022 é explícita: "ainda NÃO criar PDF/HTML/API/UI — o objetivo é criar apenas a representação estruturada do relatório." `ExecutiveReport` e seus componentes são `interface`/`type` puros — nenhuma lógica de renderização, nenhuma dependência de biblioteca de template, nenhuma formatação de texto. Uma futura camada de apresentação consome `ExecutiveReport` para produzir HTML/PDF/Markdown — essa transformação não existe ainda.

## Por que `Summary` usa contagens, não valores financeiros

A missão exige que o Summary "utilize exclusivamente os Aggregates já produzidos" e proíbe "cálculo novo"/"inferência nova"/"regra financeira nova". Contar itens de uma coleção já existente (`indicators.length`, `evidences.length` etc.) não introduz nenhum fato financeiro novo — é a mesma informação estrutural que `PipelineMetadata.completedStages.length` já expressa para estágios, aplicada agora ao conteúdo de cada Aggregate. Nenhuma soma, média, ou interpretação de valor (`Indicator.value`, `Money`, `Percentage`) é calculada aqui.

## Builders financeiros integrados (Mission 062/064, D-035/D-036/D-037)

`DefaultReportService.buildSections()` (`efos/application/services/DefaultReportService.ts`) organiza `execution.indicators.indicators` com `KPIBuilder`/`FinancialHealthBuilder`/`FinancialRiskBuilder` sempre que `execution.indicators` existir (Mission 062). Desde a Mission 064, também organiza `execution.data` (`readonly NormalizedFinancialRecord[]`, produzido pelo Data Engine e preservado em `PipelineExecution.data` desde a Mission 020B) com `BalanceSheetBuilder`/`IncomeStatementBuilder`/`CashFlowBuilder` sempre que `execution.data` existir — os três Builders **aplicados independentemente sobre a mesma coleção original**, nunca encadeados: a ordenação de uma demonstração nunca contamina outra. A Mission 062 (D-036) havia concluído, incorretamente, que esses três Builders não tinham dado disponível — a Mission 063 (D-037) corrigiu essa premissa ao encontrar `PipelineExecution.data`, um campo distinto de `financialModel` que D-036 não havia verificado. Agora, 6 dos 7 Builders financeiros (Missions 053–059) estão integrados. **`FinancialStatementBuilder` continua sem seção correspondente** — exige `CandidateFinancialRecord[]` (Data Engine, forma pré-normalização), que nunca é preservado em lugar algum (D-033, não afetado por D-037). Nenhum Builder é chamado por nenhum Engine; apenas por esta camada (Application), que já importava `FinancialModelEngine` diretamente antes da Mission 062 (`EFOSPipelineRuntime.ts`) — mesma direção de dependência. Ver D-036/D-037 (`docs/DECISIONS.md`) para o racional completo.

## Dependências permitidas

- `@/efos/domain` (`IndicatorsAggregate`, `EvidenceAggregate`, `ContextAggregate`, `ReasoningAggregate`, `RecommendationAggregate`, `DecisionAggregate`, `Indicator`) — apenas por tipo, para tipar as seções.
- `@/efos/engines/data` (`NormalizedFinancialRecord`) — apenas por tipo, contrato oficial do Data Engine (D-002), para tipar as três novas seções (Mission 064).
- `efos/application/orchestrators` (`PipelineExecution`, `PipelineContext`) — apenas por tipo, consumido por `DefaultReportService` (não por estes arquivos de contrato).
- `efos/engines/financial-model/builders` (`DefaultKPIBuilder`, `DefaultFinancialHealthBuilder`, `DefaultFinancialRiskBuilder`, `DefaultBalanceSheetBuilder`, `DefaultIncomeStatementBuilder`, `DefaultCashFlowBuilder`) — apenas em `DefaultReportService` (Missions 062/064), nunca nos arquivos de contrato deste diretório; funções puras de organização, nunca `execute()` de Engine.

## Dependências proibidas

- **`execute()` de qualquer Engine** — nenhum Engine é executado para produzir um `ExecutiveReport`; todo o conteúdo já vem pronto de `PipelineExecution`. Importar Builders (funções puras) de um módulo de Engine é permitido (acima); chamar `Engine.execute()` não é.
- **Renderização** (HTML, Markdown, PDF, template engine, React) — pertence a uma camada de apresentação futura, não criada nesta missão.
- **HTTP/API/Controllers/Banco/Persistência/IA** — nenhuma dependência de infraestrutura ou de geração assistida por IA.
