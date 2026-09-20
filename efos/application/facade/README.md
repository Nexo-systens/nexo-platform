# Application Layer — EFOS Facade

Status: **implementada (Mission 023 — EFOS Facade).** Ponto único de entrada da Application Layer — toda a Plataforma NEXO deve conversar com o EFOS através de `EFOSFacade`, nunca conhecendo `AnalysisService`/`ReportService` (ou qualquer outro Service) individualmente. Nenhuma rota/Use Case da Plataforma invoca a Facade ainda — isso é trabalho de uma missão futura.

## Responsabilidade

A Facade coordena **exclusivamente** dois Services já implementados:

- `AnalysisService` (`efos/application/services/AnalysisService.ts`, Mission 021) — aciona o pipeline via `EFOSPipelineOrchestrator` e produz `PipelineExecution`+`PipelineMetadata`.
- `ReportService` (`efos/application/services/ReportService.ts`, Mission 022) — transforma `PipelineExecution` em `ExecutiveReport`.

Nada mais nos dois Services. A Facade **nunca** executa Engines, **nunca** aciona o `EFOSPipelineOrchestrator`/`EFOSPipelineRuntime` diretamente — essas responsabilidades continuam exclusivamente dentro de `AnalysisService` (D-002, D-018). **Desde a Mission 066 (Executive Report Persistence, D-038)**, a Facade também é responsável por persistir a execução completa — via `ExecutionRepository` (`efos/application/persistence/`, Mission 027), recebido via construtor — depois que `ReportService` já produziu o `ExecutiveReport`; ver "Persistência" abaixo.

## Fluxo (`analyzeCompany`)

```
AnalyzeCompanyRequest + documents?
        ↓
AnalysisService.analyze(request, documents)
        ↓
ApplicationResult<{ response: AnalyzeCompanyResponse; execution: PipelineExecution; metadata: PipelineMetadata }>
        ↓ (se success)
ReportService.generateReport(execution)
        ↓
ExecutiveReport
        ↓ (Mission 066)
ExecutionSnapshot { metadata, execution, report } → ExecutionRepository.save()
        ↓
ApplicationResult<ExecutiveReport>  (Facade Response)
```

Desde a Mission 044 (End-to-End Document Flow, D-032), `documents` é um segundo parâmetro opcional (`readonly RawFinancialDocument[] = []`) — mesmo padrão de `AnalysisService.analyze()` (Mission 026, D-022) — repassado diretamente para `AnalysisService.analyze(request, documents)`, sem nenhuma transformação própria da Facade. Fecha a lacuna registrada em D-031: quem chama `analyzeCompany()` com documentos reais agora consegue fazê-los chegar até `PipelineContext.metadata.documents`.

Se `AnalysisService.analyze()` falhar (`success: false` — `PipelineContext` inválido ou algum Engine retornou `status: "failed"`), a Facade repassa o mesmo `error`, sem reinterpretar, e nunca chama `ReportService` nem persiste nada (D-020: `PipelineExecution` só existe quando a análise teve sucesso).

## Persistência (Mission 066 — Executive Report Persistence, D-038)

Até a Mission 065, a persistência automática de uma execução acontecia dentro de `DefaultAnalysisService` (D-028, Mission 037), sempre com `report: undefined` — o `ExecutiveReport` só existia depois, produzido por `ReportService` já dentro desta Facade, quando a persistência já havia ocorrido. Isso significava que nenhum `ExecutionSnapshot` persistido carregava de fato um relatório executivo, mesmo com `ExecutionSnapshot.report?: ExecutiveReport` (`efos/application/persistence/ExecutionSnapshot.ts`, Mission 027) já existindo desde então.

A Mission 066 audita essa lacuna e a resolve **sem criar nenhuma estrutura de persistência nova**: `ExecutionSnapshot`/`ExecutionRepository` já suportavam o caso, faltava apenas mover *quando* `save()` era chamado. `DefaultAnalysisService` deixou de persistir (e de receber `ExecutionRepository`); `DefaultEFOSFacade` passou a receber `ExecutionRepository` via construtor e, depois de `reportService.generateReport(execution)` retornar, monta `ExecutionSnapshot { metadata: analysisResult.value.metadata, execution: analysisResult.value.execution, report }` — todos os três campos reaproveitados por referência, nenhum copiado ou recalculado — e chama `executionRepository.save(snapshot)` **uma única vez**, já com o relatório presente. Se `save()` rejeitar, o erro propaga normalmente (sem `try/catch`, sem fallback, sem retry — mesmo comportamento de D-028). Cada `analyzeCompany()` bem-sucedido continua produzindo um `ExecutionSnapshot` novo com `executionId` próprio (`randomUUID()`, dentro de `DefaultAnalysisService`, não alterado) — nenhuma sobrescrita de histórico anterior, mesma convenção de identificação já existente.

