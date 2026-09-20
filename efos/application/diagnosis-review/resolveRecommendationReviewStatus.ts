import type { DiagnosisReview, DiagnosisReviewModification } from "./DiagnosisReview";

/**
 * Mission 152 — Production Recommendation-to-Decision Learning Loop.
 *
 * **Achado da auditoria obrigatória (Etapa 2/7)**: `DiagnosisReview`
 * (D-063, Mission 123) já distingue `acceptedItems`/`rejectedItems`/
 * `modifiedItems` — mas nenhum mecanismo existente respondia, para um
 * `recommendationId` específico, "qual foi o veredito humano sobre
 * este item, se houve algum". Esta é a extensão mínima que fecha essa
 * lacuna, sem alterar `DiagnosisReview`/`validateDiagnosisReview()`
 * (D-063, intocados).
 *
 * **Decisão arquitetural (Etapa 2 — "decidir com base em evidência se
 * uma Recommendation rejeitada deve continuar selecionável")**: SIM,
 * uma Recommendation rejeitada continua selecionável para uma futura
 * `Decision` — mesmo princípio já testado desde a Mission 150 (Human
 * Override/Rejection, D-082): `DiagnosisReview` é o julgamento sobre o
 * DIAGNÓSTICO, `Decision` é um ato humano SEPARADO (D-063, Etapa 6:
 * "a decisão humana em si é sempre um artefato separado, nunca
 * implícito na revisão"); bloquear a seleção violaria essa separação
 * deliberada. Em vez de bloquear, este mecanismo apenas TORNA VISÍVEL
 * o status da revisão (Etapa 20 — UI deve mostrar, nunca esconder,
 * contexto real) — a decisão de prosseguir continua sempre do humano.
 *
 * Pura, determinística — nenhum acesso a Supabase/banco/relógio.
 */
export type RecommendationReviewStatus = "ACCEPTED" | "REJECTED" | "MODIFIED";

export interface RecommendationReviewStatusResult {
  readonly status: RecommendationReviewStatus;
  readonly modification?: DiagnosisReviewModification;
}

/**
 * Devolve `undefined` quando o item nunca apareceu em nenhuma das 3
 * listas do review — "ainda não avaliado neste review", nunca
 * confundido com `REJECTED` (mesma disciplina de honestidade de
 * `DiagnosisReviewStatus.PENDING`, D-063: ausência de avaliação nunca
 * é fabricada como um veredito).
 */
export function resolveRecommendationReviewStatus(
  recommendationId: string,
  review: DiagnosisReview | undefined
): RecommendationReviewStatusResult | undefined {
  if (!review) return undefined;

  if (review.acceptedItems.includes(recommendationId)) {
    return { status: "ACCEPTED" };
  }
  if (review.rejectedItems.includes(recommendationId)) {
    return { status: "REJECTED" };
  }
  const modification = review.modifiedItems.find((item) => item.originalItemId === recommendationId);
  if (modification) {
    return { status: "MODIFIED", modification };
  }

  return undefined;
}
