# Knowledge Formation & Cross-Decision Learning (Mission 141)

Transforma múltiplos `LearningRecord`s (D-072, Mission 140) reais, de `Decision`s independentes, em `Knowledge` (D-011, ativado por esta missão) — conhecimento consolidado, reutilizável, sem nunca inventar causalidade.

## Auditoria obrigatória (Etapa 2 da missão) — respostas com evidência de código

**A. O que `Knowledge` representa hoje?** `efos/domain/entities/Knowledge.ts` — um fato permanente aprendido sobre uma empresa, `{companyId, statement, derivedFromOutcomeIds, derivedFromLearningRecordIds?}`, desde a Mission 003.

**B. `Knowledge` já possui persistência ou consumo?** Não, nunca — confirmado por busca em todo o repositório antes desta missão (0 sites de construção de `Knowledge` além do próprio tipo).

**C. Já existe uma relação `LearningRecord → Knowledge`?** Só como contrato: `Knowledge.derivedFromLearningRecordIds?` (Mission 140), nunca populado por nenhum código antes desta missão.

**D. Já existe mecanismo de recorrência/agrupamento/similaridade?** Sim, um precedente direto: `MINIMUM_EVIDENCES_FOR_CONTEXT = 2` (`efos/engines/context/context.constants.ts`, Mission 010) — "um Context só existe quando há algo a mais do que repetir uma única Evidence". Reaproveitado como justificativa do threshold desta missão (`MINIMUM_DISTINCT_DECISIONS_FOR_KNOWLEDGE = 2`).

**E. `Hypothesis` pode ser reutilizada?** Não — `Hypothesis` (`efos/domain/entities/Hypothesis.ts`, Camada 5) representa "explicação possível para um conjunto de evidências financeiras" (`candidate`/`confirmed`/`refuted`), um eixo semântico DIFERENTE de "padrão recorrente de resultado de Decisions ao longo do tempo". Reaproveitar `Hypothesis` misturaria dois conceitos distintos (explicação de evidência vs. conhecimento acumulado de decisão) — confirmado por 0 consumidores de `Hypothesis` em todo o código-base, o mesmo estado não-ativado em que `Knowledge` estava.

**F. Quais campos permitem determinar que múltiplos `LearningRecord`s pertencem ao mesmo padrão?** `evidenceClassification` (D-072, Mission 140) — o ÚNICO campo de `LearningRecord` que é um vocabulário fechado, derivado exclusivamente do julgamento humano já registrado (`Outcome.status`), e portanto comparável entre `LearningRecord`s de `Decision`s diferentes sem inventar nenhuma interpretação nova. `type`/`source` são sempre `"observation"`/`"historical_pattern"` (constantes, não discriminam); `title`/`description` são texto livre (exigiriam fuzzy matching, proibido pela Etapa 4).

**G. Existe decisão arquitetural anterior que já antecipe este caminho?** Sim, D-013 (Mission 015), texto direto: "Mantê-los distintos preserva a possibilidade de, no futuro, um Learning Engine estendido consolidar `LearningRecord`s repetidos ao longo do tempo em `Knowledge` permanente". E o próprio `Knowledge.ts` (Mission 140): "Uma missão futura, quando existir volume real de `LearningRecord`s, deve decidir explicitamente o critério de consolidação".

**H. Menor extensão possível?** Estender `Knowledge` com 1 campo obrigatório novo (`category: KnowledgeCategory`, `efos/domain/enums/knowledge.ts`, novo — garantia estrutural anti-causalidade) e ativar os 2 campos já existentes (`derivedFromOutcomeIds`, `derivedFromLearningRecordIds?`) através de uma nova composição pura (`buildKnowledgeFromLearningRecords()`) — nenhuma entidade/Aggregate/tabela além do necessário para persistir `Knowledge` (que já tinha `KnowledgeAggregate` reservado desde a Mission 003).

## Fronteiras conceituais preservadas

- **Financial Truth** (`Indicator`/`FinancialEvent`/`ExecutionSnapshot`) ≠ **Knowledge**: `Knowledge` nunca é construído a partir de indicadores financeiros diretamente — sempre via `LearningRecord`s já existentes, que por sua vez já derivam de `Outcome`/`FinancialOutcomeObservation` (D-071).
- **LearningRecord** (um caso individual) ≠ **Knowledge** (consolidado de múltiplos casos independentes) — um único `LearningRecord` nunca gera `Knowledge` (`MINIMUM_DISTINCT_DECISIONS_FOR_KNOWLEDGE = 2`).
- **`KnowledgeCandidate`** (`KnowledgeCandidate.ts`) — padrão potencial ainda não consolidado, tipo da Application Layer, nunca persistido, nunca uma entidade de Domain.
- **Knowledge ≠ causalidade comprovada** — `KnowledgeCategory` (`efos/domain/enums/knowledge.ts`) é um vocabulário fechado de 3 valores, nenhum causal; a direção/força da evidência de origem já vem do julgamento humano (`evidenceClassification`), nunca reinterpretada aqui.

