import { DATA_ENGINE_CONSTANTS } from "./data.constants";
import type {
  CandidateFinancialRecord,
  NormalizedFinancialRecord,
} from "./data.types";

/**
 * Normalizador do Data Engine. Responsavel exclusivamente pela
 * normalizacao dos registros financeiros — padronizacao de texto,
 * moeda e data. Nunca realiza calculo financeiro (soma, conversao de
 * moeda, agregacao, derivacao de valor) — apenas limpeza e forma.
 */

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

function normalizeCurrency(
  currency: string | undefined,
  amount: number | undefined
): string | undefined {
  if (amount === undefined) return undefined;
  return (currency ?? DATA_ENGINE_CONSTANTS.defaultCurrency).trim().toUpperCase();
}

function normalizeDate(date: string | undefined): string | undefined {
  if (!date) return undefined;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function normalizeCandidateRecords(
  records: readonly CandidateFinancialRecord[]
): NormalizedFinancialRecord[] {
  return records
    .filter((record) => record.label && record.label.trim().length > 0)
    .map((record) => ({
      recordId: record.recordId,
      kind: record.kind,
      resourceType: record.resourceType,
      eventType: record.eventType,
      label: normalizeLabel(record.label),
      amount: record.amount,
      currency: normalizeCurrency(record.currency, record.amount),
      occurredAt: normalizeDate(record.occurredAt),
      source: record.source.trim(),
      // Mission 192, D-106: sem isso, `statementCategory`/`period`/
      // `isTotalLine` eram silenciosamente descartados aqui — esta
      // função reconstrói o objeto por allowlist explícita, nunca por
      // spread, então um campo novo do contrato precisa ser listado
      // explicitamente para sobreviver a esta etapa.
      statementCategory: record.statementCategory,
      period: record.period,
      isTotalLine: record.isTotalLine,
      // Mission 192 Closure, D-111: mesma allowlist explícita — sem
      // isso, `asOfDate` seria descartado aqui exatamente como
      // `statementCategory`/`period`/`isTotalLine` teriam sido na
      // Mission 192 sem a correção equivalente.
      asOfDate: normalizeDate(record.asOfDate),
    }));
}
