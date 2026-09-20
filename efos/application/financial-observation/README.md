# Outcome Measurement & Financial Feedback Correlation (Mission 139)

## Objetivo

Responder, pela primeira vez de forma estruturada, "o que aconteceu com a Financial Truth depois de uma decisão?":

```
Decision (Mission 137)
    ↓
DecisionExecutionEvent (Mission 138, log de eventos imutável)
    ↓
Outcome humano (Mission 138, D-011 ativado)
    ↓
Financial Truth Comparison (este módulo — reaproveita compareExecutions(), D-045/D-046)
    ↓
Observed Financial Change (FinancialOutcomeObservation)
```

## Princípio central: Correlation ≠ Causation

`FinancialCorrelationClassification` (`FinancialOutcomeObservation.ts`) tem hoje **um único valor possível**: `"TEMPORAL_ASSOCIATION"`. Não existe `"CAUSED_BY_DECISION"` — nem como opção descartada, nem como TODO. Esta é uma garantia **estrutural**, não uma convenção de nomenclatura: o vocabulário do tipo simplesmente não contém nenhum valor que afirme causalidade. Uma futura camada de causal inference (explicitamente fora do escopo desta missão) exigiria uma decisão arquitetural própria para introduzir qualquer coisa além disso.

## Auditoria (Etapa 5 da missão) — respostas explícitas

- **Já existe conceito de comparação temporal?** Sim — `efos/application/history/` (`compareExecutions()`, `ExecutionComparison`, `MetricComparison`, `ChangeDirection`; D-045/D-046, Missions 085/086). Reaproveitado inteiramente, nunca reimplementado — este módulo só filtra (apenas direções numericamente comparáveis), renomeia (`before`/`after` em vez de `previous`/`current`) e anota (`percentageChange`, períodos) o resultado que `compareExecutions()` já produz.
- **Onde está a Financial Truth canônica?** `ExecutionRepository.findByCompany()` → `ExecutionSnapshot[]` → `DefaultHistoricalExecutionService.getHistory()` → `HistoricalExecution[]` (ordenado por `executedAt`) → `compareExecutions(baseline, observation)`.
- **O sistema possui snapshots suficientes?** Depende dos dados reais da empresa — nunca assumido. `buildFinancialOutcomeObservation()` devolve `NO_COMPARABLE_FINANCIAL_TRUTH` honestamente quando não há.
- **Qual período representa o início da observação?** `baseline` = execução mais recente com `executedAt <= decision.createdAt`; `observation` = execução mais recente com `executedAt >= executionState.completedAt` (D-070, `deriveDecisionExecutionState().completedAt`). Nunca `Outcome.observedAt` — o Outcome humano é uma camada separada (Etapa 6/12), não usado para selecionar a janela financeira.
- **Existe entidade reutilizável para mudança financeira?** `MetricComparison` (D-046) cobre quase tudo, mas não tem `percentageChange` nem período explícito por lado — `FinancialMetricObservation` é um envelope fino sobre `MetricComparison`, nunca uma reimplementação da lógica de comparação.
- **Como evitar vazamento de dado futuro?** A própria seleção da janela (`baselineExecutedAt <= decisionCreatedAt` E `observationExecutedAt >= executionCompletedAt`) torna isso estruturalmente impossível, não apenas verificado — reforçado por `validateFinancialOutcomeObservation()`.

## Por que Application, não Domain?

Mesma decisão de camada de `DiagnosisReview`/`DecisionExecutionEvent` (D-063/D-070): isto não é uma regra determinística de Engine, é uma composição de LEITURA sobre dados já existentes — nenhum agregado de Domain foi criado.

## `ObservationWindow` — nunca implícita, sempre auditável

`baselineExecutionId`/`observationExecutionId` sempre rastreáveis a uma `ExecutionSnapshot` real. `baselinePeriod`/`observationPeriod` extraídos do primeiro `Indicator` de cada execução (todos os indicadores de uma execução compartilham o mesmo período, derivado uma única vez por `derivePeriod()` no Indicators Engine).

## Persistência (D-071) — observação imutável, congelada no momento do cálculo

Ver `docs/DECISIONS.md`, D-071: uma `FinancialOutcomeObservation` bem-sucedida é persistida como registro imutável (`public.financial_observations`) — nunca recalculada silenciosamente quando novos dados financeiros chegam. Isso preserva a distinção entre "observação feita no momento T" e "Financial Truth atual" (Etapa 16 da missão), crítica para auditabilidade histórica.

## O que este módulo NÃO faz

- Não afirma causalidade — estruturalmente impossível (ver acima).
- Não interpola/estima/inventa dado financeiro ausente — `NO_COMPARABLE_FINANCIAL_TRUTH` é sempre o resultado honesto.
- Não sobrescreve `Outcome` humano nem é sobrescrito por ele — `humanOutcomeId?` é apenas uma referência opcional; as duas camadas podem concordar ou divergir livremente.
- Não é calculado pela IA — nenhum código em `efos/infrastructure/executive-ai/` referencia este módulo; a comparação é inteiramente determinística, calculada por uma Server Action acionada por um humano.
- Não recalcula/reimplementa `compareExecutions()` — reutiliza a área já fechada por D-045/D-046, nunca modificada por esta missão.

Ver `docs/DECISIONS.md`, D-071, e `docs/ENGINEERING_LOG.md`, Mission 139, para a auditoria completa e os cenários testados.
