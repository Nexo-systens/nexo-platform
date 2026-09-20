# Knowledge Accumulation & Historical Pattern Formation (Mission 144)

Mecanismo de acumulação contínua de `Knowledge` (D-073) a partir de `LearningRecord`s reais — `Decision → Execution → Outcome → Financial Observation → LearningRecord → Recurring Learning → Knowledge Candidate → Knowledge → Future Executive Analysis`. Nunca falsifica histórico; constrói a infraestrutura que permite ao EFOS acumular conhecimento progressivamente conforme novos ciclos reais acontecem.

## Auditoria obrigatória (Etapa 2 da missão) — respostas com evidência de código

**A. Onde um novo `LearningRecord` pode disparar reavaliação?** `deriveLearningRecordAction()` (`modules/decisions/actions/learning-derivation.actions.ts`) — o único ponto onde um `LearningRecord` real é persistido (`saveLearningRecord()`). É o ponto arquitetural correto para, LOGO DEPOIS (nunca dentro), acionar `accumulateKnowledgeAction()` explicitamente.

**B. A formação de Knowledge pode ocorrer dentro da persistência de LearningRecord?** Não, automaticamente — confirmado por decisão de design: `saveLearningRecord()` (`modules/decisions/services/learning-record-persistence.service.ts`) permanece intocado, nunca chama `accumulateKnowledge()`/`accumulateKnowledgeAction()`. A orquestração é sempre explícita — `DecisionExecutionCard.tsx` chama as 2 Server Actions em sequência, visível no código do client, nunca um efeito colateral escondido dentro de uma função de persistência.

**C. O mecanismo deve recalcular todo o histórico? Full recomputation, escolhido explicitamente sobre incremental evaluation.** Ver docblock de `accumulateKnowledge()` para a justificativa completa — resumo: correção (nunca perde um grupo que só se tornou recorrente com um registro mais antigo fora de ordem), determinismo (resultado depende só do conjunto de entrada), idempotência (mesmo conjunto → mesmo resultado, via `id` determinístico), auditabilidade (nenhum estado oculto de "já processado"), e escalabilidade real no volume atual (dezenas de registros, não milhões) — incremental exigiria um novo conceito de cursor/checkpoint sem necessidade comprovada, nunca escolhido "por parecer mais sofisticado" (instrução explícita da missão).

**D. Como evitar duplicação?** `accumulateKnowledge()` nunca reimplementa `deriveKnowledgeCandidates()`/seleção/validação de `Knowledge` — delega inteiramente a `buildKnowledgeFromLearningRecords()` (Mission 141, D-073), que já reaproveita os 3 internamente. Persistência reaproveita `saveKnowledge()`/`getKnowledgeByCompany()` (Mission 141) e `getLearningRecordsByCompany()` (Mission 143) diretamente — nenhuma nova função de acesso a banco foi criada.

## Contrato explícito (Etapa 4)

`KnowledgeAccumulationResult { outcome, created: Knowledge[], existing: Knowledge[], rejected: KnowledgeAccumulationRejection[] }` — nunca apenas `Knowledge[]`. `outcome` distingue os 4 estados exigidos: `NO_ELIGIBLE_LEARNING` (nada para considerar), `NO_SUFFICIENT_RECURRING_LEARNING` (existe LearningRecord mas recorrência insuficiente — mesmo código de D-073), `KNOWLEDGE_ALREADY_EXISTS` (todo candidato já existia), `KNOWLEDGE_CREATED` (pelo menos 1 novo).

## Idempotência (Etapa 5)

`Knowledge.id` continua determinístico (`deriveKnowledgeId()`, Mission 141) — `accumulateKnowledge()` compara cada candidato computado contra `existingKnowledge` (já persistido, fornecido pelo chamador) POR `id`, nunca reclassificando um candidato já existente como `created`. A persistência (`saveKnowledge()`) continua sendo a autoridade final contra duplicação — uma colisão de `id` na inserção real (Postgres `23505`) é tratada como "já existe", nunca como erro nem duplicata.

## Acumulação por empresa (Etapa 6)

`companyId` é sempre um parâmetro obrigatório de `accumulateKnowledge()`. Qualquer `LearningRecord` de entrada com `companyId` diferente é explicitamente REJEITADO (`COMPANY_MISMATCH`, rastreável até o `learningRecordId` real) — nunca silenciosamente agrupado, nunca silenciosamente descartado sem registro.

## Temporalidade (Etapa 7)

`asOf?` é repassado diretamente a `buildKnowledgeFromLearningRecords()` (Mission 141) — mesma lógica, nunca duplicada/divergente. Nenhum `LearningRecord` com `audit.createdAt` posterior a `asOf` contribui para o Knowledge computado.

## Integração com o fluxo humano (Etapa 8)

`DecisionExecutionCard.tsx` chama `deriveLearningRecordAction()` e, em caso de sucesso, chama explicitamente `accumulateKnowledgeAction()` em seguida — 2 chamadas sequenciais visíveis no código do client, nunca uma acoplada silenciosamente dentro da outra. Nenhuma camada `completeLearningCycle()` foi criada — a auditoria determinou que encadear as 2 Server Actions já existentes é suficiente e mais simples; uma composição adicional não ofereceria benefício real (nenhuma lógica nova seria centralizada nela, apenas 2 chamadas sequenciais que já são igualmente claras no client).

## Falha parcial (Etapa 9)

As 2 Server Actions (`deriveLearningRecordAction()`/`accumulateKnowledgeAction()`) são sempre independentes — nunca uma transação de banco única. Se a acumulação falhar depois de um `LearningRecord` já persistido com sucesso, o `LearningRecord` permanece intacto; `accumulateKnowledgeAction()` pode ser chamada novamente mais tarde (full recomputation, Etapa 2.C, torna isso trivialmente seguro — nenhum estado "tentativa anterior" precisa ser rastreado). Nenhum rollback destrutivo existe em nenhum caminho de código.

## Sem nova IA (Etapa 10) / Sem Knowledge artificial (Etapa 11)

Confirmado por teste: nenhum arquivo deste módulo referencia `efos/infrastructure/executive-ai/`/Anthropic/Claude. A validação ao vivo (Etapa 14) usa exclusivamente dados reais — nenhum `LearningRecord`/`Outcome`/`Decision`/`Knowledge` fabricado.

## Persistência (Etapa 2.D / precedente Missions 141-143)

Nenhuma tabela nova — `accumulateKnowledgeAction()` (`modules/decisions/actions/knowledge-accumulation.actions.ts`) reaproveita `public.knowledge_records` (Mission 141) integralmente.
