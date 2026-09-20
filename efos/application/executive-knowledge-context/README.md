# Knowledge Injection into Executive Analysis (Mission 143)

Integra, pela primeira vez, o conhecimento histórico selecionado (D-074, Mission 142) ao ciclo real de análise executiva do EFOS — `Knowledge Records → Knowledge Relevance → Controlled Executive Context → Executive AI` — sem transformar `Knowledge` em Financial Truth e sem permitir que padrões históricos sejam apresentados como causalidade comprovada.

## Auditoria obrigatória (Etapa 2 da missão) — respostas com evidência de código

**A. Onde o Knowledge pode entrar? Último ponto possível antes da instrução da IA.** `buildExecutiveAIInstruction()` (`efos/application/executive-ai-instruction/ExecutiveAIInstruction.builder.ts`) — o único ponto de composição entre um `ExecutiveFinancialContext` já pronto e a `ExecutiveAIInstruction` final. **Não foi adicionado a `ExecutiveFinancialContext`** — provado abaixo (C) que isso criaria vazamento automático.

**B. Knowledge é Financial Truth?** Não — `ExecutiveKnowledgeContext` (`ExecutiveKnowledgeContext.ts`, este diretório) é um tipo estruturalmente distinto de `FinancialTruth` (`efos/application/executive-context/ExecutiveFinancialContext.ts`); nenhuma composição os funde.

**C. O Knowledge pode alterar fatos?** Não — `buildExecutiveKnowledgeContext()` só LÊ `Knowledge[]` já persistido e o filtra via `selectRelevantKnowledge()` (D-074); nunca escreve em `Indicator`/`Evidence`/`Context`/`Reasoning`/`Recommendation`/`ExecutionSnapshot`. Confirmado por teste (nenhuma referência a esses tipos em nenhum arquivo deste módulo).

**D. Como preservar a fronteira?** `ExecutiveAIInstruction` ganhou um campo IRMÃO novo — `knowledgeContext?: ExecutiveKnowledgeContext` — nunca `ExecutiveFinancialContext & { knowledge: Knowledge[] }` (atalho explicitamente proibido pela Etapa 1.D da missão). `context` (Financial Truth) e `knowledgeContext` (Historical Knowledge) permanecem 2 campos top-level sempre distintos, do tipo até a serialização final.

## Achado decisivo herdado da Mission 142 (D-074), reconfirmado nesta missão

`buildExecutiveAIInstruction()` atribui `context`/`knowledgeContext` à instrução por REFERÊNCIA DIRETA; `serializeExecutiveAIInstruction()` faz `JSON.parse(JSON.stringify(instruction))` — cópia estrutural completa, sem allowlist. Isso significa: qualquer campo presente em `ExecutiveAIInstruction` chega ao payload enviado à IA. Por isso `knowledgeContext` foi adicionado como campo EXPLÍCITO e IRMÃO de `context` — nunca embutido dentro de `ExecutiveFinancialContext` — preservando a mesma garantia estrutural que a Mission 142 já havia estabelecido (D-074): a integração real é uma decisão explícita, nunca uma consequência acidental.

## Pipeline (Etapa 4 da missão) — reaproveitado, nunca duplicado

```
Knowledge[]  (getKnowledgeByCompany(), Mission 141)
      ↓
selectRelevantKnowledge()   (Mission 142, D-074 — company/temporal/structural filtering)
      ↓
buildExecutiveKnowledgeContext()   (este módulo — só projeta o resultado já filtrado)
      ↓
ExecutiveKnowledgeContext { knowledge, selectionOutcome }
      ↓
buildExecutiveAIInstruction(context, instructionId, knowledgeContext)
      ↓
ExecutiveAIInstruction { context, knowledgeContext?, objective, authority, outputContract, constraints }
```

`buildExecutiveKnowledgeContext()` nunca reimplementa company filtering, temporal filtering ou structural validation — os 3 já vivem inteiramente em `selectRelevantKnowledge()` (D-074).

## Regras explícitas entregues à IA (Etapa 6 da missão)

