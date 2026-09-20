# Application Layer — Historical Financial Intelligence

Status: **implementado (Mission 085 — Historical Financial Intelligence / Multi-Period Execution).** Primeira capacidade multi-período do EFOS — transforma o histórico de `ExecutionSnapshot`s já persistidos (`efos/application/persistence/`, Mission 027/035) numa visão histórica ordenada e numa comparação estrutural entre duas execuções. Não é Forecast, não é Hypothesis, não é Scenario — apenas a fundação sobre a qual essas capacidades futuras poderiam ser construídas.

## Objetivo

Responder estruturalmente a perguntas que exigem mais de uma execução — "quais execuções essa empresa tem?", "em que ordem?", "o que mudou entre duas delas?" — sem criar uma segunda persistência, sem recalcular nenhuma demonstração financeira, e sem inventar causalidade/hipótese/previsão.

## Fonte oficial do histórico

`ExecutionRepository.findByCompany(companyId)` (Mission 027/035) já é suficiente — devolve todos os `ExecutionSnapshot`s de uma empresa, sem paginação. Este módulo **não cria uma segunda tabela nem uma segunda persistência**: `public.executions` (Migration 006, D-027) continua a única fonte de verdade. `findByCompany()` não ordena (o contrato `PersistenceQuery`, Mission 031, não tem campo de ordenação) — a ordenação acontece inteiramente aqui, na Application Layer, nunca no Repository/Infrastructure.

## Critério temporal

`HistoricalExecution.executedAt` é lido de `ExecutionSnapshot.metadata.startedAt` (`PipelineMetadata`, Mission 020B) — o único campo temporal oficial de uma execução (quando o `EFOSPipelineRuntime` de fato começou a rodar). Nenhuma data nova foi inventada; `PipelineContext.timestamp` (quando a requisição foi montada, antes de `execute()` iniciar) e `created_at` de `public.executions` (quando a linha foi inserida no banco, depois de `execute()` terminar) também existiam como candidatos, mas `metadata.startedAt` é o marcador mais próximo do "quando esta análise de fato rodou" e já é o campo que `PipelineMetadata` reserva exatamente para esse papel.

## `HistoricalExecution` — por que uma visão, não uma segunda cópia

`HistoricalExecution { executionId, companyId, executedAt, report?, snapshot }` existe apenas para não obrigar todo consumidor a navegar `snapshot.execution.pipelineContext.executionId`/`snapshot.metadata.startedAt` repetidamente. **Não é uma segunda representação de `ExecutionSnapshot`** — `snapshot` preserva a referência completa e original (nunca copiada, nunca mutada); `executionId`/`companyId`/`executedAt`/`report` são apenas os mesmos valores já existentes dentro dele, extraídos para acesso direto.

## `HistoricalExecutionService`/`DefaultHistoricalExecutionService`

Único método público: `getHistory(companyId): Promise<readonly HistoricalExecution[]>`. Fluxo: `ExecutionRepository.findByCompany(companyId)` → mapear cada `ExecutionSnapshot` para `HistoricalExecution` → ordenar por `executedAt` crescente (desempate determinístico por `executionId`, string, quando duas execuções têm o mesmo `startedAt`). Empresa sem execuções devolve `[]`, nunca `undefined`. Nunca mistura execuções de empresas diferentes — `findByCompany()` já filtra por `companyId` (RLS na implementação real), e este serviço nunca combina o resultado de duas chamadas.

## `previous`/`current`

Este módulo não decide sozinho quem é "previous" e quem é "current" para um consumidor futuro — `getHistory()` devolve a lista ordenada completa (mais antiga primeiro); um consumidor decide o par que quer comparar (tipicamente os dois últimos elementos do array para "a execução mais recente vs. a anterior imediata", mas o contrato permite comparar quaisquer duas). `compareExecutions(previous, current)` recebe explicitamente os dois `HistoricalExecution`s já escolhidos — nunca infere sozinho qual é qual, além de validar que pertencem à mesma empresa (lança se `companyId` divergir, para nunca comparar execuções de empresas diferentes silenciosamente).

## Comparação estrutural (`compareExecutions`)

