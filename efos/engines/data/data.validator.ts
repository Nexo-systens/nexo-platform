import { DATA_ENGINE_CONSTANTS, DATA_ENGINE_MESSAGES } from "./data.constants";
import type {
  DataEngineInput,
  RawFinancialDocument,
  RawFinancialLine,
} from "./data.types";

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validador do Data Engine. Responsavel apenas por validar a estrutura
 * dos documentos recebidos — nunca normaliza, nunca transforma formato,
 * nunca julga se um valor financeiro "faz sentido".
 */
function validateLine(
  line: RawFinancialLine,
  docIndex: number,
  lineIndex: number
): string[] {
  const errors: string[] = [];
  const prefix = `documents[${docIndex}].lines[${lineIndex}]`;

  if (!line.label) {
    errors.push(`${prefix}: ${DATA_ENGINE_MESSAGES.missingLabel}`);
  }

  return errors;
}

function validateDocument(
  document: RawFinancialDocument,
  index: number
): string[] {
  const errors: string[] = [];
  const prefix = `documents[${index}]`;

  if (!document.documentId) {
    errors.push(`${prefix}: ${DATA_ENGINE_MESSAGES.missingDocumentId}`);
  }

  if (!document.source) {
    errors.push(`${prefix}: ${DATA_ENGINE_MESSAGES.missingSource}`);
  }

  if (!document.lines || document.lines.length === 0) {
    errors.push(`${prefix}: ${DATA_ENGINE_MESSAGES.missingRawContent}`);
  } else {
    document.lines.forEach((line, lineIndex) => {
      errors.push(...validateLine(line, index, lineIndex));
    });
  }

  return errors;
}

export function validateDataEngineInput(
  input: DataEngineInput
): ValidationResult {
  const errors: string[] = [];

  if (!input.companyId) {
    errors.push(DATA_ENGINE_MESSAGES.missingCompanyId);
  }

  if (!input.documents || input.documents.length === 0) {
    errors.push(DATA_ENGINE_MESSAGES.emptyDocuments);
    return { valid: errors.length === 0, errors };
  }

  if (input.documents.length > DATA_ENGINE_CONSTANTS.maxDocumentsPerBatch) {
    errors.push(
      `${DATA_ENGINE_MESSAGES.tooManyDocuments} (${DATA_ENGINE_CONSTANTS.maxDocumentsPerBatch})`
    );
  }

  const seenIds = new Set<string>();
  input.documents.forEach((document, index) => {
    errors.push(...validateDocument(document, index));

    if (document.documentId) {
      if (seenIds.has(document.documentId)) {
        errors.push(
          `documents[${index}]: ${DATA_ENGINE_MESSAGES.duplicateDocumentId} (${document.documentId})`
        );
      }
      seenIds.add(document.documentId);
    }
  });

  return { valid: errors.length === 0, errors };
}