9 novos `ExecutiveAIConstraint`s, adicionados ao MESMO vocabulário fechado `EXECUTIVE_AI_CONSTRAINT_CODES` (`efos/application/executive-ai-instruction/ExecutiveAIInstruction.ts`, 8 → 17), sempre presentes independentemente de `knowledgeContext` estar presente/vazio nesta chamada (mesmo princípio de `authority`/`outputContract` — o contrato nunca varia por dado recebido):

1. `HISTORICAL_KNOWLEDGE_IS_NOT_FINANCIAL_TRUTH`
2. `DO_NOT_ALTER_FIGURES_WITH_KNOWLEDGE`
3. `DO_NOT_PROVE_CAUSATION_FROM_KNOWLEDGE`
4. `MAY_CONTEXTUALIZE_WITH_KNOWLEDGE`
5. `KNOWLEDGE_MAY_BE_CONTRADICTED_BY_CURRENT_DATA`
6. `CURRENT_DATA_TAKES_PRECEDENCE_OVER_KNOWLEDGE`
7. `ABSENCE_OF_KNOWLEDGE_NEVER_BLOCKS_ANALYSIS`
8. `DO_NOT_PRESENT_KNOWLEDGE_AS_CURRENT_FACT`
9. `DISTINGUISH_FACT_INTERPRETATION_PATTERN_AND_HISTORICAL_PATTERN`

Automaticamente aparecem no texto do prompt via `buildBaseSystemPrompt()` (`efos/infrastructure/executive-ai/buildExecutiveAISystemPrompt.ts`), que já itera `instruction.constraints` inteiro sem alteração alguma necessária — zero duplicação de lógica de construção de prompt. Um parágrafo adicional, sempre presente, explica ao modelo o significado das 2 chaves de topo (`context`/`knowledgeContext`) do JSON recebido.

## Ausência honesta (Etapa 7 da missão)

`knowledgeContext.selectionOutcome === "NO_RELEVANT_KNOWLEDGE"` (com `knowledge: []`) é um estado válido e esperado — nunca um erro, nunca um bloqueio, nunca uma mensagem inventada. A constraint `ABSENCE_OF_KNOWLEDGE_NEVER_BLOCKS_ANALYSIS` instrui a IA explicitamente a prosseguir normalmente nesse caso.

## Temporalidade e company boundary (Etapas 8/9)

Reaproveitados integralmente de `selectRelevantKnowledge()` (D-074) — nunca reimplementados aqui. `activateExecutiveDiagnosisAction()` (`modules/decisions/actions/executive-diagnosis.actions.ts`) resolve `asOf: new Date().toISOString()` no momento da chamada (Server Action, com permissão de ler o relógio) e o repassa como parâmetro — nunca lido dentro de nenhuma função pura deste módulo.

## Knowledge não é promovido a Evidence (Etapa 10)

`ExecutiveKnowledgeContext` nunca é usado para construir `Evidence`/`Indicator`/`ExecutionSnapshot` — confirmado por teste (nenhuma referência a esses tipos em nenhum caminho de código deste módulo). `Knowledge` permanece uma camada epistemológica separada, nunca convertida em `source: "financial_truth"` nem em nenhum cálculo de indicador/benchmark.

## Persistência (Etapa 11) — nenhuma tabela nova

`ExecutiveKnowledgeContext` é sempre derivado em tempo de execução a partir de `Knowledge` já persistido (Mission 141) — nunca cacheado, nunca uma nova migration.

## UI (Etapa 12) — deliberadamente não implementada nesta missão

Tornar visível "Historical Knowledge Context foi usado" exigiria persistir esse fato junto ao `ExecutiveDiagnosis` (nenhum campo existe hoje para isso) ou reconstruí-lo a partir do estado atual de `Knowledge` no momento da leitura (o que divergiria silenciosamente do que realmente foi enviado à IA no momento da geração — Mission 143 nunca permite isso). Com 0 `Knowledge` real em produção (herdado das Missions 141/142), qualquer UI hoje mostraria sempre "não usado" — sem valor demonstrável nesta missão. Deliberadamente adiado; decisão de UI/persistência explícita fica para quando houver Knowledge real suficiente.
