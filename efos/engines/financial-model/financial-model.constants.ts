/**
 * Constantes do Financial Model Engine — nome, versao e mensagens
 * centralizadas. Nenhuma logica, apenas dados fixos.
 */

export const FINANCIAL_MODEL_ENGINE_CONSTANTS = {
  id: "financial-model",
  name: "Financial Model Engine",
  version: "0.1.0",
  /** Um Financial Model por empresa — id derivado deterministicamente do companyId (ver DECISIONS.md D-001). */
  idPrefix: "financial-model",
} as const;

export const FINANCIAL_MODEL_ENGINE_MESSAGES = {
  invalidInput: "Entrada invalida para o Financial Model Engine.",
  missingCompanyId: "companyId e obrigatorio.",
  emptyRecords: "records nao pode ser vazio — nenhum dado normalizado recebido.",
  missingRecordId: "recordId e obrigatorio para todo registro.",
  duplicateRecordId: "recordId duplicado no lote de entrada.",
  missingLabel: "label e obrigatorio para todo registro.",
  missingSource: "source e obrigatorio para todo registro.",
  missingResourceType: 'resourceType e obrigatorio quando kind="resource".',
  missingEventType: 'eventType e obrigatorio quando kind="event".',
  missingOccurredAt: 'occurredAt e obrigatorio quando kind="event".',
  // Mission 192 — Canonical Financial Statement Ingestion & Period
  // Semantics, D-106.
  missingStatementCategory:
    'statementCategory e obrigatorio quando kind="statement_line".',
  missingStatementPeriod:
    'period e obrigatorio quando kind="statement_line".',
  unexpectedOccurredAtForStatementLine:
    'occurredAt nao e permitido quando kind="statement_line" — uma linha de demonstrativo agregada por periodo nunca e uma transacao datada.',
} as const;
