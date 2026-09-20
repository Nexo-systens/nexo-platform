# Decision Execution & Outcome Feedback Loop (Mission 138)

## Objetivo

Fechar o primeiro elo pós-decisão que faltava na cadeia executiva:

```
Financial Truth
    ↓
Executive Analysis (D-059/D-069)
    ↓
Human Review (D-063)
    ↓
Human Decision (D-063/D-064/D-066)
    ↓
Decision Execution (este módulo, Mission 138)
    ↓
Outcome (este módulo — ativa efos/domain/entities/Outcome.ts, D-011)
```

## Auditoria (Etapa 5 da missão) — respostas explícitas

- **`Outcome` já existe?** Sim — `efos/domain/entities/Outcome.ts`, desde a Mission 003/D-011. Nunca foi persistido nem consumido por nenhum código antes desta missão (confirmado por busca em todo o repositório). Reutilizado quase como estava — ganhou apenas `expectedResult?` (aditivo, opcional).
- **`DecisionExecution`/`DecisionStatus`/`ExecutionStatus` já existem?** Não. `Decision` (`efos/domain/entities/Decision.ts`) é imutável (nenhuma policy de UPDATE/DELETE em `public.decisions`, D-066) e nunca carregou nenhum campo de progresso.
- **Qual aggregate é autoridade?** Nenhum `efos/domain/aggregates/`. Mesmo padrão já estabelecido para `DiagnosisReview`/`Decision` humana (D-063/D-065/D-066): este é um conceito de workflow humano, não um artefato determinístico de Engine — a autoridade vive na Application Layer + persistência direta em Supabase, nunca dentro de um Aggregate de Domain. Criar `ExecutionAggregate`/`OutcomeAggregate` teria sido uma duplicação estrutural desnecessária.
- **Existe entidade reaproveitável para representar a execução sem duplicar?** Não — nem `Decision` (imutável, sem progresso) nem `Outcome` (representa o resultado FINAL observado, não o andamento) cobrem "está em andamento / bloqueada / cancelada". Daí `DecisionExecutionEvent`, um conceito genuinamente novo, ser justificado.
- **Relação Decision/Resource/Outcome?** `Resource` (`efos/domain/entities/Resource.ts`) é um ativo financeiro (Financial Truth) — sem relação com o acompanhamento de uma decisão humana. Nenhuma conexão foi criada nesta missão.
- **Migrations relacionadas existentes?** Só `20260822202720_executive_decision_persistence.sql` (D-066, `executive_diagnoses`/`diagnosis_reviews`/`decisions`). Nenhuma tabela de execução/outcome existia.
- **Outcome desenhado mas não ativado?** Sim, exatamente — esta missão é a ativação.

## Por que Application, não Domain?

Mesma decisão de camada de `DiagnosisReview` (Mission 123, D-063): `DecisionExecutionEvent` não é um fato determinístico de Engine, é o acompanhamento humano do andamento de uma `Decision` já registrada. `Outcome` continua no Domain (já existia lá) — só seu *validador* (`Outcome.validator.ts`) vive aqui, pela mesma razão que `DiagnosisReview`/`Decision` humana precisam de validação de entrada não confiável (vindo de um humano via UI), diferente de uma entidade de Domain construída inteiramente por um Engine determinístico.

## `DecisionExecutionEvent` — log de eventos imutável, nunca uma linha mutável

Mesmo padrão de `DiagnosisReview` (múltiplas revisões, a mais recente é autoritativa) e de toda tabela deste código-base (nenhuma tem policy de UPDATE). Cada mudança de status é um novo evento imutável — `startedAt`/`completedAt`/`owner`/`targetDate`/`notes` (pedidos pela missão) nunca são colunas próprias; são sempre **derivados** por `deriveDecisionExecutionState()` a partir da sequência de eventos.

### `DECISION_EXECUTION_STATUSES` — 5 estados, vocabulário exato pedido pela missão

`NOT_STARTED` (implícito — ausência de qualquer evento, nunca um evento real com este status, mesma convenção de `DiagnosisReviewStatus.PENDING`) / `IN_PROGRESS` / `BLOCKED` / `COMPLETED` / `CANCELLED`.

### Máquina de estados (`DecisionExecutionEvent.validator.ts`)

```
(nenhum evento) → IN_PROGRESS | CANCELLED
IN_PROGRESS     → IN_PROGRESS | BLOCKED | COMPLETED | CANCELLED
BLOCKED         → BLOCKED | IN_PROGRESS | CANCELLED
COMPLETED       → (terminal — nenhuma transição)
CANCELLED       → (terminal — nenhuma transição)
```

## `Outcome` — reaproveitado do Domain, quase sem alteração

`status` (`OutcomeStatus` — pending/positive/negative/neutral/inconclusive, inalterado, D-011) continua sendo a avaliação; `description` é sempre o que foi OBSERVADO; `expectedResult?` (novo, opcional) denormaliza o que se ESPERAVA no momento da decisão, apenas para comparação lado a lado — os dois campos nunca são confundidos ou fundidos.

## O que este módulo NÃO faz

- Não cria `DecisionExecutionEvent`/`Outcome` automaticamente — sempre um ato humano explícito (Server Action, fora deste módulo).
- A IA nunca executa, nunca altera status, nunca conclui resultado, nunca cria `Outcome` — nenhum import deste módulo aparece em `efos/infrastructure/executive-ai/`.
- Não constrói um motor de causalidade `Decision → Financial Truth` — apenas prepara a estrutura (`expectedResult`/`description`) para uma análise futura, nunca afirma que uma Decision causou um resultado financeiro.
- Não alimenta `Knowledge`/`LearningRecord` automaticamente — `Knowledge.derivedFromOutcomeIds` continua existindo apenas como contrato, nenhum código popula isso ainda (fronteira documentada, não implementada).

Ver `docs/DECISIONS.md`, D-070, e `docs/ENGINEERING_LOG.md`, Mission 138, para a auditoria completa e os cenários testados.
