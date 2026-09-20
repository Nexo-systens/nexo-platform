# Knowledge Relevance & Executive Context Integration (Mission 142)

Primeiro mecanismo determinístico de seleção de `Knowledge` (D-073, Mission 141) relevante para um contexto executivo atual — preparação estrutural para uma futura integração ao Executive AI, sem alterar a semântica do diagnóstico atual e sem nenhuma chamada real a um provider de IA.

## Auditoria obrigatória (Etapa 2 da missão) — respostas com evidência de código

**A. Onde o contexto atual do Executive AI é montado?** `buildExecutiveFinancialContext()` (`efos/application/executive-context/buildExecutiveFinancialContext.ts`) — composição pura a partir dos agregados de uma única execução do pipeline (`IndicatorsAggregate`/`EvidenceAggregate`/`ContextAggregate`/`ReasoningAggregate`/`RecommendationAggregate`, opcionalmente `ExecutionComparison`). Consumido por `executeExecutiveAnalysis()` (`efos/application/executive-ai/executeExecutiveAnalysis.ts`), que constrói a `ExecutiveAIInstruction` via `buildExecutiveAIInstruction()` e chama `provider.analyze()`.

**B. Onde Financial Truth entra no diagnóstico?** `ExecutiveFinancialContext.financialTruth: { indicators: readonly Indicator[] }` (`efos/application/executive-context/ExecutiveFinancialContext.ts`) — um campo TOP-LEVEL dedicado, irmão de `evidence`/`deterministicIntelligence`/`historicalIntelligence`/`unknowns`/`conflicts`. Por construção de tipo, `FinancialTruth` só pode carregar `Indicator[]` — nenhuma interpretação/hipótese/recomendação/decisão pode ser confundida com ele.

**C. Onde `Knowledge` poderia ser introduzido sem alterar a autoridade de Financial Truth?** **Achado crítico desta auditoria, decisivo para o design**: `buildExecutiveAIInstruction()` (`efos/application/executive-ai-instruction/ExecutiveAIInstruction.builder.ts`) atribui `context` à instrução **por referência direta, sem selecionar campos** ("`context` nunca é transformado... atribuído por referência direta"); `serializeExecutiveAIInstruction()` (`efos/infrastructure/executive-ai/serializeExecutiveAIInstruction.ts`) faz `JSON.parse(JSON.stringify(instruction))` — uma cópia estrutural COMPLETA, sem allowlist de campos. **Conclusão**: qualquer campo novo adicionado a `ExecutiveFinancialContext` vazaria automaticamente para o payload enviado a um provider de IA real, mesmo sem nenhuma integração deliberada. Por isso `selectRelevantKnowledge()` vive num módulo inteiramente separado (`efos/application/knowledge-relevance/`), nunca importa nem é importado por `ExecutiveFinancialContext`/`buildExecutiveFinancialContext()`/`buildExecutiveAIInstruction()` — a integração real exigirá uma decisão arquitetural futura explícita (Etapa 9/10 da missão), nunca uma consequência acidental de um campo adicionado cedo demais.

**D. Já existe mecanismo de seleção/ranking/relevância reutilizável?** Não — confirmado por busca em todo o repositório (`efos/application/`, `efos/engines/`). O mais próximo conceitualmente é `deriveKnowledgeCandidates()`/`buildKnowledgeFromLearningRecords()` (Mission 141), mas esses AGRUPAM `LearningRecord`s para FORMAR `Knowledge` — um problema diferente de SELECIONAR `Knowledge` já formado para um contexto.

**E. Quais campos reais de `Knowledge` permitem relevância determinística?** `companyId` (fronteira de empresa, obrigatório desde a Mission 003/D-011) e `audit.createdAt` (`DomainEntity`, temporalidade) — os únicos 2 campos estruturais que expressam "pertence a este universo" e "existia neste momento". `category`/`statement`/`derivedFromOutcomeIds`/`derivedFromLearningRecordIds` não têm um sinal equivalente no lado do "contexto atual" para comparar (uma nova análise financeira não carrega uma `evidenceClassification` própria) — usá-los para relevância exigiria inventar um critério de comparação sem base real, o que esta missão proíbe explicitamente (Etapa 5).

**F. Existe risco de Knowledge histórico vazar como dado financeiro atual?** Sim, estruturalmente — ver resposta C. Mitigado por desacoplamento total: este módulo nunca referencia `ExecutiveFinancialContext`/`FinancialTruth`/`Indicator` em nenhum arquivo (confirmado por teste, cenário H/I).

**G. Existe risco de conhecimento de uma empresa ser usado por outra empresa?** Sim — mitigado pelo critério `COMPANY_MISMATCH`, primeiro critério avaliado, sempre aplicado independentemente de `context.asOf` estar presente.

**H. Existe risco temporal de Knowledge futuro ser usado em uma análise histórica?** Sim — mitigado pelo critério `FUTURE_KNOWLEDGE`, aplicado só quando `context.asOf` é informado (mesmo princípio de `asOf?` opcional em `buildKnowledgeFromLearningRecords()`, Mission 141: omitir nunca significa "agora mesmo" lido do relógio, significa "sem corte temporal").

**I. Qual é a menor extensão arquitetural necessária?** 1 módulo novo (`efos/application/knowledge-relevance/`), reaproveitando `validateKnowledge()` (Mission 141) diretamente para o critério de validade estrutural — nenhuma tabela nova (a seleção é sempre derivada em tempo de execução a partir de `Knowledge` já persistido, Etapa 11), nenhuma alteração em `ExecutiveFinancialContext`/`buildExecutiveFinancialContext()`/pipeline de IA existente.

**J. É necessário chamar Claude nesta missão?** Não — confirmado: nenhum arquivo deste módulo importa `efos/infrastructure/executive-ai/` nem qualquer SDK de IA (testado, cenário I).

## Princípio fundamental de autoridade (Etapa 3 da missão)

```
Financial Truth        = autoridade sobre fatos financeiros atuais (Indicator[], inalterado)
Knowledge               = contexto histórico derivado de aprendizados anteriores (D-073)
Executive Interpretation = interpretação futura usando Financial Truth + Knowledge relevante (não implementada nesta missão)
```

`Knowledge ≠ Financial Truth`, `Knowledge ≠ Evidence atual`, `Knowledge ≠ causalidade comprovada` (herdado de D-073), `Knowledge ≠ substituto para dados ausentes` — `selectRelevantKnowledge()` nunca preenche uma lacuna de Financial Truth, apenas filtra `Knowledge` já existente.

## Fronteira desejada (preparação para consumo futuro, Etapa 9 — não implementada)

```
Executive Analysis Context
├── financialTruth        (ExecutiveFinancialContext.financialTruth, já existe, D-058)
├── currentContext         (demais campos de ExecutiveFinancialContext, já existem)
└── relevantKnowledge      (RelevantKnowledgeSelection, este módulo — NUNCA fundido com os dois acima)
```

Esta missão constrói apenas o 3º bloco, isoladamente testável. A composição dos 3 blocos num único `ExecutiveAnalysisContext` consumido por um provider real é uma decisão arquitetural explícita, deliberadamente NÃO tomada aqui (Etapa 9/10).

## Fluxo

```
Knowledge[] (já persistido, lido pelo chamador — nunca por este módulo)
  + RelevanceContext { companyId, asOf? }
  → selectRelevantKnowledge()
  → RelevantKnowledgeSelection { outcome, selected, included, excluded }
```

Nenhum acesso a banco, nenhuma chamada de IA, nenhum `Date.now()` interno.
