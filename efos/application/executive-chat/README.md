# Executive Chat over Canonical EFOS Intelligence (Mission 188)

## Objetivo

Primeira interface conversacional de produção sobre a cadeia canônica de
inteligência do EFOS — Financial Truth → Indicators → Evidence → Executive
Financial Context → Reasoning → Recommendation → Scenario → Decision →
Outcome/Observation → Learning → Governed Knowledge → Knowledge Relevance →
Executive AI Context. Não é um chatbot genérico: cada afirmação
company-específica deve ser sustentável pelo contexto canônico já produzido
pelos Engines determinísticos.

```
ExecutiveFinancialContext (D-058) + ExecutiveKnowledgeContext (D-075)
        ↓
buildExecutiveChatInstruction() (pergunta + histórico session-local)
        ↓
executeExecutiveChatAnalysis()
        ↓
ExecutiveChatProvider.converse()
        ↓
ExecutiveAIResponse (UNTRUSTED, output: unknown — reaproveitado de executive-ai)
        ↓
validateExecutiveChatAnswer() + validateExecutiveChatKnowledgeReferences() +
validateExecutiveChatFinancialContextReferences()
        ↓
ExecutiveChatAnswer (TRUSTED)
```

## Por que um contrato irmão, nunca uma generalização de Executive AI

`ExecutiveAIProvider`/`ExecutiveAIRequest`/`ExecutiveAIInstruction` (D-060/D-061,
Missions 116/117) são estruturalmente amarrados à produção de `ExecutiveDiagnosis`
— `outputContract.expectedShape` é um literal fixo `"ExecutiveDiagnosis"`, e o
adapter de produção (`AnthropicExecutiveAIProvider`) gera em 2 chamadas `strict`
sequenciais especificamente para o schema de Diagnosis (Mission 136). Generalizar
esse contrato para aceitar um segundo formato de saída tocaria 20+ missões de
código de produção já endurecido, por um ganho nenhum: os dois formatos de saída
(`ExecutiveDiagnosis` — periódico, sobre todo o contexto; `ExecutiveChatAnswer` —
pontual, respondendo uma pergunta) nunca são intercambiáveis.

A resposta correta, dada a verdade do repositório: um port **sibling**
(`ExecutiveChatProvider`), reaproveitando ao máximo o que já é genérico —
`ExecutiveAIResponse` (o envelope untrusted, `output: unknown`, nunca
diagnosis-específico), `ExecutiveAIError` (vocabulário fechado de falha,
inteiramente genérico), `mapAnthropicErrorToExecutiveAIError()` (tradução de
exceção do SDK), `decodeBasisReferences()` (formato de transporte de `basis`,
Mission 135), e o vocabulário inteiro de interpretação de `ExecutiveDiagnosis`
(`InterpretationBasis`/`ExecutiveConfidence`/`ExecutiveInterpretation`/
`ExecutiveHypothesis`/`ExecutiveUncertainty`) — reaproveitado DIRETAMENTE por
`ExecutiveChatAnswer` (fact/analysis/hypothesis/limitation), nunca copiado. Ver
`docs/DECISIONS.md`, D-103.

## Regra central

```
canonical EFOS state → structured context → model → response.
```

Nunca o inverso: `user question → LLM invents financial interpretation from
general knowledge` é estruturalmente impossível — o modelo só recebe
`ExecutiveFinancialContext`/`ExecutiveKnowledgeContext` já resolvidos
server-side (mesma disciplina fail-closed de `resolveCurrentFinancialExecution()`,
D-088/D-090 — verdade financeira ambígua nunca chega ao provider).

## Knowledge — apenas governado, nunca `humanStatement` bruto

`Knowledge` entra no contexto de Chat pelo MESMO mecanismo canônico de
`selectRelevantKnowledge()` (D-074) + `buildExecutiveKnowledgeContext()`
(D-075/D-079) já usado por Executive Diagnosis — nenhuma segunda seleção de
relevância. A Server Action (`modules/executive-chat/actions/executive-chat.actions.ts`)
nunca chama `getLearningRecordsByCompany()` — `LearningRecord.humanStatement`
(D-100) é estruturalmente inacessível a partir deste módulo, nunca apenas por
convenção de prompt.

## Conversação — session-local, nunca canônica

`ExecutiveChatInstruction.priorMessages` é histórico da MESMA conversa,
transportado como dado inerte dentro do payload JSON (nunca como turnos reais
`role: assistant` do SDK) — o modelo é instruído a nunca tratar uma mensagem
anterior como fato confirmado (`PRIOR_MESSAGES_ARE_NOT_CANONICAL_TRUTH`/
`CANONICAL_CONTEXT_OUTRANKS_CONVERSATION_HISTORY`). Nenhuma persistência de
conversa é criada por esta missão (D-103) — o histórico vive inteiramente no
estado React do client, perdido ao recarregar a página.