## Contrato

`EFOSFacade` (`EFOSFacade.ts`) tem **um único método público**:

```ts
analyzeCompany(request: AnalyzeCompanyRequest, documents?: readonly RawFinancialDocument[]): Promise<ApplicationResult<ExecutiveReport>>
```

Não estende `ApplicationService` (`efos/application/contracts/ApplicationService.ts`) — a Facade é um conceito próprio (ponto de entrada da camada), não mais um Service coordenado por outra peça; não carrega o campo `name` que `ApplicationService` exige. A assinatura pública não mudou com a Mission 066 — apenas o construtor de `DefaultEFOSFacade` ganhou um terceiro parâmetro.

## `DefaultEFOSFacade`

Primeira implementação concreta. Recebe `AnalysisService`, `ReportService` e, desde a Mission 066, `ExecutionRepository` via construtor — inversão de dependência, nunca instanciados internamente (`DefaultEFOSFacade` nunca importa `DefaultAnalysisService`/`DefaultReportService`/`SupabaseExecutionRepository`, só os contratos). Quem compõe a Facade (`DefaultEFOSContainer`, `efos/application/composition/`) decide quais implementações concretas injetar.

## Por que `AnalysisService.analyze()` precisou expor `PipelineExecution` (D-020)

Antes desta missão, `AnalysisService.analyze()` (D-018, Mission 021) retornava apenas `ApplicationResult<AnalyzeCompanyResponse>` — o placeholder `{ companyId }`, sem `PipelineExecution`. O fluxo exigido por esta missão (`AnalysisService → PipelineExecution → ReportService`) e a restrição explícita de que a Facade nunca aciona o Orchestrator diretamente exigiam que `PipelineExecution` saísse de algum lugar dentro de `AnalysisService`, já que é o único ponto que aciona o Orchestrator. `AnalysisService.analyze()` foi revisado para `Promise<ApplicationResult<{ response: AnalyzeCompanyResponse; execution: PipelineExecution }>>` — mesmo padrão de composição já usado por `PipelineResult` (`{ metadata, execution }`, D-017): um objeto literal reaproveitando tipos já oficiais (`AnalyzeCompanyResponse`, `PipelineExecution`), nenhum DTO novo criado. Ver D-020, `docs/DECISIONS.md`.

## Dependências permitidas

- `efos/application/contracts` (`ApplicationResult`).
- `efos/application/dto` (`AnalyzeCompanyRequest`).
- `efos/application/report` (`ExecutiveReport`) — apenas por tipo.
- `efos/application/services` (`AnalysisService`, `ReportService`) — apenas os contratos, nunca `DefaultAnalysisService`/`DefaultReportService` diretamente.
- `efos/application/persistence` (`ExecutionRepository`, `ExecutionSnapshot`) — desde a Mission 066, via injeção de dependência (nunca uma implementação concreta diretamente).
- `@/efos/engines/data` (`RawFinancialDocument`) — apenas por tipo, para o parâmetro `documents` de `analyzeCompany()` (Mission 044).
- `efos/application/history` (`HistoricalExecutionService`, `compareExecutions`, `toHistoricalExecution`) — desde a Mission 173, via injeção de dependência (nunca `DefaultHistoricalExecutionService`/repositório concreto diretamente).
- `efos/application/executive-context` (`buildExecutiveFinancialContext`, `ExecutiveFinancialContext`) — desde a Mission 173, apenas a função de composição pura já existente, nunca uma segunda implementação.
- `@/efos/engines/evidence` (`periodOf`) — desde a Mission 173, reaproveitado sem duplicação.
- `efos/application/history` (`buildCanonicalPriorPeriods`) — desde a Mission 174, função pura, chamada dentro de `runAnalysisAndPersist()`.

