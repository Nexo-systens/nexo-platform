# Recommendation Outcome Learning & Cross-Decision Pattern Engine (Mission 151)

## Etapa 1 — Auditoria (respostas)

- **(A) Onde está definido Recommendation?** Dois lugares distintos, nunca fundidos:
  1. `Recommendation` (Domain, `efos/domain/entities/Recommendation.ts`, Mission 012) — proposta
     determinística do Recommendation Engine, anterior e ortogonal a qualquer Knowledge/IA.
  2. `ExecutiveDiagnosis.possibleActions[]`/`priorities[]`/`interpretations[]`/etc. (Application,
     D-059) — itens gerados pela Executive AI, cada um com `id: string` (gerado pelo modelo),
     `basis: InterpretationBasis` (D-080), e vocabulário fechado próprio (`PossibleActionKind`/
     `RiskAssessmentType`). Esta missão trata deste segundo tipo — o que Mission 150 (D-082) já
     conectou a `Decision.basedOnRecommendationId?`.
- **(B) Fontes de Recommendations.** Confirmado: `possibleActions[]` e `priorities[]` (e os demais
  6 campos-array de `ExecutiveDiagnosis`) via `RECOMMENDATION_REFERENCE_CATEGORIES` (D-082,
  `efos/application/executive-diagnosis/traceRecommendationReference.ts`) — reaproveitado
  diretamente por `resolveRecommendationStructuralShape()`, nunca uma segunda lista de categorias.
- **(C) `Decision.basedOnRecommendationId` (D-082).** Confirmado: campo aditivo opcional no Domain
  (`Decision.ts`), flui automaticamente pelo `jsonb` já existente (`public.decisions.decision`,
  D-066, sem coluna dedicada), mapeado por `createHumanDecision()`, verificado contra o diagnóstico
  real por `createHumanDecisionAction()` (`traceRecommendationReference()` + checagem explícita de
  `companyId`) antes de persistir — nunca aceito sem verificação.
- **(D) Outcome↔Decision.** `Outcome.decisionId: string` obrigatório (D-011/D-070) — Outcome sempre
  Decision-scoped, nunca Recommendation-scoped (confirmado, sem campo `recommendationId`).
- **(E) FinancialOutcomeObservation↔Decision.** `FinancialOutcomeObservation.decisionId: string`
  obrigatório (D-071) — mesma disciplina.
- **(F) LearningRecord↔Decision/Outcome/FinancialOutcomeObservation.** `LearningRecord.decisions:
  string[]` (sempre presente) + `outcomeIds?`/`financialObservationIds?` (aditivos, D-072) +
  `evidenceClassification?` — já produzido por `deriveEvidenceClassification()`
  (`efos/application/learning-derivation/`, Mission 140): deriva de `Outcome.status` (julgamento
  humano) com `confidence` reforçada pela presença de `FinancialOutcomeObservation` real — **nunca**
  interpreta a direção de uma métrica financeira como boa/ruim diretamente (essa semântica não
  existe em nenhum lugar do domínio, e inventá-la seria exatamente a causalidade não comprovada que
  esta missão também proíbe). Este mecanismo é a **fonte única de verdade** reaproveitada por esta
  missão — `deriveRecommendationOutcomePattern()` nunca recalcula evidência a partir de
  `Outcome`/`FinancialOutcomeObservation` brutos, só lê `evidenceClassification` já sintetizado.
- **(G) Knowledge representa padrões acumulados como?** `Knowledge.category` (`historical_pattern`/
  `recurring_observation`/`accumulated_learning`, D-073) + `derivedFromLearningRecordIds`/
  `derivedFromOutcomeIds` — formado por `accumulateKnowledge()` agrupando `LearningRecord`s por
  `companyId`+`evidenceClassification` (D-073/D-076). **Não tocado por esta missão** (Etapa 12).
- **(H) Mecanismo de grouping/fingerprint/similarity existente?** SIM, precedente direto:
  `deriveKnowledgeCandidates()` (D-073, Mission 141) já agrupa `LearningRecord`s por atributo
  estrutural fechado (`companyId`+`evidenceClassification`), nunca por embeddings/similaridade
  semântica — o MESMO princípio geral que esta missão aplica a Recommendations, com um atributo de
  agrupamento mais rico (forma estrutural completa, não só uma classificação). `deriveKnowledgeId()`
  (D-073) é o precedente direto para identidade determinística via hash SHA-256, nunca
  `randomUUID()` — reaproveitado byte-a-byte pelo formato de `deriveRecommendationFingerprint()`.
- **(I) Taxonomia reutilizável para classificar Recommendations?** SIM — `RecommendationReferenceCategory`
  (D-082, 8 valores fechados), `PossibleActionKind` (5 valores, D-059), `RiskAssessmentType` (2
  valores, D-059), `DecisionType` (2 valores, D-011), `RecommendationPriority` (4 valores, D-011) —
  todos vocabulários fechados já existentes, nenhum criado por esta missão.
