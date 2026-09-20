# Executive Financial Context (Mission 114)

## Objetivo

Contrato canônico e independente de UI que consolida tudo que o EFOS já sabe
sobre uma empresa, numa única execução, no formato que uma futura Executive
AI consumiria — nunca a própria IA, nunca um "Executive Diagnosis" (fora de
escopo).

## Por que não `ExecutiveReport`?

`ExecutiveReport` (`efos/application/report/`) é uma estrutura pensada para
**renderização** (Mission 022/065/081): `ExecutiveReportSection` carrega
`title: string` — um rótulo de interface — em toda variante, é organizada
como um array ordenado (pensado para exibição sequencial), nunca inclui
`ExecutionComparison` (histórico é uma resposta HTTP inteiramente separada)
e não tem nenhuma representação de `unknowns`/`conflicts`. Confirmado por
auditoria (Mission 114, Etapa 3): não é o mesmo contrato, não pode ser
reaproveitado sem alteração — mas `buildExecutiveFinancialContext()` também
nunca duplica dado: consome os mesmos agregados que `ExecutiveReport` já
consome, apenas reagrupados em formato estável e neutro (Mission 114, Etapa
12).

## O que este módulo NÃO faz

- Não integra nenhuma IA/LLM.
- Não implementa detecção de conflitos (`ExecutiveConflict[]` é sempre `[]`
  — exigiria uma nova Context Rule, fora de escopo).
- Não classifica a razão específica de cada `Unknown` (`UnknownReason` é
  sempre `"UNKNOWN_CAUSE"` — `IndicatorResult` não carrega essa distinção
  como dado hoje, D-052).
- Não recalcula nenhuma fórmula, nenhum indicador, nenhuma Evidence/Context/
  Recommendation.

Ver `docs/DECISIONS.md`, D-058, e `docs/ENGINEERING_LOG.md`, Mission 114,
para a auditoria completa e os 10 cenários testados.

## `financialEpisodes` (Mission 172, corrigido pela Mission 172 Fix)

Campo opcional `readonly FinancialEpisodeStateResult[]`
(`efos/application/financial-episodes/`, Mission 171/171 Fix) — um
resultado por métrica suportada por D-087, incluído por
`buildExecutiveFinancialContext()` quando o chamador fornece
`executions?: readonly HistoricalExecution[]` **e**
`currentExecutionId: string` (Mission 172 Fix — exigido sempre que
`executions` é fornecido, identifica por `executionId` qual execução
produziu os agregados deste contexto; nunca inferido apenas por
`Period`, D-089). Reaproveita `FinancialEpisodeStateResult` diretamente
(nunca um tipo paralelo). Ausente quando `executions` não é fornecido
— nunca um array vazio fabricado. Inclui estados `NOT_DETERMINABLE`
explicitamente — nunca filtrados por conveniência.

**Contrato de janela histórica (D-089)**: `executions` deve conter
TODAS as execuções comparáveis do `FinancialModel` atual — nunca um
subconjunto truncado pelo chamador (apenas execuções irrelevantes de
outra empresa/modelo podem ser excluídas). Ver
`efos/application/financial-episodes/README.md`, seção "Integração —
Mission 172", para o contrato completo.
