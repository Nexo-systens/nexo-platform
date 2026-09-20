import { INDICATORS_ENGINE_MESSAGES } from "./indicators.constants";
import type { IndicatorsEngineInput } from "./indicators.types";

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validador do Indicators Engine. Responsavel exclusivamente por
 * validacao estrutural (presenca e consistencia de campos) — nunca
 * valida se os valores financeiros "fazem sentido" (isso nao e
 * responsabilidade deste Engine).
 */
export function validateIndicatorsEngineInput(
  input: IndicatorsEngineInput
): ValidationResult {
  const errors: string[] = [];

  if (!input.companyId) {
    errors.push(INDICATORS_ENGINE_MESSAGES.missingCompanyId);
  }

  if (!input.financialModel) {
    errors.push(INDICATORS_ENGINE_MESSAGES.missingFinancialModel);
    return { valid: errors.length === 0, errors };
  }

  if (!input.financialModel.root) {
    errors.push(INDICATORS_ENGINE_MESSAGES.missingFinancialModelRoot);
    return { valid: errors.length === 0, errors };
  }

  if (
    input.companyId &&
    input.financialModel.root.companyId !== input.companyId
  ) {
    errors.push(INDICATORS_ENGINE_MESSAGES.financialModelCompanyMismatch);
  }

  return { valid: errors.length === 0, errors };
}