## Mission 174 — Production Temporal Evidence Input

Fecha a lacuna documentada pela Mission 173 (ver abaixo). `runAnalysisAndPersist()`
(lógica compartilhada por `analyzeCompany()`/`analyzeCompanyWithExecutiveContext()`)
agora busca `historicalExecutionService.getHistory(companyId)` ANTES de
rodar a análise, canonicaliza via `buildCanonicalPriorPeriods()`
(`efos/application/history/`) e repassa o resultado a
`AnalysisService.analyze(request, documents, priorPeriods)` — primeira
mudança de comportamento OBSERVÁVEL de `analyzeCompany()` desde a
Mission 173. `analyzeCompanyWithExecutiveContext()` continua buscando o
histórico uma SEGUNDA vez depois de persistir (Mission 173, inalterado)
— as duas janelas são estruturalmente diferentes (excluindo vs.
incluindo a execução atual); a ineficiência de dupla busca foi aceita
conscientemente em nome de clareza. `buildCanonicalPriorPeriods()`
devolvendo `undefined` (histórico ambíguo) nunca bloqueia a análise —
`priorPeriods` é simplesmente omitido, produzindo apenas Evidence
absoluta, o mesmo comportamento de antes desta missão. Ver
`docs/ENGINEERING_LOG.md`, Mission 174, para o registro completo.

**Mission 174 Fix — Fail-Closed Prior-Period Canonicalization.**
`runAnalysisAndPersist()` em si não mudou — a correção foi inteira
dentro de `buildCanonicalPriorPeriods()` (ver
`efos/application/history/README.md`). Antes da Fix, uma execução
malformada da MESMA empresa (sem `financialModel`/`indicators`) era
excluída em silêncio, exatamente como uma execução de outra empresa —
podendo produzir um `priorPeriods` que aparentava uma sequência
contínua quando, na verdade, existia uma lacuna real e desconhecida
entre dois períodos válidos. Agora qualquer execução relevante e
não-posicionável faz `buildCanonicalPriorPeriods()` devolver
`undefined` (fail closed) — `runAnalysisAndPersist()` continua
tratando `undefined` exatamente como antes (prossegue sem
`priorPeriods`), nenhuma mudança de comportamento neste arquivo. Ver
`docs/ENGINEERING_LOG.md`, Mission 174 Fix, para o registro completo.

## Mission 175 — Production Executive Analysis API

`analyzeCompanyWithExecutiveContext()` em si não mudou — passou a ser
alcançável via `POST /api/efos/analyze/[companyId]/executive`
(`efos/platform/EFOSPlatform.ts`, novo método aditivo simétrico), mas
esta missão encontrou e corrigiu um defeito adversarial dentro de
`runAnalysisAndPersist()`: reanalisar uma empresa para um período
FINANCEIRO idêntico a uma execução já persistida (ex.: reenviar um
documento corrigido para um mês já analisado) fazia `evidence.
validator.ts` (Mission 166) rejeitar a chamada INTEIRA do Evidence
Engine por sobreposição entre `priorPeriods` e o período que a
execução ATUAL descreve — período esse que só é conhecido DEPOIS que
Financial Model/Indicators já rodaram dentro do próprio pipeline,
tarde demais para `buildCanonicalPriorPeriods()` (chamada ANTES da
análise) já ter excluído. A falha do Evidence Engine derrubava
`runAnalysisAndPersist()` inteiro — Data/Financial Model/Indicators/
Report/persistência perdidos, não apenas Evidence temporal. **Defeito
pré-existente desde a Mission 174**, também presente em
`analyzeCompany()` (rota já em produção), nunca exercitado por nenhum
teste da série 166-174 (todos usaram períodos distintos por
execução). **Correção original desta missão** (retry sem
`priorPeriods` após falha) **foi removida e substituída pela Mission
175R** — ver seção abaixo — por poder mascarar falha genuína de
Engine como se fosse ambiguidade de histórico. Ver
`docs/ENGINEERING_LOG.md`, Mission 175, para o registro completo.

## Mission 175R — Reanalysis Safety & Temporal Degradation Closure

