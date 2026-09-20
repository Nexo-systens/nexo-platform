import { REASONING_ENGINE_MESSAGES } from "./reasoning.constants";
import type { ReasoningEngineInput } from "./reasoning.types";

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validador do Reasoning Engine. Responsavel exclusivamente por
 * validacao estrutural e de consistencia entre os cinco agregados de
 * entrada (FinancialModelAggregate, IndicatorsAggregate,
 * FinancialKnowledgeGraphAggregate, EvidenceAggregate,
 * ContextAggregate) — nunca valida regra de negocio.
 */
export function validateReasoningEngineInput(
  input: ReasoningEngineInput
): ValidationResult {
  const errors: string[] = [];

  if (!input.companyId) {
    errors.push(REASONING_ENGINE_MESSAGES.missingCompanyId);
  }

  if (!input.financialModel) {
    errors.push(REASONING_ENGINE_MESSAGES.missingFinancialModel);
  } else if (!input.financialModel.root) {
    errors.push(REASONING_ENGINE_MESSAGES.missingFinancialModelRoot);
  } else if (
    input.companyId &&
    input.financialModel.root.companyId !== input.companyId
  ) {
    errors.push(REASONING_ENGINE_MESSAGES.financialModelCompanyMismatch);
  }

  if (!input.indicators) {
    errors.push(REASONING_ENGINE_MESSAGES.missingIndicators);
  } else {
    if (input.companyId && input.indicators.companyId !== input.companyId) {
      errors.push(REASONING_ENGINE_MESSAGES.indicatorsCompanyMismatch);
    }

    if (
      input.financialModel?.root &&
      input.indicators.financialModelId !== input.financialModel.root.id
    ) {
      errors.push(REASONING_ENGINE_MESSAGES.indicatorsFinancialModelMismatch);
    }
  }

  if (!input.financialKnowledgeGraph) {
    errors.push(REASONING_ENGINE_MESSAGES.missingFinancialKnowledgeGraph);
  } else {
    if (
      input.companyId &&
      input.financialKnowledgeGraph.companyId !== input.companyId
    ) {
      errors.push(REASONING_ENGINE_MESSAGES.graphCompanyMismatch);
    }

    if (
      input.financialModel?.root &&
      input.financialKnowledgeGraph.financialModelId !==
        input.financialModel.root.id
    ) {
      errors.push(REASONING_ENGINE_MESSAGES.graphFinancialModelMismatch);
    }
  }

  if (!input.evidence) {
    errors.push(REASONING_ENGINE_MESSAGES.missingEvidence);
  } else {
    if (input.companyId && input.evidence.companyId !== input.companyId) {
      errors.push(REASONING_ENGINE_MESSAGES.evidenceCompanyMismatch);
    }

    if (
      input.financialModel?.root &&
      input.evidence.financialModelId !== input.financialModel.root.id
    ) {
      errors.push(REASONING_ENGINE_MESSAGES.evidenceFinancialModelMismatch);
    }
  }

  if (!input.context) {
    errors.push(REASONING_ENGINE_MESSAGES.missingContext);
  } else {
    if (input.companyId && input.context.companyId !== input.companyId) {
      errors.push(REASONING_ENGINE_MESSAGES.contextCompanyMismatch);
    }

    if (
      input.financialModel?.root &&
      input.context.financialModelId !== input.financialModel.root.id
    ) {
      errors.push(REASONING_ENGINE_MESSAGES.contextFinancialModelMismatch);
    }
  }

  return { valid: errors.length === 0, errors };
}