- **(J) Decisões arquiteturais anteriores consultadas.** D-013 (LearningRecord ativado com campos
  aditivos, nunca entidade nova — precedente para a extensão mínima desta missão); D-045 (
  `compareExecutions()`, correlação temporal nunca causal); D-068 (compactação de `basis` sem
  aumentar complexidade de schema — não diretamente aplicável aqui, mas reforça "nunca duplicar
  transporte"); D-070 (`DecisionExecutionEvent`, Decision-scoped); D-071 (`FinancialOutcomeObservation`,
  Opção B — evento nunca deduplicado, `classification` fechado sempre não-causal); D-072
  (`LearningEvidenceClassification`, vocabulário reaproveitado integralmente por esta missão); D-073
  (`Knowledge`/`deriveKnowledgeId()`, precedente de hash determinístico); D-074
  (`selectRelevantKnowledge()`, precedente de rejeição explícita por `COMPANY_MISMATCH`); D-075
  (`ExecutiveKnowledgeContext`, precedente de bloco irmão nunca fundido); D-077
  (`evaluateKnowledgeAgainstLearning()`, precedente de `rejected[]` explícito); D-078
  (`deriveKnowledgeState()`, precedente DIRETO — 5-estado, `EMERGING`/`INSUFFICIENT`/+3, nunca
  persistido, `rationale` determinístico — esta missão é estruturalmente isomórfica); D-079 (4
  constraints reaproveitados sem duplicação — não diretamente relevante, sem integração de IA nesta
  missão); D-080 (`InterpretationBasis.knowledgeIds`, uma das 5 categorias usadas na fingerprint);
  D-081 (`validateKnowledgeReferences()`, precedente de containment sem recomputar critério já
  garantido upstream); D-082 (`Decision.basedOnRecommendationId`/`traceRecommendationReference()`,
  o elo que esta missão consome diretamente).
- **(K) Onde deve viver Recommendation Learning?** Application Layer — mesma decisão de camada já
  tomada para `KnowledgeState`/`KnowledgeEvaluation` (D-077/D-078): não é um fato determinístico de
  Engine, é uma DERIVAÇÃO sobre dados já existentes e persistidos, nunca uma regra financeira nova.
  Novo diretório `efos/application/recommendation-learning/` (nunca dentro de `executive-diagnosis/`
  ou `decision-lifecycle/` — é um conceito genuinamente cruzando ambos, mais `LearningRecord`,
  justificando um módulo próprio, mesmo padrão de `knowledge-lifecycle/` sendo distinto de
  `knowledge-evaluation/`).

## Etapa 2 — Não duplicação

Nenhuma entidade/tabela nova criada. `RecommendationLearningEntity`/`RecommendationPerformance`/
`RecommendationIntelligence`/`RecommendationScore` — todos avaliados e rejeitados. O mecanismo
reaproveita integralmente: `InterpretationBasis` (D-080, nunca reescrita), `LearningRecord`
(D-072, nunca recalculado), `Decision`/`traceRecommendationReference()` (D-082, nunca duplicado).

## Etapa 3/4 — Unidade de aprendizado: a fingerprint

`RecommendationStructuralShape` — forma estrutural fechada, sem texto livre, sem valores
financeiros, sem ids de empresa/Decision/timestamp/aleatórios:

- `recommendationCategory` (8 valores fechados, D-082);
- `possibleActionKind`/`riskType` (mutuamente exclusivos, só um populado por categoria);
- `basisCategories` (quais das 5 categorias de `InterpretationBasis`, D-080, estão presentes —
  nunca os ids específicos referenciados);
- `decisionType`/`decisionPriority` (D-011, a "postura" humana ao decidir).

`deriveRecommendationFingerprint()` — hash SHA-256 do JSON canônico dessa forma, mesmo formato de
`deriveKnowledgeId()` (D-073): 32 hex reformatados como UUID sintático, nunca `randomUUID()`.
Nenhum embedding, IA, LLM, fuzzy matching, ou similaridade semântica — cada dimensão é um
vocabulário fechado já existente, comparado por igualdade exata.

## Etapa 5/6 — Resultado observável e resultado do aprendizado

Reaproveitado integralmente: `LearningRecord.evidenceClassification` (D-072), já sintetizado por
`deriveEvidenceClassification()` a partir de `Outcome.status` (força reforçada por
`FinancialOutcomeObservation`) — `EVIDENCE_FAVORABLE`→favorável, `EVIDENCE_CONTRARY`→desfavorável,
`INCONCLUSIVE`/`TEMPORAL_ASSOCIATION`→insuficiente. `deriveRecommendationOutcomePattern()`
(isomórfica a `deriveKnowledgeState()`, D-078) agrega esses sinais através de MÚLTIPLAS `Decision`s
que compartilham o mesmo fingerprint, produzindo 1 de 5 estados fechados: `EMERGING`/
`INSUFFICIENT`/`FAVORABLE`/`UNFAVORABLE`/`MIXED`. Nenhum score numérico arbitrário. `UNFAVORABLE`
nomeado deliberadamente diferente de `EVIDENCE_CONTRARY` (mesmo princípio de `WEAKENED` vs.
`CONTRADICTED` em D-078) — nunca confundir o achado de UM evento com o padrão agregado.

