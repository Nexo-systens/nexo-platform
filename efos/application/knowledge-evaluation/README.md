# Knowledge-Driven Continuous Improvement (Mission 145)

Camada determinística que avalia se um `Knowledge` (D-073) já formado continua sendo reforçado, foi contradito, ou permanece sem evidência suficiente quando confrontado com `LearningRecord`s reais observados desde sua formação — sem contaminar Financial Truth, sem criar causalidade falsa, sem permitir que conhecimento histórico substitua evidência atual, e sem reescrever o `Knowledge` original.

## Auditoria obrigatória (Etapa 1 da missão) — respostas com evidência de código

### A. Knowledge atual

1. **Knowledge possui status?** Não — `efos/domain/entities/Knowledge.ts` não tem campo `status`.
2. **Knowledge possui confidence?** Não um campo de domínio próprio — só `provenance.confidence` (herdado de `DomainEntity`), fixado uma única vez em `{value: 100, level: "very_high"}` por `buildKnowledgeFromLearningRecords()` (Mission 141), nunca atualizado depois.
3. **Knowledge pode ser atualizado?** Não — `saveKnowledge()` (`modules/decisions/services/knowledge-persistence.service.ts`) só tem `insert`; nenhuma função de update existe em todo o repositório.
4. **A persistência é append-only ou mutável?** Append-only — `public.knowledge_records` (migration `20260825000000_knowledge_records.sql`) não tem policy de `UPDATE`/`DELETE`.
5. **Existe mecanismo atual de confirmação ou contradição?** Não — confirmado por busca em todo o repositório antes desta missão.

### B. LearningRecord

1. **Como já representa evidência?** `evidenceClassification` (D-072, `efos/domain/enums/learning.ts`) — vocabulário fechado (`TEMPORAL_ASSOCIATION`/`EVIDENCE_FAVORABLE`/`EVIDENCE_CONTRARY`/`INCONCLUSIVE`) derivado exclusivamente do julgamento humano já registrado (`Outcome.status`); `confidence` (`LearningConfidence`); `outcomeIds`/`financialObservationIds` para rastreabilidade.
2. **É possível reutilizá-lo para avaliação de Knowledge?** Sim — é exatamente o mesmo campo (`evidenceClassification`) que `deriveKnowledgeCandidates()` (Mission 141) já usa para formar `Knowledge` em primeiro lugar; reutilizá-lo para AVALIAR reforço/contradição é a mesma chave estrutural, nunca uma nova interpretação.
3. **Há risco de duplicar conceito?** Não — `LearningRecord` continua representando um caso individual; esta missão não cria um "LearningRecord de avaliação" nem duplica seus campos, apenas os LÊ.

### C. Knowledge Relevance

1. **Relevância atual significa validade?** Não — `selectRelevantKnowledge()` (D-074, `efos/application/knowledge-relevance/selectRelevantKnowledge.ts`) só verifica 3 critérios estruturais: fronteira de empresa, temporalidade, validade estrutural (`validateKnowledge()`). Nenhum dos 3 avalia se o conteúdo do `Knowledge` continua empiricamente sustentado.
2. **Um Knowledge selecionado é automaticamente confirmado?** Não — confirmado por leitura do código: `RelevantKnowledgeSelection`/`ExecutiveKnowledgeContext` (D-074/D-075) nunca carregam nenhum campo de força/confirmação, apenas "está elegível para aparecer no contexto".
3. **Existe algum mecanismo para enfraquecer um Knowledge?** Não — confirmado, esta é exatamente a lacuna que esta missão fecha.

### D. Hypothesis

**Hypothesis pode representar a avaliação evolutiva de Knowledge? Não.** `Hypothesis` (`efos/domain/entities/Hypothesis.ts`, Camada 5) é "explicação possível para um conjunto de EVIDÊNCIAS" — `supportingEvidenceIds`/`contradictingEvidenceIds` referenciam `Evidence` (Camada 4, fato financeiro bruto de uma ÚNICA execução), nunca `LearningRecord` (que atravessa múltiplas execuções/Decisions ao longo do tempo). Reutilizar `Hypothesis` exigiria reapontar esses arrays para um tipo diferente do que o próprio nome do campo declara — uma reinterpretação silenciosa, exatamente o que D-013 já proibiu para `LearningRecord`/`Knowledge`. `HypothesisStatus` (`candidate`/`confirmed`/`refuted`) também usa vocabulário mais forte ("confirmed"/"refuted") do que o vocabulário evidencial que esta missão exige (`REINFORCED`/`CONTRADICTED`/`INSUFFICIENT_EVIDENCE` — nunca "confirmado", que soa definitivo demais para uma avaliação que pode mudar a cada novo ciclo). `Hypothesis` continua com 0 consumidores em todo o código-base — mesmo estado não-ativado confirmado pelas Missions 141-143.

