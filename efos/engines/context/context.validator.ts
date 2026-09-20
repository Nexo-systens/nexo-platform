import { CONTEXT_ENGINE_MESSAGES } from "./context.constants";
import type { ContextEngineInput } from "./context.types";

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validador do Context Engine. Responsavel exclusivamente por
 * validacao estrutural e de consistencia entre os quatro agregados de
 * entrada (FinancialModelAggregate, IndicatorsAggregate,
 * FinancialKnowledgeGraphAggregate, EvidenceAggregate) — nunca valida
 * regra de negocio.
 */
export function validateContextEngineInput(
  input: ContextEngineInput
): ValidationResult {
  const errors: string[] = [];

  if (!input.companyId) {
    errors.push(CONTEXT_ENGINE_MESSAGES.missingCompanyId);
  }

  if (!input.financialModel) {
    errors.push(CONTEXT_ENGINE_MESSAGES.missingFinancialModel);
  } else if (!input.financialModel.root) {
    errors.push(CONTEXT_ENGINE_MESSAGES.missingFinancialModelRoot);
  } else if (
    input.companyId &&
    input.financialModel.root.companyId !== input.companyId
  ) {
    errors.push(CONTEXT_ENGINE_MESSAGES.financialModelCompanyMismatch);
  }

  if (!input.indicators) {
    errors.push(CONTEXT_ENGINE_MESSAGES.missingIndicators);
  } else {
    if (input.companyId && input.indicators.companyId !== input.companyId) {
      errors.push(CONTEXT_ENGINE_MESSAGES.indicatorsCompanyMismatch);
    }

    if (
      input.financialModel?.root &&
      input.indicators.financialModelId !== input.financialModel.root.id
    ) {
      errors.push(CONTEXT_ENGINE_MESSAGES.indicatorsFinancialModelMismatch);
    }
  }

  if (!input.financialKnowledgeGraph) {
    errors.push(CONTEXT_ENGINE_MESSAGES.missingFinancialKnowledgeGraph);
  } else {
    if (
      input.companyId &&
      input.financialKnowledgeGraph.companyId !== input.companyId
    ) {
      errors.push(CONTEXT_ENGINE_MESSAGES.graphCompanyMismatch);
    }

    if (
      input.financialModel?.root &&
      input.financialKnowledgeGraph.financialModelId !==
        input.financialModel.root.id
    ) {
      errors.push(CONTEXT_ENGINE_MESSAGES.graphFinancialModelMismatch);
    }
  }

  if (!input.evidence) {
    errors.push(CONTEXT_ENGINE_MESSAGES.missingEvidence);
  } else {
    if (input.companyId && input.evidence.companyId !== input.companyId) {
      errors.push(CONTEXT_ENGINE_MESSAGES.evidenceCompanyMismatch);
    }

    if (
      input.financialModel?.root &&
      input.evidence.financialModelId !== input.financialModel.root.id
    ) {
      errors.push(CONTEXT_ENGINE_MESSAGES.evidenceFinancialModelMismatch);
    }
  }

  return { valid: errors.length === 0, errors };
}
