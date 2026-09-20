import type { InterpretationBasis } from "@/efos/application/executive-diagnosis";
import type { ExecutiveKnowledgeContext } from "@/efos/application/executive-knowledge-context";

import type { ExecutiveChatAnswer } from "./ExecutiveChatAnswer.types";

/**
 * Mesmo mecanismo de `validateKnowledgeReferences()` (D-081, Mission
 * 149) aplicado a `ExecutiveChatAnswer` — nunca uma segunda
 * implementação dos 3 critérios de relevância (`selectRelevantKnowledge()`,
 * D-074, nunca duplicado): `knowledgeId ∈
 * knowledgeContext.knowledge.map(k => k.id)` continua sendo a mesma
 * verificação de "empresa correta ∧ não é futuro ∧ estruturalmente
 * válido ∧ passou pelo relevance filter".
 */
export interface ChatKnowledgeReferenceValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const BASIS_BEARING_FIELDS = ["factualClaims", "analysis", "hypotheses"] as const;

export function validateExecutiveChatKnowledgeReferences(
  answer: ExecutiveChatAnswer,
  knowledgeContext: ExecutiveKnowledgeContext | undefined
): ChatKnowledgeReferenceValidationResult {
  const errors: string[] = [];
  const availableIds = new Set((knowledgeContext?.knowledge ?? []).map((k) => k.id));

  function checkBasis(basis: InterpretationBasis | undefined, label: string): void {
    for (const knowledgeId of basis?.knowledgeIds ?? []) {
      if (!availableIds.has(knowledgeId)) {
        errors.push(
          `${label} cita knowledgeId "${knowledgeId}" que não pertence a knowledgeContext.knowledge — nenhuma referência a Knowledge inexistente, de outra empresa, futuro, ou excluído pelo filtro de relevância é aceita.`
        );
      }
    }
  }

  for (const field of BASIS_BEARING_FIELDS) {
    answer[field].forEach((item, index) => checkBasis(item.basis, `${field}[${index}]`));
  }

  return { valid: errors.length === 0, errors };
}