### E. Evidence

**Existe mecanismo reutilizável para representar evidência favorável/contraditória sem criar um novo conceito?** Não em `Evidence` — `efos/domain/entities/Evidence.ts` (Camada 4) não tem nenhum campo de suporte/contradição, nenhum `status`; é um fato financeiro bruto de uma única execução, sem noção de "ao longo do tempo". O mecanismo reutilizável correto já existe em `LearningRecord.evidenceClassification` (ver B), não em `Evidence`.

### F. Prova de não-duplicação

1. **Por que `Knowledge` sozinho é insuficiente?** É um snapshot imutável formado uma vez — não tem onde registrar uma avaliação POSTERIOR sem violar sua própria imutabilidade (Etapa 7 da missão proíbe explicitamente reescrevê-lo).
2. **Por que `LearningRecord` sozinho é insuficiente?** Representa um caso individual — não existe, em lugar nenhum, o conceito de "como um GRUPO de `LearningRecord`s se relaciona com UM `Knowledge` específico, num ponto no tempo".
3. **Por que `Hypothesis` não é reutilizável?** Ver D — eixo semântico diferente (explica `Evidence` de uma execução, não avalia `Knowledge` ao longo do tempo), tipo de referência incompatível, vocabulário de status incompatível.
4. **Por que um novo conceito representa algo semanticamente distinto?** `KnowledgeEvaluationResult` (`efos/application/knowledge-evaluation/`, novo) é uma AVALIAÇÃO PONTUAL — nunca substitui `Knowledge`/`LearningRecord`/`Outcome`/`FinancialOutcomeObservation`, apenas os compara. Application-layer, nunca uma entidade de Domain (mesmo precedente de `FinancialOutcomeObservation`, D-071 — computado/persistido, mas nunca parte da Ontologia canônica `efos/domain/entities/`).

## Regra de compatibilidade (Etapa 6.4/6.5)

A "classificação de origem" de um `Knowledge` é a `evidenceClassification` compartilhada pelos `LearningRecord`s que o formaram (`knowledge.derivedFromLearningRecordIds`) — sempre uniforme por construção (`deriveKnowledgeCandidates()`, D-073, agrupa por `companyId`+`evidenceClassification` exata). Cada `LearningRecord` candidato (não usado na formação original) é comparado:

- **IGUAL** à classificação de origem → `supporting`.
- **PAR OPOSTO** dentro do eixo de julgamento humano (`EVIDENCE_FAVORABLE` ↔ `EVIDENCE_CONTRARY`, único par reconhecido como contradição real) → `contradicting`.
- **Qualquer outra relação** (eixo diferente, ou `INCONCLUSIVE` envolvido) → `insufficient` — considerado, nunca descartado silenciosamente, mas não comparável.

`INCONCLUSIVE` nunca conta como contradição — o próprio humano já registrou "sem conclusão clara", semanticamente diferente de "o oposto".

## Confidence não mutada (Etapa 8)

`evaluateKnowledgeAgainstLearning()` nunca lê nem escreve `knowledge.provenance.confidence`. Mutação automática de confidence — se um dia desejável — é uma decisão arquitetural explícita, deliberadamente NÃO tomada por esta missão.

## Integração explícita (Etapa 10)

`evaluateKnowledgeAction()` (`modules/decisions/actions/knowledge-evaluation.actions.ts`) é sempre chamada explicitamente, nunca de dentro de `saveLearningRecord()`/`saveKnowledge()`/`accumulateKnowledge()`. Fluxo: `LearningRecord persisted → Knowledge accumulation (Mission 144) → Knowledge evaluation (esta missão)` — 3 chamadas sequenciais e independentes, visíveis no client (`DecisionExecutionCard.tsx`). Falha em qualquer etapa nunca desfaz as anteriores.