Função pura, sem I/O. Para cada `Indicator.name` presente na seção `"indicators"` (`IndicatorsAggregate`, a lista completa e não filtrada já produzida pelo Indicators Engine) de `previous` e/ou `current`:

- presente nos dois → `change = currentValue - previousValue`, `direction` = `"increased"`/`"decreased"`/`"unchanged"` por comparação numérica simples;
- presente em apenas um dos dois (ou `report`/seção `"indicators"` ausente de um dos lados) → `direction: "not-comparable"`, o valor ausente nunca é inventado como `0`.

Nenhum cálculo financeiro novo — apenas subtração/comparação sobre valores já calculados pelo Indicators Engine em execuções passadas. `ExecutionComparison` sempre carrega `previousExecutionId`/`currentExecutionId`/`companyId` — toda mudança identificada é rastreável até a execução de origem, mesmo quando `metrics: []` (nenhum indicador comparável).

## `buildCanonicalPriorPeriods()` — Mission 174, Production Temporal Evidence Input

Transforma `HistoricalExecution[]` (já produzido por `getHistory()`) em `readonly EvidenceHistoricalPeriod[] | undefined` — a entrada canônica que `EvidenceEngine` aceita desde a Mission 166 (D-087, `{financialModel, indicators}`, exatamente e apenas esses dois campos). Auditoria obrigatória (Mission 174, condição de parada avaliada primeiro) confirmou por leitura de código que ambos os campos são **DIRECTLY_AVAILABLE** dentro de `HistoricalExecution.snapshot.execution` — nenhuma fabricação, nenhuma reconstrução a partir de `ExecutiveReport`/saída downstream.

Existe como pré-flight, nunca repassando `history` direto ao Engine: o validador já existente de `priorPeriods` (`efos/engines/evidence/evidence.validator.ts`, Mission 166) rejeita a chamada INTEIRA do `EvidenceEngine.execute()` diante de períodos duplicados/fora de ordem/sobrepostos — diferente do fail-closed por métrica de `deriveFinancialEpisodeState()` (Mission 171), uma falha aqui perderia a execução INTEIRA do pipeline (Data, Financial Model, Indicators também), não apenas Evidence temporal. Esta função garante a validade ANTES de chegar lá.

**Classificação de cada execução do histórico (Mission 174 Fix — Fail-Closed Prior-Period Canonicalization), nunca um union público novo — o invariante é comportamental:**

- **IRRELEVANT** — `companyId` diferente do alvo. A fronteira de empresa é o único dado necessário para essa decisão (D-001: um único `FinancialModel` por empresa, id determinístico a partir de `companyId`) — nunca `financialModelId`/Period/`executedAt`/conteúdo de relatório. Excluída em silêncio, com segurança: uma execução de outra empresa nunca poderia pertencer à sequência comparável desta.
- **RELEVANT_BUT_UNUSABLE** — mesma empresa, mas sem `financialModel`/`indicators` (execução malformada/incompleta, ex.: interrompida antes do Financial Model Engine rodar) ou sem período extraível. **Nunca excluída em silêncio** (defeito corrigido pela Mission 174 Fix — a versão original desta função a descartava exatamente como se fosse IRRELEVANT, podendo fabricar continuidade temporal falsa através de uma lacuna real e desconhecida): a mera presença de UMA execução nesta categoria torna o resultado inteiro `undefined`.
- **CONFLICTING** — mesma empresa, dado utilizável, mas em conflito real com outra execução utilizável: `financialModelId` divergente (nunca esperado sob D-001 para a mesma empresa, mas nunca assumido), mesmo período com `Indicator`s materialmente diferentes, ou sobreposição de períodos. Resolve para `undefined` — comportamento pré-existente desde a Mission 174, preservado sem alteração pela Fix.
- **VALID_COMPARABLE** — mesma empresa, dado completo, período extraível, sem conflito. Único grupo que compõe o resultado.