## Etapa 7 — Temporalidade

`asOf?` filtra tanto `Decision.decisionCreatedAt` quanto `LearningRecord.createdAt` (uma Decision
antiga pode ganhar evidência nova depois de `asOf` — nunca contamina uma reconstrução histórica).
Comparação sempre via `Date.parse()`, nunca `localeCompare()` sobre string ISO (lição corrigida na
Mission 138, reaplicada aqui deliberadamente).

## Etapa 8 — Company boundary

`companyId` é sempre um parâmetro explícito e SEPARADO da fingerprint (que é deliberadamente
company-agnostic) — `deriveRecommendationOutcomePattern(companyId, fingerprint, decisions, asOf?)`
rejeita explicitamente (`COMPANY_MISMATCH`, rastreável até o `decisionId`) qualquer `Decision` de
empresa diferente, mesmo com fingerprint idêntica. Isso deixa claro, na própria assinatura, onde uma
futura camada de cross-company learning poderia existir (reaproveitar a mesma fingerprint através de
múltiplos `companyId`) — **nunca implementada nesta missão**.

## Etapa 9 — Anti-circularidade

`deriveRecommendationOutcomePattern()`/`resolveRecommendationStructuralShape()`/
`deriveRecommendationFingerprint()` são funções puras, somente leitura — nenhuma nunca escreve em
`Decision`/`Outcome`/`LearningRecord`/`Knowledge`/Financial Truth. O fluxo é estritamente downstream:
`Recommendation → Decision → Execution → Outcome → Observation → LearningRecord → Recommendation
Outcome Pattern` — nunca o inverso.

## Etapa 10 — Imutabilidade histórica

Nenhuma migration criada. Nenhum registro histórico (`Recommendation`/`Decision`/`Outcome`/
`LearningRecord`) é alterado — confirmado por teste (`AA`/`AF`, `test-mission151-*.ts`).

## Etapa 11 — Persistência

**Decisão: nenhuma tabela nova**, mesmo raciocínio de D-078 (`deriveKnowledgeState()`, nunca
persistido):

| Critério | Derivado sob demanda | Snapshot persistido |
|---|---|---|
| Determinismo | Idêntico para a mesma entrada | Idêntico no momento da escrita, mas puxa dados desatualizados depois |
| Auditabilidade | Sempre reconstruível a partir de eventos-fonte reais | Exige auditar 2 fontes de verdade |
| Correção após novos Outcomes | Automática (próxima leitura já reflete) | Exige reprocessamento explícito, risco de stale state |
| Idempotência | Trivial (função pura) | Exige lógica de upsert/dedupe |
| Escalabilidade | Aceitável no volume atual (dezenas de registros) | Só justificável em volume real de milhares+ |
| Consistência com Knowledge | Mesmo padrão de D-078 | Divergiria do precedente já estabelecido |
| Reconstrução | Sempre possível a partir de `Decision`+`LearningRecord` reais | — |

Preferência mantida: eventos-fonte imutáveis (`Decision`/`LearningRecord`, já persistidos) + estado
derivado sob demanda.

## Etapa 12 — Integração com Knowledge

Nenhum atalho `Recommendation Pattern → Knowledge`. A única via permanece
`LearningRecord → Knowledge → KnowledgeEvaluation → KnowledgeState` (D-073/D-077/D-078), inalterada
por esta missão — confirmado por auditoria de imports (`deriveRecommendationOutcomePattern()` nunca
importa `knowledge-formation`/`knowledge-accumulation`/`knowledge-evaluation`/`knowledge-lifecycle`).

## Etapa 13 — Executive AI

Nenhuma chamada Anthropic, nenhuma alteração a provider/schema/multi-stage — confirmado por
auditoria de imports (nenhum arquivo deste módulo importa `efos/infrastructure/executive-ai/`).

## Etapa 14 — UI

**Decisão: nenhuma UI nesta missão.** Mesmo julgamento de D-079 (Mission 147, integração de IA
adiada) — a validação ao vivo (Etapa 19) confirmou apenas 1 `Decision` real em produção, insuficiente
para qualquer padrão além de `EMERGING`/um único ponto de dado — construir UI agora exibiria, na
melhor das hipóteses, "1 Decision observada", sem valor executivo real. Adiada até haver volume real.

## Etapa 15 — Explainability

`RecommendationOutcomePatternResult` — toda contagem rastreável até `supportingDecisionIds`/
`contradictingDecisionIds` (ids reais), `rationale` sempre um template determinístico.
