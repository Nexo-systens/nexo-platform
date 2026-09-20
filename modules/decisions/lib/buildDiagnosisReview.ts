import type {
  DiagnosisReview,
  DiagnosisReviewModification,
  DiagnosisReviewStatus,
} from "@/efos/application/diagnosis-review/DiagnosisReview";
import { validateDiagnosisReview } from "@/efos/application/diagnosis-review/DiagnosisReview.validator";
import type { Result } from "@/efos/application/shared";

export interface BuildDiagnosisReviewInput {
  readonly diagnosisId: string;
  readonly status: DiagnosisReviewStatus;
  readonly acceptedItems?: readonly string[];
  readonly rejectedItems?: readonly string[];
  readonly modifiedItems?: readonly DiagnosisReviewModification[];
  readonly notes?: string;
}

export interface BuildDiagnosisReviewError {
  readonly code: "INVALID_REVIEW";
  readonly errors: readonly string[];
}

/**
 * Composição pura de um `DiagnosisReview` (Mission 125 — Human
 * Decision Lifecycle Activation) — separada da Server Action
 * (`modules/decisions/actions/human-review.actions.ts`) exatamente
 * como `createHumanDecision()` já é pura e separada da resolução de
 * autenticação (Mission 124): `reviewedBy` é sempre recebido como
 * parâmetro já resolvido, nunca lido de sessão aqui — quem chama esta
 * função (a Server Action) é responsável por obter o id do usuário
 * autenticado via `getCurrentUser()` antes de chamar. `id`/
 * `reviewedAt` também são sempre parâmetros — função determinística,
 * nunca gera `randomUUID()`/`Date.now()` internamente.
 */
export function buildDiagnosisReview(
  input: BuildDiagnosisReviewInput,
  reviewedBy: string,
  id: string,
  reviewedAt: string
): Result<DiagnosisReview, BuildDiagnosisReviewError> {
  const review: DiagnosisReview = {
    id,
    diagnosisId: input.diagnosisId,
    reviewedBy,
    status: input.status,
    reviewedAt,
    acceptedItems: input.acceptedItems ?? [],
    rejectedItems: input.rejectedItems ?? [],
    modifiedItems: input.modifiedItems ?? [],
    notes: input.notes,
  };

  const validation = validateDiagnosisReview(review);
  if (!validation.valid) {
    return { success: false, error: { code: "INVALID_REVIEW", errors: validation.errors } };
  }

  return { success: true, value: review };
}
