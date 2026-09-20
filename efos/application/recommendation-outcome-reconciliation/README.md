# Recommendation vs Outcome Reconciliation (Mission 155)

Responde: "depois que uma Recommendation foi escolhida e executada,
qual foi a relação OBSERVÁVEL entre ela e o Outcome registrado?" —
nunca "a Recommendation causou o resultado".

`deriveRecommendationOutcomeReconciliation()` **consome** um
`RecommendationGovernanceState` (D-085, Mission 154) já computado como
precondição — nunca reimplementa `traceRecommendationReference()`
(D-082), lineage de Decision, ou `deriveDecisionExecutionState()`
(Mission 138), todos já corretos em D-085. Adiciona exclusivamente as
duas dimensões que D-085 nunca cobriu:

- `FinancialOutcomeObservation` (D-071, Mission 139) — comparação
  objetiva de Financial Truth antes/depois, sempre reutilizada via
  `getFinancialObservationsByDecision()`, nunca recalculada.
- `recommendationBasis: InterpretationBasis` — a base original da
  proposta (referência direta ao objeto já existente no
  `ExecutiveDiagnosis`, nunca uma cópia).

**REGRA DE OURO**: `outcomeStatus` (julgamento humano) e
`financialObservations` (fato objetivo) são SEMPRE campos separados —
nunca existe um campo "success"/"failure"/"effective" que os combine.
`reconciliationState` é um vocabulário de RECONSTRUÇÃO ESTRUTURAL
(quanto do ciclo proposta→observação existe), nunca de MÉRITO (se a
Recommendation foi boa).

Quando `governance.outcome !== "GOVERNED"` (Recommendation inexistente,
boundary de empresa quebrado, inconsistência temporal), o motivo é
repassado verbatim — nunca recalculado.
