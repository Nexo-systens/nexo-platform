import { LEARNING_ENGINE_MESSAGES } from "./learning.constants";
import type { LearningEngineInput } from "./learning.types";

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validador do Learning Engine. Responsavel exclusivamente por
 * validacao estrutural e de consistencia entre os cinco agregados de
 * entrada (EvidenceAggregate, ContextAggregate, ReasoningAggregate,
 * RecommendationAggregate, DecisionAggregate) — nunca valida regra de
 * negocio. Este Engine nao recebe `FinancialModelAggregate` (fora do
 * escopo da Mission 015, mesmo padrao do Decision Engine, Mission
 * 013) — `financialModelId` e obtido diretamente de
 * `decision.financialModelId`, usado como referencia para validar os
 * demais.
 */
export function validateLearningEngineInput(
  input: LearningEngineInput
): ValidationResult {
  const errors: string[] = [];

  if (!input.companyId) {
    errors.push(LEARNING_ENGINE_MESSAGES.missingCompanyId);
  }

  if (!input.decision) {
    errors.push(LEARNING_ENGINE_MESSAGES.missingDecision);
  } else if (input.companyId && input.decision.companyId !== input.companyId) {
    errors.push(LEARNING_ENGINE_MESSAGES.decisionCompanyMismatch);
  }

  const financialModelId = input.decision?.financialModelId;

  if (!input.evidence) {
    errors.push(LEARNING_ENGINE_MESSAGES.missingEvidence);
  } else {
    if (input.companyId && input.evidence.companyId !== input.companyId) {
      errors.push(LEARNING_ENGINE_MESSAGES.evidenceCompanyMismatch);
    }

    if (
      financialModelId &&
      input.evidence.financialModelId !== financialModelId
    ) {
      errors.push(LEARNING_ENGINE_MESSAGES.evidenceFinancialModelMismatch);
    }
  }

  if (!input.context) {
    errors.push(LEARNING_ENGINE_MESSAGES.missingContext);
  } else {
    if (input.companyId && input.context.companyId !== input.companyId) {
      errors.push(LEARNING_ENGINE_MESSAGES.contextCompanyMismatch);
    }

    if (
      financialModelId &&
      input.context.financialModelId !== financialModelId
    ) {
      errors.push(LEARNING_ENGINE_MESSAGES.contextFinancialModelMismatch);
    }
  }

  if (!input.reasoning) {
    errors.push(LEARNING_ENGINE_MESSAGES.missingReasoning);
  } else {
    if (input.companyId && input.reasoning.companyId !== input.companyId) {
      errors.push(LEARNING_ENGINE_MESSAGES.reasoningCompanyMismatch);
    }

    if (
      financialModelId &&
      input.reasoning.financialModelId !== financialModelId
    ) {
      errors.push(LEARNING_ENGINE_MESSAGES.reasoningFinancialModelMismatch);
    }
  }

  if (!input.recommendation) {
    errors.push(LEARNING_ENGINE_MESSAGES.missingRecommendation);
  } else {
    if (
      input.companyId &&
      input.recommendation.companyId !== input.companyId
    ) {
      errors.push(LEARNING_ENGINE_MESSAGES.recommendationCompanyMismatch);
    }

    if (
      financialModelId &&
      input.recommendation.financialModelId !== financialModelId
    ) {
      errors.push(
        LEARNING_ENGINE_MESSAGES.recommendationFinancialModelMismatch
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
