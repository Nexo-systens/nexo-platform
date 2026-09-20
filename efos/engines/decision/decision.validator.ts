import { DECISION_ENGINE_MESSAGES } from "./decision.constants";
import type { DecisionEngineInput } from "./decision.types";

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validador do Decision Engine. Responsavel exclusivamente por
 * validacao estrutural e de consistencia entre os quatro agregados de
 * entrada (EvidenceAggregate, ContextAggregate, ReasoningAggregate,
 * RecommendationAggregate) — nunca valida regra de negocio. Este
 * Engine nao recebe `FinancialModelAggregate` (fora do escopo da
 * Mission 013) — `financialModelId` e obtido diretamente de
 * `recommendation.financialModelId`, usado como referencia para
 * validar os demais.
 */
export function validateDecisionEngineInput(
  input: DecisionEngineInput
): ValidationResult {
  const errors: string[] = [];

  if (!input.companyId) {
    errors.push(DECISION_ENGINE_MESSAGES.missingCompanyId);
  }

  if (!input.recommendation) {
    errors.push(DECISION_ENGINE_MESSAGES.missingRecommendation);
  } else if (
    input.companyId &&
    input.recommendation.companyId !== input.companyId
  ) {
    errors.push(DECISION_ENGINE_MESSAGES.recommendationCompanyMismatch);
  }

  const financialModelId = input.recommendation?.financialModelId;

  if (!input.evidence) {
    errors.push(DECISION_ENGINE_MESSAGES.missingEvidence);
  } else {
    if (input.companyId && input.evidence.companyId !== input.companyId) {
      errors.push(DECISION_ENGINE_MESSAGES.evidenceCompanyMismatch);
    }

    if (
      financialModelId &&
      input.evidence.financialModelId !== financialModelId
    ) {
      errors.push(DECISION_ENGINE_MESSAGES.evidenceFinancialModelMismatch);
    }
  }

  if (!input.context) {
    errors.push(DECISION_ENGINE_MESSAGES.missingContext);
  } else {
    if (input.companyId && input.context.companyId !== input.companyId) {
      errors.push(DECISION_ENGINE_MESSAGES.contextCompanyMismatch);
    }

    if (
      financialModelId &&
      input.context.financialModelId !== financialModelId
    ) {
      errors.push(DECISION_ENGINE_MESSAGES.contextFinancialModelMismatch);
    }
  }

  if (!input.reasoning) {
    errors.push(DECISION_ENGINE_MESSAGES.missingReasoning);
  } else {
    if (input.companyId && input.reasoning.companyId !== input.companyId) {
      errors.push(DECISION_ENGINE_MESSAGES.reasoningCompanyMismatch);
    }

    if (
      financialModelId &&
      input.reasoning.financialModelId !== financialModelId
    ) {
      errors.push(DECISION_ENGINE_MESSAGES.reasoningFinancialModelMismatch);
    }
  }

  return { valid: errors.length === 0, errors };
}
