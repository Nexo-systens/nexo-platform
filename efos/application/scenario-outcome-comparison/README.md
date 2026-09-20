# Expected vs Actual Decision Intelligence (Mission 185, revisada pela Mission 185 Closure)

## Objetivo

Responder, para uma `Decision` originada de Scenario Lab (D-094/D-095/D-096), "o que se esperava e o que foi de fato observado depois?" — sempre observacional, nunca causal.

```
Baseline (B)          Expected (E)             Observed (O)
verdade financeira     META modelada             depende de `basis`:
no momento da           (nunca uma previsão de    "live"   → verdade financeira
decisão                 período específico —               canônica MAIS ATUAL
(congelada dentro        o Scenario Engine é                (resolveCurrentFinancialExecution())
de ScenarioDecisionContext) de período único, D-091)  "formal" → execução ANCORADA por
                                                        FinancialOutcomeObservation.window.
                                                        observationExecutionId (Mission 139)
```

`expectedChange = E - B`, `observedChange = O - B`, `expectationGap = O - E` — três perguntas diferentes (Seção 16 da missão), nunca colapsadas numa só.

## `basis: "live" | "formal"` — Mission 185 Closure (D-098)

O Scenario Engine (D-091) é deliberadamente de PERÍODO ÚNICO — nunca modela um horizonte de previsão. Logo `expectedValue` (E) nunca é "a previsão para o período P4" — é a META/estado-alvo modelado sob a hipótese confirmada, assumida sustentada. Duas camadas, nunca fundidas:

- **`"live"`** — O é sempre a verdade financeira canônica MAIS ATUAL. Uma comparação que se atualiza a cada novo período reportado (P4 → P5 → P6...) — nunca uma avaliação final. `expectationGap` aqui é sempre uma DISTÂNCIA ATUAL, nunca um "erro de previsão".
- **`"formal"`** — O é ancorado à execução ESPECÍFICA que o executivo escolheu explicitamente ao registrar uma `FinancialOutcomeObservation` (Mission 139, D-071) — identificada por `executionId` (D-089: nunca por `Period` sozinho), congelada naquele momento, nunca substituída silenciosamente por dado mais novo depois. Só existe quando essa observação já foi registrada.

`ExpectedActualComparisonBundle { live, formal? }` é o que `resolveExpectedActualComparison()` (`modules/decisions/lib/`) devolve — `formal` é sempre `undefined` até que o executivo registre a primeira observação financeira para aquela Decision.

## Regra fundamental

Este módulo **nunca** afirma causalidade. `nature: "observational"` é um marcador estrutural fixo, mesmo princípio de `ScenarioProjection.nature: "hypothetical"` (Mission 180) e `FinancialCorrelationClassification` (Mission 139, D-071 — `"TEMPORAL_ASSOCIATION"`, nunca `"CAUSED_BY"`).

## `buildExpectedActualComparison()`

Única função exportada capaz de produzir um `ExpectedActualComparison`. Recebe:

- `decision: Decision` — de onde `readScenarioDecisionContext()` extrai o snapshot congelado (`efos/application/decision-lifecycle/`).
- `observed: ObservedFinancialTruthResolution` — já traduzido pelo CHAMADOR (`modules/decisions/lib/resolveExpectedActualComparison.ts`), seja a partir de `resolveCurrentFinancialExecution()` (`basis: "live"`) ou da execução ancorada por uma `FinancialOutcomeObservation` (`basis: "formal"`). Este módulo nunca importa de `modules/` — mesma fronteira de `efos/application/scenario-simulation/` em relação a `modules/scenarios/actions/`.
- `basis: "live" | "formal"` — nunca muda a aritmética B/E/O, apenas a linguagem anexada ao resultado (`disclaimer`/`reason`) — a força epistêmica de cada camada é genuinamente diferente.

Devolve `{outcome: "not-scenario-backed"}` quando a Decision não tem `scenarioContext` (Recommendation-based ou independente) — Expected vs Actual nunca é forçada sobre uma Decision sem expectativa financeira explícita (Seção 6).

## Elegibilidade (`ExpectedActualEligibility`)

- `"comparable"` — existe uma verdade financeira canônica, não-ambígua, cronologicamente POSTERIOR ao baseline do cenário.
- `"awaiting-observation"` — a verdade financeira mais recente ainda é do MESMO período do baseline (cobre tanto "decisão ainda não executada" quanto "executada, mas sem dado financeiro mais novo ainda" — a distinção fina de execução pertence a `DecisionExecutionStatus`, Mission 138, nunca duplicada aqui).
- `"insufficient-data"` — nenhuma verdade financeira observável existe.
- `"ambiguous-truth"` — existe mais de uma execução conflitante para o período mais recente (D-088/Mission 170C/176 Closure) — nunca escolhida arbitrariamente.

## O que este módulo NÃO faz

- Não recalcula a expectativa histórica — `scenarioContext` já é o snapshot congelado e imutável.
- Não seleciona a execução observada por `executedAt`/ordem de array — delega inteiramente a `resolveCurrentFinancialExecution()` (via o chamador).
- Não trata reanálise do MESMO período como resultado observado (Seção 25 — default nunca é "actual outcome").
- Não lê `scenarioContext.alternative` — a alternativa não escolhida numa Decision de comparação nunca é tratada como executada (Seção 33).
- Não persiste nada — sempre derivada, recalculada a cada leitura (Seção 29).
- Não cria Recommendation/Outcome/Evidence/Learning/Knowledge.
- Não chama IA/Anthropic.

Ver `docs/DECISIONS.md` e `docs/ENGINEERING_LOG.md`, Mission 185, para a auditoria completa.
