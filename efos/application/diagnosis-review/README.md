# Diagnosis Review Contract (Mission 123)

## Objetivo

Formalizar o elo `ExecutiveDiagnosis → Human Review` que a Mission 122 auditou como estruturalmente `UNAVAILABLE`. `DiagnosisReview` (`DiagnosisReview.ts`) representa o julgamento humano explícito sobre um `ExecutiveDiagnosis` (`efos/application/executive-diagnosis/`, D-059) — nunca uma decisão em si, apenas o que o humano concluiu ao revisá-lo.

```
ExecutiveFinancialContext (D-058)
        ↓
ExecutiveDiagnosis (D-059) — interpretação NÃO CONFIÁVEL da IA
        ↓
DiagnosisReview (D-063) — julgamento humano explícito
        ↓
Decision (D-011, estendido por D-063) — decisão humana OU proposta determinística
        ↓
Outcome / LearningRecord (inalterados)
```

## Por que Application, não Domain?

Mesma decisão de camada já tomada para `ExecutiveDiagnosis` (Mission 115): `DiagnosisReview` não é um fato determinístico do Domain — é a fronteira de autoridade entre uma interpretação não confiável (IA) e o julgamento humano. Auditado explicitamente (Mission 123, Etapa 3): nenhum dos campos do contrato (`diagnosisId`, `reviewedBy`, `status`, `reviewedAt`, `acceptedItems`, `rejectedItems`, `modifiedItems`, `notes?`) pertence ao Domain.

## Separação de autoria (Etapa 6)

`AI authored ≠ Human reviewed ≠ Human decided` — três artefatos distintos, nunca fundidos:

- **AI authored** — `ExecutiveDiagnosis` (D-059), sempre untrusted.
- **Human reviewed** — `DiagnosisReview` (este módulo): o que o humano concluiu sobre o diagnóstico (aceitou/rejeitou/modificou), nunca o que ele decidiu fazer.
- **Human decided** — `Decision` (`efos/domain/entities/Decision.ts`, D-063): um artefato **separado**, que pode inclusive seguir uma direção completamente diferente da sugestão da IA (cenário obrigatório: "IA sugere reduzir despesas → humano revisa e discorda → humano decide aumentar investimento comercial" — a `Decision` resultante nunca é atribuída à IA, mesmo referenciando o `DiagnosisReview` que a precedeu).

## `DiagnosisReviewStatus` — 5 estados, nenhum a mais

`PENDING` (implícito — ausência de `DiagnosisReview`, nunca um registro real com este status) / `ACCEPTED` / `PARTIALLY_ACCEPTED` / `REJECTED` / `SUPERSEDED`. Cada estado responde "o que o humano fez", nunca "o que a IA fez" — ver `DiagnosisReview.ts` para a definição completa de cada um.

## `validateDiagnosisReview()`

Nunca valida conteúdo semântico — apenas as invariantes estruturais mínimas: `ACCEPTED` nunca convive com item rejeitado/modificado; `REJECTED` nunca convive com item aceito/modificado; `PARTIALLY_ACCEPTED` exige ao menos 1 item aceito e ao menos 1 item não aceito; nenhum item aparece em mais de uma lista; `PENDING` nunca é um status válido para um `DiagnosisReview` real.

## O que este módulo NÃO faz

- Não cria nenhum `DiagnosisReview` automaticamente a partir de um `ExecutiveDiagnosis` — é sempre um ato humano explícito, fora do escopo desta missão (contrato apenas).
- Não integra UI, banco, Supabase, API route, autenticação.
- Não constrói uma `Decision` a partir de um `DiagnosisReview` — nenhuma função de composição foi criada; um consumidor futuro (Server Action, etc.) monta o objeto `Decision` manualmente usando os campos opcionais `basedOnDiagnosisId`/`basedOnReviewId`/`humanActorId` (D-063).

Ver `docs/DECISIONS.md`, D-063, e `docs/ENGINEERING_LOG.md`, Mission 123, para a auditoria completa e os 12 cenários testados.
