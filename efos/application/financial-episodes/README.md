# Derived Financial Episode State (Mission 171, corrigido pela Mission 171 Fix, integrado pela Mission 172)

Implementa `deriveFinancialEpisodeState()` — o mecanismo de episódio
financeiro derivado recomendado pela Mission 169 (design), formalizado
pelas Missions 170/170B/170C (design), implementado pela Mission 171,
corrigido pela Mission 171 Fix (ver "Correção — Mission 171 Fix"
abaixo), e integrado ao `ExecutiveFinancialContext` pela Mission 172
(ver "Integração — Mission 172" abaixo) — o consumidor canônico de
produção deste módulo.

## Integração — Mission 172

`buildFinancialEpisodeIntelligence(companyId, financialModelId, executions)`
deriva o episódio de TODAS as 8 métricas suportadas, na ordem estável
de `TEMPORAL_METRIC_DEFINITIONS`, e é o único ponto de entrada usado
por `buildExecutiveFinancialContext()` (`efos/application/executive-context/`)
para popular `ExecutiveFinancialContext.financialEpisodes?`. `context`
é embutido por referência em `ExecutiveAIInstruction` (Mission 117) e
serializado por cópia estrutural fiel — `financialEpisodes` chega à IA
automaticamente, sem nenhuma transformação manual.

**Política de janela histórica — CORRIGIDA pela Mission 172 Fix, registrada em D-089**:
esta função e `deriveFinancialEpisodeState()` NUNCA buscam seu próprio
histórico — mas isso NUNCA significou "qualquer subconjunto que o
chamador passar é válido". `executions` deve conter **TODAS as
execuções comparáveis do `FinancialModel` atual** — o chamador pode
(e deve) excluir execuções de outra empresa/`financialModelId`
(irrelevantes por definição), mas NUNCA truncar arbitrariamente o
histórico comparável restante. Demonstrado concretamente (Mission 172
Fix, testes `Fix-11`/`Fix-12`): a mesma sequência real
`adverso→adverso→nenhum sinal→melhora→melhora→adverso` produz
`CONTINUING_DETERIORATION` (correto) com histórico completo e
`NEW_DETERIORATION` (falso) se as duas primeiras observações adversas
forem removidas — nenhum erro de type-check/lint/build/regressão
detectaria essa inversão, porque ambos os resultados são
estruturalmente válidos. Uma execução malformada antiga dentro do
histórico comparável pode legitimamente produzir
`NOT_DETERMINABLE`/`MISSING_EXECUTION` — conservador e honesto (Mission
171 Fix), nunca uma razão para excluí-la. Esta é uma OBRIGAÇÃO
CONTRATUAL do chamador — nenhuma função pura aqui tem acesso ao
repositório para verificar em runtime que recebeu de fato todo o
histórico comparável. Ver D-089 (`docs/DECISIONS.md`).

**Identidade exata da execução atual — Mission 172 Fix**:
`buildExecutiveFinancialContext()` exige `currentExecutionId` sempre
que `executions` é fornecido — identifica, por `executionId`
(`HistoricalExecution.executionId`, Mission 085), qual execução
produziu os agregados do contexto. Nunca inferido apenas por `Period`
(duas execuções podem legitimamente reanalisar o mesmo período,
Mission 171) — zero ou múltiplas correspondências, ou uma
correspondência de empresa/`financialModelId`/`Period` divergente,
lançam exceção explícita.

`validateFinancialEpisodes(companyId, financialModelId, episodes)`
(`validateFinancialEpisodes.ts`) valida as invariantes de um array de
`FinancialEpisodeStateResult` — disciplina defensiva, nunca uma
segunda implementação das regras de derivação (todas já garantidas
por construção pelo único caminho de produção existente).

Ver `efos/application/executive-context/README.md` para o contrato
completo de `ExecutiveFinancialContext.financialEpisodes` e
`docs/ENGINEERING_LOG.md`, Mission 172, para o registro completo.

## O que este módulo NÃO é

- Não é um novo agregado persistido. Não introduz nenhuma tabela,
  migration ou `Repository`.
- Não é uma segunda fonte de verdade sobre Evidence. Lê Evidence já
  produzida e persistida via `HistoricalExecution.report` (seções
  `"indicators"`/`"evidence"`, Mission 022/169) — nunca recalcula,
  nunca reescreve.
- Não implementa `PARTIAL_RECOVERY`/`FULL_RECOVERY`/`RECURRENCE`. Esses
  três permanecem vocabulário de domínio FUTURO (Mission 170B/D-088:
  recuperação de episódio exige uma referência de condição original
  comprovável, que a arquitetura atual não fornece sem inventar um
  parâmetro) — deliberadamente fora do tipo `FinancialEpisodeState`
  executável.

## Vocabulário de estados (fechado, 4 valores — Mission 170C, Etapa 8)