`undefined` significa "existe histórico relevante, mas nenhuma sequência canonicalizável com segurança" — o chamador (`DefaultEFOSFacade`) prossegue SEM `priorPeriods` (apenas Evidence absoluta), nunca bloqueando a análise inteira. Distinto de `[]`, que significa "a busca teve sucesso e não há, de fato, nenhuma execução relevante" (histórico vazio, ou toda execução encontrada era de outra empresa) — `[]` nunca é devolvido quando existe uma execução RELEVANTE que não pôde ser canonicalizada. Falha de infraestrutura (`ExecutionRepository`/`HistoricalExecutionService` lançando exceção ANTES desta função ser chamada) é uma terceira categoria, estruturalmente distinta das duas anteriores — propaga como exceção real, nunca chega a esta função.

**Comparação de equivalência entre duplicatas do mesmo período (Mission 175R — achado adversarial).** A versão original comparava `JSON.stringify(indicators.indicators)` completo — cada `Indicator` carrega `audit.createdAt`/`updatedAt` (timestamp real de cálculo, `DomainEntity`) e `sourceRecordIds` (proveniência), nenhum dos dois idêntico entre duas execuções reais mesmo quando os valores financeiros são idênticos. Isso tornava "duplicata equivalente colapsa" inalcançável em produção genuína — só era observado em testes unitários com `audit` fixado num literal idêntico. Corrigido com `financialValueFingerprint()`: compara exclusivamente `{name, result}` de cada `Indicator` (a própria afirmação financeira), ordenado por `name` — nunca proveniência/timestamp de cálculo. Reanálise do MESMO período que a execução ATUAL descreve nunca chega a este ponto de comparação: é excluída de `priorPeriods` estruturalmente, mais cedo, por `EFOSPipelineRuntime` (`restrictToPeriodsStrictlyBeforeCurrent()`, D-090, ver `efos/application/orchestrators/README.md`) — esta comparação de equivalência resolve apenas conflitos entre execuções HISTÓRICAS do mesmo período antigo, nunca entre uma histórica e a atual.

Consumida por `DefaultEFOSFacade.runAnalysisAndPersist()`, que busca `getHistory(companyId)` ANTES de rodar a análise e repassa o resultado canonicalizado a `AnalysisService.analyze()` — que o transporta até `EvidenceEngine` através do mesmo mecanismo `context.metadata` já usado para `documents` desde a Mission 044 (D-016), nunca um parâmetro novo em `EFOSPipelineOrchestrator.execute()`.

## Limitações atuais

- **Consumida diretamente por `DefaultEFOSFacade` desde as Missions 173/174** — `getHistory()` alimenta tanto `ExecutiveFinancialContext` (Mission 173, buscado após persistir) quanto `EvidenceHistoricalPeriod`/`priorPeriods` (Mission 174, buscado antes de rodar a análise, via `buildCanonicalPriorPeriods()`); nenhum endpoint HTTP nem UI consome este módulo diretamente ainda.
- **Comparação restrita à seção `"indicators"`** — não compara Balanço/DRE/Fluxo de Caixa diretamente (registros identificados por `label` livre, não por um nome estável como `Indicator.name`); comparar demonstrações financeiras registro a registro exigiria um critério de correspondência entre períodos ainda não definido.
- **Sem Forecast, sem Hypothesis, sem Scenario, sem causalidade** — deliberadamente fora de escopo desta missão; `compareExecutions()` nunca produz uma predição, nunca explica *por que* uma métrica mudou, apenas *que* ela mudou e *em que direção*.
- **Comparação par a par, não série completa** — `compareExecutions()` compara exatamente duas execuções; comparar N execuções (tendência ao longo do tempo) exigiria uma capacidade adicional, não implementada aqui.

## Dependências permitidas

- `efos/application/persistence` (`ExecutionRepository`, `ExecutionSnapshot`) — apenas por tipo/contrato, mesmo Port já oficial.
- `efos/application/report` (`ExecutiveReport`) — apenas por tipo.
- `efos/domain` (`Indicator`) — apenas por tipo.

## Dependências proibidas

- **Engines** — nenhum Engine é executado; nenhum dado é recalculado.
- **Infraestrutura concreta (Supabase, banco, HTTP)** — este módulo é puro do lado da Application Layer; a implementação real de `ExecutionRepository` (`SupabaseExecutionRepository`) é injetada via construtor, nunca instanciada aqui.
- **Hypothesis, Forecast, Scenario, causalidade** — nenhum desses conceitos é criado ou referenciado por este módulo.
