# Knowledge Lifecycle & Historical Intelligence Maturity (Mission 146)

## Etapa 1 — Auditoria (respostas)

- **(A) `Knowledge` tem estado mutável hoje?** Não. `efos/domain/entities/Knowledge.ts`
  não possui campo `status` nem `confidence` próprio (apenas
  `provenance.confidence`, fixado uma única vez na formação, nunca
  atualizado depois — D-073).
- **(B) Uma `KnowledgeEvaluation` deve alterar o `Knowledge` ou é só um
  registro histórico?** Apenas um registro histórico (D-077,
  Mission 145). `evaluateKnowledgeAgainstLearning()` nunca escreve em
  `Knowledge` — apenas produz um `KnowledgeEvaluationResult` novo,
  persistido como evento append-only em `knowledge_evaluations`.
- **(C) Como determinar o estado atual sem apagar histórico?**
  Derivando-o sob demanda a partir de `Knowledge original +
  KnowledgeEvaluation[]` — nunca por mutação. É exatamente o que
  `deriveKnowledgeState()` faz.
- **(D) É necessário um novo conceito?** Sim — um estado AGREGADO,
  `KnowledgeState` (`EMERGING`/`INSUFFICIENT`/`SUPPORTED`/`WEAKENED`/
  `MIXED`), distinto do outcome de uma avaliação individual
  (`REINFORCED`/`CONTRADICTED`/`MIXED`/`INSUFFICIENT_EVIDENCE`,
  D-077). Ver seção "Vocabulário" abaixo para a distinção completa.
- **(E) O estado pode ser derivado exclusivamente de `Knowledge
  original + KnowledgeEvaluation[]`?** Sim, integralmente — não há
  necessidade de nenhuma outra fonte de dados. Esta é a abordagem
  implementada.

## Vocabulário (Etapa 3) — por que 5 estados, e por que não reusar os
outcomes de avaliação individual

`KNOWLEDGE_STATES` particiona de forma completa e mutuamente exclusiva
o espaço `(evaluationCount, supportingCount, contradictingCount)`:

| Estado         | Condição                                              |
|----------------|--------------------------------------------------------|
| `EMERGING`     | `evaluationCount === 0`                                |
| `INSUFFICIENT` | `evaluationCount > 0`, `supporting === 0 && contradicting === 0` |
| `SUPPORTED`    | `supporting > 0 && contradicting === 0`                |
| `WEAKENED`     | `supporting === 0 && contradicting > 0`                |
| `MIXED`        | `supporting > 0 && contradicting > 0`                  |

`WEAKENED` é deliberadamente um nome DIFERENTE do outcome
`CONTRADICTED` (D-077) — um evento de avaliação individual "encontrou
contradição" é uma coisa; o estado agregado do Knowledge ao longo de
TODO o seu histórico é outra. Nunca são o mesmo conceito (Etapa 7).

Nunca criados: `PROVEN`, `CAUSAL`, `GUARANTEED`, `CERTAIN`.

## Etapa 7 — por que um único evento contraditório não derruba um
Knowledge bem suportado

O estado é `MIXED` sempre que `supportingCount > 0 &&
contradictingCount > 0`, independentemente de qual seja mais recente
ou mais numeroso. 2 `REINFORCED` + 1 `CONTRADICTED` produz `MIXED`,
nunca `WEAKENED` — o histórico completo, não apenas o evento mais
recente, decide o estado.

## Contagem por evento de avaliação, não por `LearningRecord`

`supportingCount`/`contradictingCount`/`insufficientCount` contam
EVENTOS DE AVALIAÇÃO (`TimestampedKnowledgeEvaluation`), nunca
`LearningRecord`s brutos. Como cada avaliação recomputa do zero contra
TODOS os `LearningRecord`s existentes (full-recomputation, mesmo
princípio de `accumulateKnowledge()`, D-076), o mesmo `LearningRecord`
pode aparecer como evidência em múltiplas avaliações separadas ao
longo do tempo se o Knowledge for reavaliado repetidamente — contar
por `LearningRecord` inflaria artificialmente o histórico. Uma
avaliação `MIXED` conta em AMBOS os buckets (`supportingEvaluationIds`
e `contradictingEvaluationIds`), pois genuinamente carrega os dois
sinais.

## Etapa 6 — Temporalidade

`deriveKnowledgeState(knowledge, evaluations, asOf?)` filtra
avaliações com `evaluatedAt > asOf` antes de computar qualquer coisa —
mesmo princípio temporal de Missions 141/142/145. Não existe, no
código-base, um utilitário genérico de filtro temporal compartilhado
entre missões (cada uma reimplementa o mesmo filtro de uma linha
contra o campo relevante do seu próprio tipo); este é o mesmo padrão
aplicado ao novo campo `evaluatedAt`, não uma duplicação de
implementação nova.

## Etapa 9 — Relevance ≠ State

`deriveKnowledgeState()` nunca importa nem é importado por
`selectRelevantKnowledge()`/`buildExecutiveKnowledgeContext()`
(D-074/D-075). "Relevance" responde "este Knowledge se aplica a este
contexto?" (escopo: company + temporalidade + validade estrutural).
"State" responde "qual é o estado histórico atual deste Knowledge?"
(escopo: agregação de avaliações). Um Knowledge pode ser `SUPPORTED` e
simultaneamente excluído da seleção de relevância por
`COMPANY_MISMATCH`/`FUTURE_KNOWLEDGE` — os dois conceitos nunca se
tocam nesta implementação.

## Etapa 10/11 — Integração com a IA executiva

**Decisão: NÃO integrado nesta missão.** O mesmo julgamento já
aplicado em Missions 142-144 (evitar construir integração de IA
antes de haver volume real de dados) se aplica aqui com ainda mais
força: a validação ao vivo desta missão (Etapa 17) confirmou 0
`Knowledge` reais e 0 `KnowledgeEvaluation` reais em produção — não há
nenhum estado de ciclo de vida real para expor ao executivo ainda.
Se/quando isso mudar, a extensão correta é adicionar
`KnowledgeStateResult[]` como um campo adicional dentro do já
existente `knowledgeContext` (D-075) — nunca dentro de `context` nem
de `financialContext.knowledge` — preservando a garantia de que
`KnowledgeState` nunca substitui indicadores/evidências/dados
financeiros atuais (Financial Truth).

## Etapa 12 — Persistência

**Decisão: nenhuma tabela nova.** `deriveKnowledgeState()` é uma
derivação pura e barata sobre `TimestampedKnowledgeEvaluation[]` já
persistidos (`knowledge_evaluations`, Mission 145) — não recomputa a
avaliação em si, apenas agrega o que já existe. Persistir o estado
derivado introduziria um segundo lugar de verdade que precisaria ser
mantido sincronizado a cada nova avaliação, com risco real de "estado
obsoleto" (stale state) se a materialização falhar silenciosamente.
Preferência mantida: eventos-fonte imutáveis + estado derivado sob
demanda.

## Etapa 13 — Performance

No volume atual (dezenas de registros por empresa), a derivação sob
demanda em memória é trivial. Se o volume de `knowledge_evaluations`
crescer para milhares/milhões por empresa, um índice composto em
`(knowledge_id, evaluated_at)` (já existente via `knowledge_id` FK +
ordenação) ou uma materialização periódica poderia se tornar
necessária — não implementado agora, pois não há necessidade
demonstrada (Etapa 13 da missão: "não implementar otimização sem
necessidade demonstrada").