| Estado | Significado | Requer episódio aberto anterior? |
|---|---|---|
| `NEW_DETERIORATION` | Observação adversa ATUAL, comprovadamente sem episódio aberto antes | Não |
| `CONTINUING_DETERIORATION` | Observação adversa ATUAL, episódio já comprovadamente aberto | Sim |
| `SUSTAINED_IMPROVEMENT` | Tendência favorável comprovada pela própria Evidence (D-087) na observação ATUAL | Não — nunca implica recuperação/fechamento |
| `NOT_DETERMINABLE` | Dado insuficiente/conflitante/incompatível, OU a observação atual é `NONE_DETECTED` (ver "Correção — Mission 171 Fix") | — |

**Invariante fundamental (Mission 171 Fix)**: o estado retornado descreve sempre a OBSERVAÇÃO ATUAL — nunca um fato histórico isolado dela. Um episódio adverso ter existido no passado nunca é suficiente, sozinho, para classificar a observação atual como `CONTINUING_DETERIORATION` — só uma observação atual genuinamente `ADVERSE_PRESENT` pode receber esse estado.

## Vocabulário de motivos de `NOT_DETERMINABLE` (fechado, 7 valores)

As 6 primeiras vêm da Mission 170C, Etapa 9. `NO_EPISODE_SIGNAL` foi
adicionada por esta missão — ver "Adição justificada" abaixo.

| Motivo | Quando ocorre |
|---|---|
| `INSUFFICIENT_HISTORY` | Menos de 2 observações canônicas — impossível confirmar novidade/continuidade |
| `SAME_PERIOD_CONFLICT` | Duas execuções do mesmo período divergem em valor/classificação, sem semântica de revisão financeira no domínio |
| `INCOMPATIBLE_FINANCIAL_MODEL` | Uma execução na sequência pertence a outro `financialModelId`/empresa |
| `UNAVAILABLE_METRIC` | A observação mais recente não tem valor de Indicator disponível |
| `NON_COMPARABLE_PERIOD` | Dois períodos adjacentes se sobrepõem sem serem idênticos |
| `MISSING_EXECUTION` | Uma lacuna material impede provar continuidade (ex.: Fluxo de Caixa Operacional sem `financialModel.events`) |
| `NO_EPISODE_SIGNAL` | Observação atual é `NONE_DETECTED` (nenhuma Evidence de declínio/melhora) e nenhum episódio está aberto |

## A correção arquitetural central desta missão

> Incapacidade de provar fechamento de um episódio NÃO prova
> automaticamente continuidade.

`scanForOpenEpisode()` nunca assume que "o episódio nunca fecha,
logo está sempre aberto" (isso provaria continuidade por omissão,
exatamente o erro proibido). Em vez disso, varre a sequência
comparável entre a observação atual e a possível abertura anterior —
se encontrar uma lacuna material (`METRIC_UNAVAILABLE`/
`MISSING_EXECUTION`/`INCOMPATIBLE_FINANCIAL_MODEL`) no caminho, o
resultado é `NOT_DETERMINABLE`, nunca `CONTINUING_DETERIORATION`
(continuidade não provada) nem `NEW_DETERIORATION` (novidade também
não provada — poderia haver um episódio escondido do outro lado da
lacuna).

```
adverso → melhora sustentada → adverso   (sem lacuna) => CONTINUING_DETERIORATION
adverso → lacuna material     → adverso  (com lacuna) => NOT_DETERMINABLE
```

`NONE_DETECTED` (Evidence real ausente, mas período observado e
comparável) NUNCA é tratado como lacuna — é atravessado livremente
pela varredura, porque "nenhuma detecção" nunca significa "recuperado"
(Mission 170, Etapa 4) nem quebra a cadeia de continuidade.

## Identidade do episódio

`(companyId, financialModelId, metricKey)` — sempre metric-specific
(Mission 170, Etapa 3). `episodeKey = metricKey`. `metricKey` deve ser
uma das 8 chaves de `TEMPORAL_METRIC_DEFINITIONS` (D-087,
`efos/engines/evidence`): `gross-margin`, `operating-margin`,
`net-margin`, `current-liquidity`, `quick-liquidity`,
`immediate-liquidity`, `average-receipt-period`,
`operating-cash-flow`.

## Cronologia: sempre financeira, nunca de execução (D-088)

Toda ordenação usa `Indicator.period` (via `periodOf()`, já existente
desde a Mission 166) — `executedAt` nunca é lido para nenhuma decisão
de valor/ordem/verdade financeira. `executedAt` só é usado como
critério de desempate DEPOIS de duas observações do mesmo período já
terem sido provadas equivalentes (a escolha entre elas é
inconsequente, pois o conteúdo já é idêntico).

## Same-period canonicalization

Equivalência é sempre metric-local: mesmo valor extraído + mesma
classificação de observação. Nunca compara Evidence/Indicators não
relacionados, nunca exige igualdade do relatório inteiro. Um único
período conflitante torna a derivação inteira `NOT_DETERMINABLE` —
decisão de design: continuidade não pode ser provada através de um
elo não confiável na cadeia.

