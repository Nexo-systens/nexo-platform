# Decision Learning from Expected vs Observed (Mission 186)

Ponte entre a comparação Esperado vs. Observado, já formalmente resolvida pela Mission 185/185 Closure (`ExpectedActualComparisonBundle`, `basis: "live" | "formal"`), e o Learning Loop já existente (`LearningRecord`, D-013/D-072) — respondendo apenas "esta Decision tem, agora, uma comparação forte o bastante para fundamentar um aprendizado DURÁVEL?", nunca inferindo que a Decision causou a diferença observada.

## Por que nenhuma entidade nova foi criada

Auditoria obrigatória (Seção 1 da missão) confirmou uma arquitetura já rica, não um vazio: `LearningRecord` já tinha, desde a Mission 140 (D-072), um caminho de construção humano-acionado (`buildLearningRecord()`, `efos/application/learning-derivation/`), e o Knowledge Lifecycle inteiro (`Knowledge`/D-073, `knowledge-relevance`/D-074, `knowledge-evaluation`/Mission 145) já opera exclusivamente sobre `evidenceClassification`, nunca sobre `supportingData`. A integração podia, portanto, ser inteiramente aditiva: este módulo produz um `ExpectedActualLearningContext` que é passado a `buildLearningRecord()` como parâmetro opcional e embutido em `supportingData.expectedActualContext` — mesmo mecanismo de escape já usado por `Decision.supportingData.scenarioContext` (D-094).

## Invariante estrutural obrigatório — nunca `basis: "live"`

Uma comparação `"live"` se atualiza a cada novo período reportado (D-098) — nunca uma avaliação final. Um `LearningRecord` persistido é imutável (D-072). Fundamentar um registro imutável numa fonte que muda sozinha corromperia silenciosamente a auditabilidade do Learning Loop. `deriveExpectedActualLearningEligibility()` **nunca lê `bundle.live`** — apenas `bundle.formal`. A garantia é reforçada em duas camadas: `ExpectedActualLearningContext.basis` é um literal de tipo único (`"formal"`, impossível de atribuir `"live"` em tempo de compilação) e `LearningRecord.validator.ts` reafirma a mesma regra em tempo de execução — nunca confiando apenas na UI para esconder a opção.

## Elegibilidade

`deriveExpectedActualLearningEligibility(bundle)` recusa honestamente (`eligible: false`) quando:

- a Decision não tem `ScenarioDecisionContext` (`not-scenario-backed`) — caminho genérico de Learning (D-072) continua disponível sem alteração;
- nenhuma `FinancialOutcomeObservation` formal existe ou sua execução ancorada não é localizável (`no-formal-observation`);
- `eligibility !== "comparable"` na camada formal (`formal-not-comparable`);
- zero métricas com `status: "compared"` (`no-comparable-metrics` — disponibilidade PARCIAL continua elegível, só o caso ZERO é recusado).

Quando elegível, produz um `ExpectedActualLearningContext` — snapshot **imutável** com a cópia exata de `ExpectedActualComparison.metrics` (nunca recomputada), a proveniência (`financialObservationId`/`observationExecutionId`, D-089, via `ExpectedActualComparison.observationAnchor`, novo campo aditivo populado só por `resolveExpectedActualComparison()`) e as limitações/disclaimer já calculados pela Mission 185/185 Closure.

## Por que o snapshot precisa ser imutável (restatement)

Se o contexto financeiro fosse re-derivado dinamicamente a cada leitura, um restatement — uma nova execução do MESMO período, com uma NOVA `FinancialOutcomeObservation` formal registrada depois — mudaria silenciosamente a base factual de um aprendizado já registrado, porque `resolveExpectedActualComparison()` sempre escolhe a observação formal mais recente. Provado por teste (`test-mission186-decision-learning.ts`, Parte N): um `LearningRecord` já persistido permanece ancorado à execução/observação originais mesmo depois que uma nova observação formal é registrada — a nova avaliação corretamente reflete o novo dado, mas o Learning histórico nunca muda.

## O que este módulo NÃO faz

- Não recalcula B → E → O, variância, direcionalidade ou seleção de observação — consome exclusivamente o resultado já produzido por `efos/application/scenario-outcome-comparison/`/`resolveExpectedActualComparison()`.
- Não afirma causalidade nem classifica sucesso/fracasso — `evidenceClassification`/`title`/`description` do `LearningRecord` continuam vindo exclusivamente de `deriveEvidenceClassification()` (`Outcome.status`), inalterado por este módulo.
- Não cria Recommendation/Decision/Knowledge automaticamente.
- Não é calculada pela IA — nenhum import de `efos/infrastructure/executive-ai/`.
- Não persiste nada — função pura; a persistência continua sendo `saveLearningRecord()` (`modules/decisions/services/learning-record-persistence.service.ts`), inalterada.

Ver `docs/DECISIONS.md`, D-099, e `docs/ENGINEERING_LOG.md`, Mission 186, para a auditoria completa e os cenários testados.