Substitui o retry amplo da Mission 175 por uma exclusão ESTRUTURAL,
aplicada dentro de `EFOSPipelineRuntime` (estágio `"evidence"`, ver
`efos/application/orchestrators/README.md`) — nunca aqui em
`runAnalysisAndPersist()`, que voltou à forma direta original: uma
única chamada a `analysisService.analyze()`, propagação direta de
qualquer falha, nenhuma tentativa de recuperação. `restrictToPeriodsStrictlyBeforeCurrent()`
(novo helper no Runtime) filtra `priorPeriods` para manter só
períodos ESTRITAMENTE anteriores ao período que a execução atual
descreve — usando exclusivamente `Period.startDate`/`endDate`
(cronologia financeira, D-090), nunca `executedAt`/ordem de
execução — no exato momento em que o período atual já é conhecido
(logo depois do Indicators Engine rodar, dentro do MESMO pipeline).
Uma execução histórica de mesmo período (reanálise) ou de período
FUTURO nunca chega a ser oferecida como `priorPeriod`, então
`evidence.validator.ts` nunca tem motivo para rejeitar a chamada
inteira — o cenário que motivava o retry deixou de ocorrer, e o
retry foi removido por completo (nunca há uma segunda chamada a
`analysisService.analyze()` para a mesma requisição, comprovado por
teste). Um segundo defeito adversarial, descoberto ao validar esta
correção, também foi fechado em `buildCanonicalPriorPeriods()` (ver
`efos/application/history/README.md`) — a comparação de "duplicata
equivalente" usava timestamps de auditoria não-determinísticos,
tornando esse colapso inalcançável em produção genuína. **D-090
registrada** — formaliza que o contrato de entrada de Evidence
temporal (cronologia estrita) é deliberadamente distinto do contrato
de histórico de Financial Episode Intelligence (D-088/D-089, que
preserva conflitos de mesmo período no histórico completo,
resolvendo para `NOT_DETERMINABLE`) — `buildExecutiveContext()`
(abaixo) nunca é afetado por este filtro, comprovado por teste. Ver
`docs/ENGINEERING_LOG.md`, Mission 175R, para o registro completo.

## Mission 173 — Production Executive Financial Context Orchestrator

`analyzeCompany()` permanece byte a byte inalterado. Novo método
ADITIVO `analyzeCompanyWithExecutiveContext()` roda a MESMA análise e,
adicionalmente, compõe o `ExecutiveFinancialContext` (com
`financialEpisodes`, Mission 171/172) a partir do histórico comparável
COMPLETO da empresa (D-089) — nunca truncado, buscado via
`historicalExecutionService.getHistory()` (4º parâmetro de construtor,
Mission 085) DEPOIS que a execução atual já foi persistida (Caso A:
leitura após escrita já garante que a execução atual está no
histórico buscado — nunca apensada uma segunda vez). `currentExecutionId`
é sempre `execution.pipelineContext.executionId`, nunca inferido do
histórico. `DefaultEFOSContainer` monta `historicalExecutionService`
internamente a partir do MESMO `executionRepository` já recebido —
assinatura pública do Container inalterada.

**Achado crítico documentado por esta missão, fechado pela Mission 174**:
`EFOSPipelineOrchestrator`/`EFOSPipelineRuntime` nunca passava
`priorPeriods` para `EvidenceEngine` — Evidence temporal (D-087) nunca
era produzida por uma execução de produção real. Ver "Mission 174 —
Production Temporal Evidence Input" acima para como essa lacuna foi
fechada. Ver `docs/ENGINEERING_LOG.md`, Mission 173, para o registro
completo desta missão.

## Dependências proibidas

- **Engines** (`efos/engines/*`) — a Facade nunca executa um Engine.
- **Orchestrator/Runtime** (`EFOSPipelineOrchestrator`, `EFOSPipelineRuntime`) — a Facade nunca os conhece; só `AnalysisService` os conhece.
- **Implementações concretas de Service/Repository** (`DefaultAnalysisService`, `DefaultReportService`, `SupabaseExecutionRepository`) — a Facade depende só dos contratos, recebidos via construtor.
- **Domain** (`efos/domain`) — a Facade nunca importa entidades/agregados diretamente.
- **HTTP/API/Controllers/Next.js/React/Supabase/Banco** — mesma restrição de toda a Application Layer (`efos/application/README.md`); mesmo tendo `ExecutionRepository` como dependência, a Facade nunca conhece a implementação concreta (Supabase) por trás dele.
