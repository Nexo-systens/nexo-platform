import type { DiagnosisReview } from "./DiagnosisReview";

export interface DiagnosisReviewValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function isNonEmptyString(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Valida um `DiagnosisReview` contra as invariantes mínimas exigidas
 * pela Etapa 5 (Mission 123) — nunca valida conteúdo semântico
 * ("essa revisão faz sentido?"), apenas a estrutura que garante que
 * cada `status` responde honestamente "o que o humano fez": `ACCEPTED`
 * nunca convive com item rejeitado; `REJECTED` nunca convive com item
 * aceito; `PARTIALLY_ACCEPTED` exige pelo menos um item aceito e pelo
 * menos um item não aceito (rejeitado ou modificado) — senão seria só
 * `ACCEPTED`/`REJECTED`; nenhum item aparece em mais de uma lista
 * (um item não pode ser simultaneamente aceito e rejeitado). Função
 * pura — nunca lança exceção, sempre devolve a lista completa de
 * problemas encontrados.
 */
export function validateDiagnosisReview(
  review: DiagnosisReview
): DiagnosisReviewValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyString(review.id)) {
    errors.push("DiagnosisReview.id é obrigatório e não pode ser vazio.");
  }
  if (!isNonEmptyString(review.diagnosisId)) {
    errors.push("DiagnosisReview.diagnosisId é obrigatório — toda revisão precisa apontar para um ExecutiveDiagnosis real.");
  }
  if (!isNonEmptyString(review.reviewedBy)) {
    errors.push("DiagnosisReview.reviewedBy é obrigatório — nenhuma revisão pode ser anônima.");
  }
  if (!isNonEmptyString(review.reviewedAt)) {
    errors.push("DiagnosisReview.reviewedAt é obrigatório.");
  }

  const modifiedIds = review.modifiedItems.map((m) => m.originalItemId);
  const allReferencedIds = [...review.acceptedItems, ...review.rejectedItems, ...modifiedIds];
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const id of allReferencedIds) {
    if (seen.has(id)) duplicated.add(id);
    seen.add(id);
  }
  if (duplicated.size > 0) {
    errors.push(
      `Item(ns) referenciado(s) em mais de uma lista (aceito/rejeitado/modificado) — um item não pode ter dois destinos: ${[...duplicated].join(", ")}.`
    );
  }

  review.modifiedItems.forEach((modification, index) => {
    if (!isNonEmptyString(modification.originalItemId)) {
      errors.push(`modifiedItems[${index}] sem originalItemId.`);
    }
    if (!isNonEmptyString(modification.humanStatement)) {
      errors.push(`modifiedItems[${index}] sem humanStatement — uma modificação sem o texto do humano não é distinguível do item original da IA.`);
    }
  });

  switch (review.status) {
    case "ACCEPTED":
      if (review.rejectedItems.length > 0 || review.modifiedItems.length > 0) {
        errors.push('status "ACCEPTED" não pode conter rejectedItems/modifiedItems — aceitação integral não convive com item rejeitado ou modificado.');
      }
      break;
    case "REJECTED":
      if (review.acceptedItems.length > 0 || review.modifiedItems.length > 0) {
        errors.push('status "REJECTED" não pode conter acceptedItems/modifiedItems — rejeição integral não convive com item aceito ou modificado.');
      }
      break;
    case "PARTIALLY_ACCEPTED":
      if (review.acceptedItems.length === 0) {
        errors.push('status "PARTIALLY_ACCEPTED" exige ao menos um item em acceptedItems — senão é REJECTED.');
      }
      if (review.rejectedItems.length === 0 && review.modifiedItems.length === 0) {
        errors.push('status "PARTIALLY_ACCEPTED" exige ao menos um item em rejectedItems ou modifiedItems — senão é ACCEPTED.');
      }
      break;
    case "PENDING":
      errors.push('status "PENDING" nunca deve existir como um DiagnosisReview real — "ainda não revisado" é representado pela AUSÊNCIA de um DiagnosisReview, não por um com este status.');
      break;
    case "SUPERSEDED":
      // Sem invariante adicional — um review substituído preserva o que continha no momento em que foi superado.
      break;
    default:
      errors.push(`status desconhecido: "${review.status}".`);
  }

  return { valid: errors.length === 0, errors };
}