## Scenario/Recommendation/Decision boundary

`ExecutiveChatAnswer` não tem NENHUM campo onde o modelo poderia reportar um
valor numérico calculado por ele mesmo, nem criar uma Recommendation/Decision —
esses conceitos simplesmente não são representáveis no schema
(`EXECUTIVE_CHAT_ANSWER_TOOL_SCHEMA`, `additionalProperties: false` em cada
nível). Quando a pergunta pede uma simulação hipotética, o contrato exige
`requiresScenarioSimulation: true` e uma explicação em `answer` — nunca invoca o
Scenario Engine real diretamente (a PONTE governada até o Scenario Engine real é
`proposedActions`, ver seção abaixo, Mission 189).

## Action Proposals — LLM propõe, nunca executa (Missions 189/190, D-104/D-105)

`ExecutiveChatAnswer.proposedActions?` (aditivo/opcional — `ExecutiveChatAnswer`
construído antes destas missões continua válido byte a byte) carrega até 3
`ExecutiveChatResolvedAction`, resolvidas por `resolveExecutiveChatActionProposal()`
(`ExecutiveChatActionProposal.ts`, puro, sem I/O) a partir do formato bruto/plano
que o modelo emite (`RawExecutiveChatActionProposal`, mesma estratégia de `basis`/
D-068 para evitar "compiled grammar too large"). Catálogo FECHADO de 6 tipos
(`EXECUTIVE_CHAT_ACTION_TYPES`) — 3 de navegação, 2 computacionais (Scenario único)
e 1 de comparação (`PREPARE_SCENARIO_COMPARISON`, Mission 190) — nunca uma URL/
rota/nome de função arbitrário. Nenhum tipo de ação declara `companyId`/`actorId`/
id de entidade — a execução real (Platform,
`modules/executive-chat/components/{ExecutiveChatActionCard.tsx, ExecutiveChatComparisonCard.tsx}`)
sempre usa a empresa da conversa atual e chama `simulateScenarioAction()`/
`compareScenariosAction()` (Mission 180/182/183) **sem nenhuma modificação**, que
resolvem a verdade financeira canônica do zero a cada clique — nunca uma
identidade de baseline herdada do momento em que o Chat respondeu. Para
comparação, `compareScenariosAction()` é chamada **exatamente 1 vez** com as duas
alternativas — nunca duas chamadas independentes de `simulateScenarioAction()`,
que arriscaria resolver o baseline em dois instantes diferentes (Seção 9 da
Mission 190, requisito duro, provado por auditoria de código-fonte). Toda ação é
apenas uma PROPOSTA: nenhuma executa sem um clique humano explícito, provado por
teste mesmo sob prompt injection. Uma comparação nunca declara um vencedor —
estruturalmente herdado de `ExecutiveScenarioComparison` (nenhum campo de
pontuação existe), reforçado pela constraint `DO_NOT_DECLARE_COMPARISON_WINNER`.

## O que este módulo NÃO faz

- Não persiste nenhuma conversa/mensagem, nem propostas de ação (Seção 39/61,
  D-103/D-104).
- Não invoca o Scenario Engine diretamente — apenas propõe uma ação que, se
  confirmada pelo humano, aciona a Server Action canônica já existente
  (`simulateScenarioAction()`, nunca duplicada aqui).
- Não cria `Recommendation`/`Decision`/`Outcome`/`Learning`/`Knowledge`.
- Não duplica `ExecutiveFinancialContext`/`ExecutiveKnowledgeContext` —
  reaproveitados por referência direta, nunca uma cópia `ChatFinancialContext`/
  `ChatKnowledgeContext`.
- Não introduz nenhum framework de agente autônomo genérico (tool registry,
  planner/executor, agent loop) — o catálogo de ações é fechado e pequeno,
  nunca um dispatcher arbitrário (Seção 65 da Mission 189).
- Não detecta contradição semântica em `priorMessages`/`humanStatement` (exigiria
  IA/embeddings, explicitamente fora de escopo) — a garantia é estrutural
  (verdade canônica sempre precede/sobrepõe conversa), nunca semântica.

Ver `docs/DECISIONS.md`, D-103/D-104, e `docs/ENGINEERING_LOG.md`, Missions 188/189,
para a auditoria completa e os cenários testados.
