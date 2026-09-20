/**
 * Detecção de valor monetário/moeda a partir de texto livre — extraída
 * de `DefaultFinancialLineClassifier` (Mission 046, com correções das
 * Missions 070–072/095) para `efos/platform/classifiers/
 * DefaultFinancialStatementClassifier.ts` (Mission 192 — Canonical
 * Financial Statement Ingestion & Period Semantics) poder reutilizá-la
 * SEM duplicar um segundo motor de regex de valor monetário — uma
 * linha de DRE ("Despesas Administrativas R$ 80.000,00") precisa
 * exatamente da mesma extração de valor que uma linha de extrato
 * bancário já usa, apenas nunca a mesma extração de `kindHint`/
 * `eventTypeHint`/`resourceTypeHint` (essa permanece exclusiva de cada
 * classificador, por design — Seção 15 da Mission 192: reuso de
 * PARSING de valor, nunca de SEMÂNTICA de classificação).
 *
 * Comportamento idêntico byte a byte ao que já existia dentro de
 * `DefaultFinancialLineClassifier` antes desta extração — nenhuma
 * mudança de regex, nenhuma mudança de precedência, apenas movido para
 * um módulo importável por mais de um classificador.
 */

/** Ver `DefaultFinancialLineClassifier` (Mission 046/071) para o racional completo do padrão. */
export const AMOUNT_PATTERN =
  /([Rr]\$|US\$|\$|€)?\s*(-)?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;

/** `dd/mm/yyyy` ou `dd-mm-yyyy`. */
export const DATE_DMY_PATTERN = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/;

/** `yyyy-mm-dd`. */
export const DATE_ISO_PATTERN = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/;

/** `mm/yyyy` — período parcial, nunca lido como valor monetário (Mission 095). */
export const PARTIAL_DATE_PATTERN = /\b\d{1,2}\/\d{4}\b/;

/** Palavras de referência documental (NF/Contrato/Fatura/Folha/DARF, Mission 095). */
export const REFERENCE_LABEL_PATTERN = /\b(nf|contrato|fatura|folha|darf)\s+[\w./-]+/gi;

export const CURRENCY_SYMBOL_TO_CODE: Readonly<Record<string, string>> = {
  "R$": "BRL",
  "US$": "USD",
  "$": "USD",
  "€": "EUR",
};

function isDecimalFormatted(rawNumber: string): boolean {
  return /[.,]\d{2}$/.test(rawNumber);
}

/**
 * Convenção contábil de negativo entre parênteses (Mission 192 —
 * Canonical Financial Statement Ingestion & Period Semantics, Seção
 * 33: `"120.000"`/`"-120.000"`/`"(120.000)"` devem normalizar para o
 * mesmo sinal). O sinal `-` explícito já era reconhecido; parênteses
 * ENVOLVENDO o trecho casado (símbolo de moeda + número) nunca eram —
 * uma adição aditiva, nunca uma mudança de comportamento para os
 * casos já cobertos (sinal `-` explícito, sem parênteses).
 */
function isSurroundedByParentheses(
  label: string,
  matchIndex: number,
  matchLength: number
): boolean {
  const before = label.slice(0, matchIndex).trimEnd();
  const after = label.slice(matchIndex + matchLength).trimStart();
  return before.endsWith("(") && after.startsWith(")");
}

function findExcludedRanges(label: string): ReadonlyArray<readonly [number, number]> {
  const ranges: Array<readonly [number, number]> = [];

  for (const pattern of [DATE_DMY_PATTERN, DATE_ISO_PATTERN, PARTIAL_DATE_PATTERN]) {
    const match = pattern.exec(label);
    if (match) {
      ranges.push([match.index, match.index + match[0].length]);
    }
  }

  for (const match of label.matchAll(REFERENCE_LABEL_PATTERN)) {
    if (match.index !== undefined) {
      ranges.push([match.index, match.index + match[0].length]);
    }
  }

  return ranges;
}

function isWithinExcludedRange(
  index: number,
  ranges: ReadonlyArray<readonly [number, number]>
): boolean {
  return ranges.some(([start, end]) => index >= start && index < end);
}

export function detectAmountAndCurrency(
  label: string
): { amount?: number; currency?: string } {
  const excludedRanges = findExcludedRanges(label);

  const candidates = [...label.matchAll(AMOUNT_PATTERN)].filter(
    (candidate) =>
      candidate[3] !== undefined &&
      candidate.index !== undefined &&
      !isWithinExcludedRange(candidate.index, excludedRanges)
  );

  if (candidates.length === 0) {
    return {};
  }

  const match =
    candidates.find((candidate) => isDecimalFormatted(candidate[3] as string)) ??
    candidates[0];

  const rawNumber = match[3] as string;
  const isNegative =
    Boolean(match[2]) ||
    (match.index !== undefined &&
      isSurroundedByParentheses(label, match.index, match[0].length));

  const lastSeparatorIndex = Math.max(
    rawNumber.lastIndexOf(","),
    rawNumber.lastIndexOf(".")
  );

  let normalizedNumber: string;
  if (lastSeparatorIndex === -1) {
    normalizedNumber = rawNumber;
  } else {
    const integerPart = rawNumber
      .slice(0, lastSeparatorIndex)
      .replace(/[.,]/g, "");
    const decimalPart = rawNumber.slice(lastSeparatorIndex + 1);
    normalizedNumber = `${integerPart}.${decimalPart}`;
  }

  const amount = Number.parseFloat(normalizedNumber);

  if (Number.isNaN(amount)) {
    return {};
  }

  const currencySymbol = match[1];
  const currency = currencySymbol
    ? CURRENCY_SYMBOL_TO_CODE[currencySymbol.toUpperCase()]
    : undefined;

  return {
    amount: isNegative ? -amount : amount,
    ...(currency ? { currency } : {}),
  };
}