## Diferenças em relação a `deriveKnowledgeState()`

Mesmo espírito (função pura, nunca persistida, sempre recomputada sob
demanda, vocabulário fechado, `rationale`/`determinabilityReason`
sempre explicando o resultado) — mas os domínios divergem:
`deriveKnowledgeState()` deriva de um histórico de AVALIAÇÕES já
timestampadas e identificadas (`TimestampedKnowledgeEvaluation[]`,
formato plano); `deriveFinancialEpisodeState()` deriva de execuções
completas (`HistoricalExecution[]`) das quais precisa EXTRAIR
observações por métrica — exige canonicalização de mesmo período,
detecção de sobreposição e um algoritmo de varredura de continuidade
que `deriveKnowledgeState()` nunca precisou (o histórico de avaliações
já chega pronto, sem esses problemas).

## Não duplicação

`TEMPORAL_METRIC_DEFINITIONS`/`TemporalMetricDefinition`/
`TemporalSnapshot`/`TemporalMetricValue`/`MetricDirectionality`
(D-087, `efos/engines/evidence/evidence.temporal.builder.ts`) e
`periodOf()` (`evidence.validator.ts`) são reaproveitados integralmente
via `@/efos/engines/evidence` — nenhuma segunda tabela de métricas,
nenhuma segunda extração de período foi criada.

## Correção — Mission 171 Fix

Revisão arquitetural final sobre a Mission 171 encontrou 2 defeitos de
implementação (não de design — D-087/D-088 permanecem corretos),
ambos corrigidos:

1. **`NONE_DETECTED` podia herdar `CONTINUING_DETERIORATION` de um
   episódio histórico.** O código original chamava
   `scanForOpenEpisode()` também quando a observação atual era
   `NONE_DETECTED`, e retornava `CONTINUING_DETERIORATION` sempre que
   um episódio aberto era encontrado — sem checar se a observação
   ATUAL era de fato adversa. Corrigido: `current.classification ===
   "NONE_DETECTED"` agora retorna `NOT_DETERMINABLE`/`NO_EPISODE_SIGNAL`
   IMEDIATAMENTE, sem nunca varrer o histórico — `scanForOpenEpisode()`
   só é chamado quando a observação atual já é `ADVERSE_PRESENT`.
   Confirmado como bug real (não apenas teórico) por validação
   sintética: AUREA/Liquidez Seca mudou de `CONTINUING_DETERIORATION`
   (incorreto) para `NOT_DETERMINABLE`/`NO_EPISODE_SIGNAL` (correto)
   com o MESMO dado real, sem nenhuma alteração de fixture.
2. **Execuções malformadas da mesma empresa eram excluídas
   silenciosamente**, o que podia fabricar continuidade através de uma
   lacuna real e desconhecida (ex.: uma execução malformada entre duas
   observações adversas resultava em `CONTINUING_DETERIORATION`
   erroneamente). Corrigido: uma execução da MESMA empresa sem
   `Period` extraível (`"unpositionable"`, tipo `ExtractedExecution`)
   NUNCA é descartada — sua mera presença torna a derivação inteira
   `NOT_DETERMINABLE`/`MISSING_EXECUTION`, com a MAIOR precedência de
   todas as checagens (antes até de `SAME_PERIOD_CONFLICT`). Execuções
   de OUTRA empresa (`"irrelevant"`) continuam excluídas sem rastro —
   comportamento correto, inalterado.

**Precedência determinística final** (mais para menos severo): execução
relevante não-posicionável (`MISSING_EXECUTION` global) → conflito de
mesmo período (`SAME_PERIOD_CONFLICT`) → sobreposição de período
(`NON_COMPARABLE_PERIOD`) → sequência vazia (`INSUFFICIENT_HISTORY`) →
classificação da observação mais recente.

**Auditoria de `FAVORABLE_PRESENT`, sem mudança necessária.**
Confirmado que a classificação já usava o id EXATO da regra de melhora
sustentada (`evidence-{financialModelId}-{metricKey}-sustained-improvement`),
nunca `Evidence.type === "positive"` genérico — comportamento já
correto desde a Mission 171 original, apenas verificado e testado
explicitamente por este Fix.

## Limitações conhecidas

- Sem metadado de versão de regra (D-088), uma janela que atravesse
  uma mudança real de `TEMPORAL_METRIC_DEFINITIONS` não é detectada —
  risco herdado das Missions 170/170B, não introduzido nem mitigado
  aqui.
- Nenhuma das 3 empresas sintéticas (AUREA/ORION/NEXUS) contém hoje um
  ciclo declínio→recuperação→recorrência completo — necessário apenas
  quando/se `PARTIAL_RECOVERY`/`FULL_RECOVERY`/`RECURRENCE` forem
  formalmente aprovados e implementados no futuro.