## Fluxo

```
LearningRecord[] (de múltiplas Decisions)
  → deriveKnowledgeCandidates()      [agrupa por companyId+evidenceClassification]
  → buildKnowledgeFromLearningRecords() [exige recorrência mínima, gera Knowledge[] ou NO_SUFFICIENT_RECURRING_LEARNING]
```

Nenhuma das duas funções acessa banco, chama IA, ou lê o relógio do sistema internamente (`formedAt`/`asOf` sempre parâmetros).

## Idempotência

`Knowledge.id` é derivado deterministicamente (`deriveKnowledgeId()`, SHA-256 de `companyId`+`category`+`learningRecordIds` ordenados — nunca `randomUUID()`). Reexecutar a formação com o mesmo conjunto de `LearningRecord`s produz sempre o mesmo `id`; a camada de persistência trata uma colisão de `id` como "já existe", nunca duplica silenciosamente.

## Mission 187 — Governed Learning → Organizational Knowledge

`KnowledgeCandidate` ganhou 2 campos aditivos, computados por `deriveKnowledgeCandidates()`: `humanInterpretedCount` (contagem de `LearningRecord`s do grupo com `humanStatement` não-vazio, Mission 186 Closure, D-100) e `dominantScenarioType` (definido só quando TODOS os registros do grupo que carregam `expectedActualContext`, D-099, compartilham o mesmo `scenarioType` — `undefined` caso contrário, nunca uma homogeneidade fabricada). `statementFor()` (`buildKnowledgeFromLearningRecords.ts`) usa os dois para anexar uma nota ADITIVA ao template original por `evidenceClassification` — nunca cita/reproduz o conteúdo de nenhum `humanStatement`, apenas sinaliza sua EXISTÊNCIA agregada e o mecanismo financeiro comum, quando houver. Grupos sem nenhum registro enriquecido produzem `statement` byte-idêntico ao comportamento anterior a esta missão (retrocompatibilidade total). A chave de agrupamento (`companyId`+`evidenceClassification`), o threshold de recorrência, a idempotência de `id` e `evaluateKnowledgeAgainstLearning()` (D-077) permanecem inteiramente inalterados. Ver `docs/DECISIONS.md`, D-101, para o racional completo, incluindo por que nenhuma detecção de contradição semântica sobre `humanStatement` foi implementada (exigiria IA/embeddings, proibido).

## Mission 187 Closure — Governed Knowledge Synthesis

`KnowledgeCandidate` ganhou `interpretations: readonly KnowledgeCandidateInterpretation[]` (aditivo) — o texto VERBATIM de cada `humanStatement` do grupo, com lineage (`learningRecordId`/`decisionId`), nunca resumido/sintetizado. `buildKnowledgeFromLearningRecords()` foi refatorado (comportamento observável idêntico, confirmado por regressão) para delegar a construção de cada `Knowledge` a `buildKnowledgeForCandidate(candidate, formedAt, organizationalStatement?)` — quando `organizationalStatement` é fornecido (não-vazio), ELE se torna o `statement` final, nunca uma concatenação automática das `interpretations`. Novo módulo `deriveKnowledgeCandidatePreviews.ts` calcula candidatos recorrentes com `humanInterpretedCount > 0` ainda sem `Knowledge` persistido — estes NUNCA são auto-formados (`modules/decisions/actions/knowledge-formation.actions.ts`, `formKnowledgeAction()` os exclui do laço automático); só se tornam `Knowledge` através de `formGovernedKnowledgeAction()`, quando um humano confirma/edita o `statement` explicitamente. Candidatos sem interpretação continuam 100% automáticos, byte-idênticos ao comportamento desde D-073. `Knowledge.provenance.confidence` permanece inalterado em ambos os caminhos — auditado e documentado (D-102) como confiança no PROCESSO de formação, nunca na veracidade do `statement`. Ver `docs/DECISIONS.md`, D-102, para o racional completo, incluindo a prova de que `humanStatement`s brutos nunca alcançam o pipeline Executive AI sem aprovação explícita.
