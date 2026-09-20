# Human Decision Lifecycle Composition (Mission 124)

## Objetivo

Formalizar a composição `ExecutiveDiagnosis → DiagnosisReview → Decision` — o ponto de aplicação que transforma um ato humano explícito numa `Decision` real (D-063), sem nunca criar essa composição automaticamente.

```
ExecutiveDiagnosis (D-059)         DiagnosisReview (D-063)
        \                                 /
         \                               /
          CreateHumanDecisionCommand (ids apenas)
                        ↓
              createHumanDecision()
                        ↓
                    Decision (D-063, basedOnDiagnosisId?/basedOnReviewId?/humanActorId)
```

## Regra fundamental (Etapa 5)

Nenhuma função aqui transforma `ExecutiveDiagnosis → Decision` automaticamente. A única composição válida exige **Human Review + Human Actor + Human Intent** — representados por `CreateHumanDecisionCommand.humanActorId` (obrigatório) e pelos campos de `decision data` que só um humano preenche (`title`/`description`/`rationale`).

## `createHumanDecision()`

Única função exportada capaz de produzir uma `Decision` humana. **Nunca**: importa `efos/engines/decision/` (o Decision Engine determinístico permanece inteiramente intocado — mesmo caminho de sempre, D-011); calcula indicador; interpreta dado; chama IA/provider; executa a decisão; cria `Outcome`; persiste qualquer coisa. `id`/`createdAt` são sempre recebidos como parâmetro — função pura.

Devolve `Result<Decision, CreateHumanDecisionError>` (reaproveita `Result<T,E>` já existente, `efos/application/shared/`) — nunca lança exceção.

## Cenários cobertos (Etapa 6)

- **A** — `ExecutiveDiagnosis` sozinho nunca basta (nenhuma função aqui aceita só um `diagnosisId` sem `humanActorId`).
- **B** — `DiagnosisReview ACCEPTED` pode ser referenciado (`reviewId`), mas `createHumanDecision()` continua exigindo ser chamada explicitamente — a revisão não cria a decisão sozinha.
- **C** — `DiagnosisReview REJECTED` nunca produz uma `Decision` automática — mas nada impede uma `Decision` humana que referencia esse review (Cenário E).
- **D** — `DiagnosisReview PARTIALLY_ACCEPTED` pode ser referenciado por uma `Decision`, preservando (via `basedOnReviewId`) que o humano não aceitou tudo.
- **E** — a IA pode sugerir X, o review pode rejeitar X, e a `Decision` humana pode ser Y — nenhuma checagem de consistência é feita, contradição nunca é erro.
- **F** — uma `Decision` humana pode existir sem nenhum `diagnosisId`/`reviewId` — totalmente independente da IA.
- **G** — múltiplas `Decision`s podem referenciar o mesmo `reviewId`/`diagnosisId` — nenhuma restrição de cardinalidade.

## O que este módulo NÃO faz

- Não integra UI, banco, Supabase, API route, autenticação.
- Não chama o Decision Engine (`efos/engines/decision/`) — os dois caminhos de produzir uma `Decision` (determinístico vs. humano) permanecem estruturalmente distintos e nunca se chamam.
- Não cria `Outcome`/`LearningRecord`.
- Não integra Anthropic/nenhuma IA.
- Não valida o conteúdo de um `ExecutiveDiagnosis`/`DiagnosisReview` real — só aceita os ids que o chamador já resolveu.

Ver `docs/DECISIONS.md` e `docs/ENGINEERING_LOG.md`, Mission 124, para a auditoria completa e os 14 cenários testados.
