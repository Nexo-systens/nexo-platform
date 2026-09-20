import { OUTCOME_STATUSES, type Outcome } from "@/efos/domain";

export interface OutcomeValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function isNonEmptyString(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Valida um `Outcome` (`efos/domain/entities/Outcome.ts`, D-011)
 * antes de persistir. Vive na Application Layer, não no Domain — a
 * mesma distinção já estabelecida para `DiagnosisReview`/`Decision`
 * humana (D-063/D-064): `Outcome`, nesta missão, é sempre um dado
 * fornecido por um humano através de uma UI (nunca produzido por um
 * Engine determinístico), então precisa da mesma disciplina de
 * validação de entrada não confiável que todo dado humano já recebe —
 * ao contrário de uma entidade de Domain construída inteiramente por
 * um Engine (sempre confiável por construção, nunca validada em
 * runtime). `Outcome` continua sendo um tipo do Domain (ele já existia
 * lá desde a Mission 003/D-011) — só o *validador* vive aqui.
 *
 * **Etapa 14/18.M da missão — Expected nunca é confundido com
 * Observed**: `description` é sempre o que de fato aconteceu
 * (observado); `expectedResult` (quando presente) é sempre o que se
 * esperava, denormalizado do momento da decisão apenas para
 * comparação lado a lado — este validador rejeita um `Outcome` cujo
 * `description` esteja vazio (nunca aceita "o esperado" como
 * substituto do que foi de fato observado).
 */
export function validateOutcome(outcome: Outcome): OutcomeValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyString(outcome.id)) {
    errors.push("Outcome.id é obrigatório.");
  }
  if (!isNonEmptyString(outcome.companyId)) {
    errors.push("Outcome.companyId é obrigatório.");
  }
  if (!isNonEmptyString(outcome.decisionId)) {
    errors.push("Outcome.decisionId é obrigatório — todo Outcome precisa apontar para uma Decision real.");
  }
  if (!isNonEmptyString(outcome.observedAt)) {
    errors.push("Outcome.observedAt é obrigatório.");
  }
  if (!isNonEmptyString(outcome.description)) {
    errors.push("Outcome.description é obrigatório — um Outcome sem descrição do que foi observado não representa nada.");
  }
  if (!isNonEmptyString(outcome.recordedBy)) {
    errors.push("Outcome.recordedBy é obrigatório para todo Outcome registrado por um humano — nenhum Outcome pode ser anônimo (mesma regra de DiagnosisReview.reviewedBy).");
  }
  if (!OUTCOME_STATUSES.includes(outcome.status)) {
    errors.push(`status desconhecido: "${outcome.status}".`);
  }

  return { valid: errors.length === 0, errors };
}
