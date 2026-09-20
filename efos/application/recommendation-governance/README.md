# Recommendation Governance (Mission 154)

Reconstrói o ciclo de vida operacional de um item citável específico de
um `ExecutiveDiagnosis` (uma "Recommendation" da IA) — Review → Decision
→ Execution → Outcome → Learning — sempre **DERIVED, NOT MUTATED**.

Direção **inversa** de `traceDecisionRecommendation()` (D-084, Mission
152): aquela parte de uma `Decision` já escolhida e pergunta "que
Recommendation ela cita?"; esta parte da Recommendation e pergunta "que
Decision, se houver, a cita, e o que aconteceu depois?".

`deriveRecommendationGovernanceState()` é pura — nunca acessa
Supabase/banco/relógio/IA, nunca gera id/timestamp, nunca muta nenhum
argumento recebido. Reaproveita integralmente `traceRecommendationReference()`
(D-082), `resolveRecommendationReviewStatus()` (D-063/Mission 152) e
`deriveDecisionExecutionState()` (Mission 138) — nenhuma dessas três
peças é reimplementada aqui.

`lifecycleState` é um vocabulário fechado de progressão (`NOT_REVIEWED`
→ `REVIEWED` → `DECIDED` → `EXECUTING`/`BLOCKED`/`COMPLETED`/`CANCELLED`
→ `OUTCOME_RECORDED` → `LEARNING_OBSERVED`), nunca inferido além do que
os fatos fornecidos provam — a ausência de Execution/Outcome/Learning é
sempre um estado válido, nunca preenchida com suposição.

`Outcome`/`Execution` nunca são interpretados como sucesso/fracasso —
`outcomeStatus`/`executionStatus` são sempre expostos como fatos brutos,
nunca traduzidos em "a Recommendation funcionou".

Knowledge nunca é criada aqui — apenas consultada (presença/ausência de
um `Knowledge` já existente cuja proveniência intersecta o Outcome/
LearningRecord desta Decision). Recorrência (D-073, `MINIMUM_DISTINCT_DECISIONS_FOR_KNOWLEDGE`)
permanece exclusivamente responsabilidade do Knowledge Formation Engine.
