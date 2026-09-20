import { FINANCIAL_KNOWLEDGE_GRAPH_ENGINE_MESSAGES } from "./financial-knowledge-graph.constants";
import type { FinancialKnowledgeGraphEngineInput } from "./financial-knowledge-graph.types";

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validador do Financial Knowledge Graph Engine. Responsavel
 * exclusivamente por validacao estrutural e de consistencia entre os
 * dois agregados de entrada (FinancialModelAggregate, IndicatorsAggregate)
 * — nunca valida regra de negocio.
 */
export function validateFinancialKnowledgeGraphEngineInput(
  input: FinancialKnowledgeGraphEngineInput
): ValidationResult {
  const errors: string[] = [];

  if (!input.companyId) {
    errors.push(FINANCIAL_KNOWLEDGE_GRAPH_ENGINE_MESSAGES.missingCompanyId);
  }

  if (!input.financialModel) {
    errors.push(FINANCIAL_KNOWLEDGE_GRAPH_ENGINE_MESSAGES.missingFinancialModel);
  } else if (!input.financialModel.root) {
    errors.push(
      FINANCIAL_KNOWLEDGE_GRAPH_ENGINE_MESSAGES.missingFinancialModelRoot
    );
  } else if (
    input.companyId &&
    input.financialModel.root.companyId !== input.companyId
  ) {
    errors.push(
      FINANCIAL_KNOWLEDGE_GRAPH_ENGINE_MESSAGES.financialModelCompanyMismatch
    );
  }

  if (!input.indicators) {
    errors.push(FINANCIAL_KNOWLEDGE_GRAPH_ENGINE_MESSAGES.missingIndicators);
  } else {
    if (input.companyId && input.indicators.companyId !== input.companyId) {
      errors.push(
        FINANCIAL_KNOWLEDGE_GRAPH_ENGINE_MESSAGES.indicatorsCompanyMismatch
      );
    }

    if (
      input.financialModel?.root &&
      input.indicators.financialModelId !== input.financialModel.root.id
    ) {
      errors.push(
        FINANCIAL_KNOWLEDGE_GRAPH_ENGINE_MESSAGES.indicatorsFinancialModelMismatch
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
