/**
 * `DiagnosisReview` (Mission 123 — Human Review & Decision Authority
 * Model). Formaliza o elo que a Mission 122 auditou como
 * estruturalmente `UNAVAILABLE`: o momento em que um humano avalia um
 * `ExecutiveDiagnosis` (`efos/application/executive-diagnosis/`,
 * Mission 115, D-059) e decide o que fazer com ele — aceitar,
 * rejeitar, aceitar parcialmente, ou modificar.
 *
 * Vive em `efos/application/diagnosis-review/`, nunca em
 * `efos/domain/` — mesma decisão de camada já tomada para
 * `ExecutiveDiagnosis` (Mission 115): este é o momento em que uma
 * interpretação **não confiável** (produzida pela IA) é submetida a
 * julgamento humano; não é um fato determinístico do Domain, é a
 * fronteira de autoridade em si (Etapa 3 desta missão, "Avaliar se
 * todos esses campos realmente pertencem ao Domain" — resposta: não).
 *
 * **Separação de autoria formalizada (Etapa 6)**: `DiagnosisReview`
 * nunca é "quem decidiu o quê fazer" — é exclusivamente "o que um
 * humano concluiu ao revisar um diagnóstico da IA". A decisão humana
 * em si (`Decision.humanActorId`/`basedOnReviewId`, ver
 * `efos/domain/entities/Decision.ts`, D-063) é sempre um artefato
 * **separado**, nunca implícito na revisão — mesmo quando o humano
 * decide algo completamente diferente do que a IA sugeriu (cenário
 * obrigatório da Etapa 6: "AI sugere reduzir despesas / Humano revisa
 * → discorda / Humano decide aumentar investimento comercial").
 *
 * **Nenhuma criação automática**: nenhum código de produção constrói
 * um `DiagnosisReview` a partir de um `ExecutiveDiagnosis`
 * automaticamente — é sempre um ato humano explícito, representado
 * aqui apenas como contrato de dado (Etapa 10 — "não implementar...
 * automatic review").
 */

/**
 * Estado da revisão — exatamente os 5 valores exigidos pela Etapa 5,
 * nenhum adicionado sem necessidade demonstrada. Cada valor responde
 * "o que o humano efetivamente fez", nunca "o que a IA fez":
 *
 * - `PENDING` — diagnóstico produzido, ainda não revisado por nenhum
 *   humano. Estado inicial implícito de todo `ExecutiveDiagnosis` que
 *   não tem `DiagnosisReview` associado — nunca persistido como um
 *   `DiagnosisReview` real com este status (um `DiagnosisReview`
 *   representa um ato humano que já ocorreu; "ainda não revisado" é a
 *   ausência de `DiagnosisReview`, não um `DiagnosisReview` vazio).
 * - `ACCEPTED` — o humano aceitou o diagnóstico integralmente.
 * - `PARTIALLY_ACCEPTED` — o humano aceitou parte, rejeitou/ignorou o
 *   resto (Cenário E, Etapa 7).
 * - `REJECTED` — o humano rejeitou o diagnóstico integralmente
 *   (Cenário A/D, Etapa 7) — nunca impede uma Decision humana
 *   subsequente em direção diferente (Cenário D).
 * - `SUPERSEDED` — este `DiagnosisReview` foi substituído por uma
 *   revisão posterior do mesmo diagnóstico (nunca editado in-place —
 *   mesma convenção de imutabilidade de todo artefato do EFOS,
 *   D-059).
 */
export const DIAGNOSIS_REVIEW_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "PARTIALLY_ACCEPTED",
  "REJECTED",
  "SUPERSEDED",
] as const;
export type DiagnosisReviewStatus = (typeof DIAGNOSIS_REVIEW_STATUSES)[number];

/**
 * Um item do diagnóstico que o humano reformulou antes de decidir
 * (Cenário C, Etapa 7) — `humanStatement` é sempre atribuído ao
 * humano, nunca gravado de volta no `ExecutiveDiagnosis` original
 * (que permanece imutável, Mission 115) nem confundido com o
 * `statement` da IA. `originalItemId` referencia qualquer item do
 * diagnóstico (`interpretations[].id`/`hypotheses[].id`/`risks[].id`/
 * `priorities[].id`/`possibleActions[].id`/`questions[].id`/
 * `uncertainties[].id`/`conflictInterpretations[].id`) — todos
 * compartilham o mesmo espaço de ids opacos dentro de um
 * `ExecutiveDiagnosis`, nunca colidem entre si.
 */
export interface DiagnosisReviewModification {
  readonly originalItemId: string;
  readonly humanStatement: string;
}

/**
 * `DiagnosisReview` — o julgamento humano explícito sobre um
 * `ExecutiveDiagnosis` (Etapa 4, Alternativa B). `diagnosisId`
 * referencia `ExecutiveDiagnosis.id` — fecha o elo `Decision →
 * ExecutiveDiagnosis` que a Mission 122 confirmou `UNAVAILABLE`,
 * agora via `DiagnosisReview` como intermediário, nunca uma
 * referência direta de `Decision` ao diagnóstico bruto.
 *
 * `acceptedItems`/`rejectedItems`/`modifiedItems` são mutuamente
 * exclusivos por item (um item nunca aparece em mais de uma lista) —
 * verificado por `validateDiagnosisReview()`, nunca pelo tipo em si
 * (TypeScript não expressa essa invariante estruturalmente).
 * `notes?` é comentário humano livre, opcional, nunca interpretado
 * por nenhuma regra determinística.
 */
export interface DiagnosisReview {
  readonly id: string;
  readonly diagnosisId: string;
  readonly reviewedBy: string;
  readonly status: DiagnosisReviewStatus;
  readonly reviewedAt: string;
  readonly acceptedItems: readonly string[];
  readonly rejectedItems: readonly string[];
  readonly modifiedItems: readonly DiagnosisReviewModification[];
  readonly notes?: string;
}
