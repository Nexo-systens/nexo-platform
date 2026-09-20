import { KNOWLEDGE_CATEGORIES, type Knowledge } from "@/efos/domain";

export interface KnowledgeValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function isNonEmptyString(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Valida um `Knowledge` formado (Mission 141) antes de persistir —
 * mesma disciplina de `validateLearningRecord()` (Mission 140).
 * **Rastreabilidade obrigatória (Etapa 8/12.E-F da missão)**: todo
 * `Knowledge` desta missão precisa referenciar ao menos 1
 * `LearningRecord` real (`derivedFromLearningRecordIds`) — nunca um
 * conhecimento sem origem. `derivedFromOutcomeIds` pode legitimamente
 * ser vazio (grupo `recurring_observation`, sem nenhum `Outcome`
 * humano ainda), mas nunca `undefined`.
 */
export function validateKnowledge(knowledge: Knowledge): KnowledgeValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyString(knowledge.id)) errors.push("Knowledge.id é obrigatório.");
  if (!isNonEmptyString(knowledge.companyId)) errors.push("Knowledge.companyId é obrigatório.");
  if (!isNonEmptyString(knowledge.statement)) errors.push("Knowledge.statement é obrigatório.");

  if (!KNOWLEDGE_CATEGORIES.includes(knowledge.category)) {
    errors.push(`Knowledge.category desconhecida: "${knowledge.category}".`);
  }

  if (!Array.isArray(knowledge.derivedFromOutcomeIds)) {
    errors.push("Knowledge.derivedFromOutcomeIds é obrigatório (pode ser vazio, nunca ausente).");
  }

  if (!knowledge.derivedFromLearningRecordIds || knowledge.derivedFromLearningRecordIds.length === 0) {
    errors.push(
      "Knowledge sem origem rastreável — precisa referenciar ao menos 1 LearningRecord real (derivedFromLearningRecordIds), nunca um conhecimento sem evidência."
    );
  }

  return { valid: errors.length === 0, errors };
}
