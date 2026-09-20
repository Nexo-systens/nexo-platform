import { FINANCIAL_MODEL_ENGINE_MESSAGES } from "./financial-model.constants";
import type {
  FinancialModelEngineInput,
  NormalizedFinancialRecord,
} from "./financial-model.types";

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validador do Financial Model Engine. Responsavel exclusivamente por
 * validacao estrutural (presenca e forma dos campos) — nunca valida
 * regra de negocio (ex.: se um valor financeiro "faz sentido").
 */
function validateRecord(
  record: NormalizedFinancialRecord,
  index: number
): string[] {
  const errors: string[] = [];
  const prefix = `records[${index}]`;

  if (!record.recordId) {
    errors.push(`${prefix}: ${FINANCIAL_MODEL_ENGINE_MESSAGES.missingRecordId}`);
  }

  if (!record.label) {
    errors.push(`${prefix}: ${FINANCIAL_MODEL_ENGINE_MESSAGES.missingLabel}`);
  }

  if (!record.source) {
    errors.push(`${prefix}: ${FINANCIAL_MODEL_ENGINE_MESSAGES.missingSource}`);
  }

  if (record.kind === "resource" && !record.resourceType) {
    errors.push(`${prefix}: ${FINANCIAL_MODEL_ENGINE_MESSAGES.missingResourceType}`);
  }

  if (record.kind === "event") {
    if (!record.eventType) {
      errors.push(`${prefix}: ${FINANCIAL_MODEL_ENGINE_MESSAGES.missingEventType}`);
    }
    if (!record.occurredAt) {
      errors.push(`${prefix}: ${FINANCIAL_MODEL_ENGINE_MESSAGES.missingOccurredAt}`);
    }
  }

  // Mission 192 — Canonical Financial Statement Ingestion & Period
  // Semantics, D-106: um valor de demonstrativo agregado por período
  // (DRE) exige `statementCategory`+`period` — NUNCA `occurredAt`
  // (Seção 6 da missão, invariante fundamental: "period aggregate ≠
  // dated transaction"). Um registro que carregasse os dois seria
  // ambíguo sobre qual forma econômica realmente é; rejeitado
  // explicitamente em vez de silenciosamente preferir um dos dois.
  if (record.kind === "statement_line") {
    if (!record.statementCategory) {
      errors.push(
        `${prefix}: ${FINANCIAL_MODEL_ENGINE_MESSAGES.missingStatementCategory}`
      );
    }
    if (!record.period) {
      errors.push(
        `${prefix}: ${FINANCIAL_MODEL_ENGINE_MESSAGES.missingStatementPeriod}`
      );
    }
    if (record.occurredAt) {
      errors.push(
        `${prefix}: ${FINANCIAL_MODEL_ENGINE_MESSAGES.unexpectedOccurredAtForStatementLine}`
      );
    }
  }

  return errors;
}

export function validateFinancialModelEngineInput(
  input: FinancialModelEngineInput
): ValidationResult {
  const errors: string[] = [];

  if (!input.companyId) {
    errors.push(FINANCIAL_MODEL_ENGINE_MESSAGES.missingCompanyId);
  }

  if (!input.records || input.records.length === 0) {
    errors.push(FINANCIAL_MODEL_ENGINE_MESSAGES.emptyRecords);
    return { valid: errors.length === 0, errors };
  }

  const seenIds = new Set<string>();

  input.records.forEach((record, index) => {
    errors.push(...validateRecord(record, index));

    if (record.recordId) {
      if (seenIds.has(record.recordId)) {
        errors.push(
          `records[${index}]: ${FINANCIAL_MODEL_ENGINE_MESSAGES.duplicateRecordId} (${record.recordId})`
        );
      }
      seenIds.add(record.recordId);
    }
  });

  return { valid: errors.length === 0, errors };
}
