import type {
  RawFinancialDocument,
  RawFinancialLine,
} from "@/efos/engines/data";

import type { FinancialLineNormalizer } from "./FinancialLineNormalizer";

/**
 * Símbolos monetários já cobertos por `DefaultFinancialLineClassifier`
 * (Mission 046). `"r$"` (Mission 072 — Currency Symbol Normalizer
 * Correction) reconhece a mesma representação que `"R$"` já
 * reconhecia — sem essa entrada, `"r$"` não era removido como
 * unidade: apenas o `"$"` isolado (também nesta lista) era removido,
 * deixando o `"r"` residual na `label` (efeito colateral descoberto
 * na Mission 071, ao corrigir `DefaultFinancialLineClassifier` para
 * reconhecer `r$`/`R$` como o mesmo símbolo de moeda). Nenhuma outra
 * moeda (`US$`/`$`/`€`) ganhou variante de caixa — apenas o caso
 * documentado e comprovado (`R$`/`r$`), mesmo escopo cirúrgico já
 * aplicado pela Mission 071 ao Classifier.
 */
const CURRENCY_SYMBOLS = ["R$", "r$", "US$", "$", "€"] as const;

/** `yyyy-mm-dd` já produzido por `DefaultFinancialLineClassifier` (Mission 046). */
const ISO_DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

/**
 * Reduz espaços internos consecutivos a um único espaço, remove
 * espaços nas pontas, e normaliza a forma Unicode para NFC (forma
 * canônica composta — ex.: um "é" representado como base + acento
 * combinante vira um único codepoint precomposto). Nunca remove
 * acento nem altera qualquer letra — apenas a *representação*
 * Unicode do mesmo caractere, nunca o caractere em si.
 */
function normalizeWhitespaceAndUnicode(text: string): string {
  return text.normalize("NFC").trim().replace(/\s+/g, " ");
}

/**
 * Remove o símbolo monetário da `label` quando `currency` já o
 * representa estruturalmente — evita duplicar a mesma informação em
 * texto livre e em campo estruturado. Só remove o símbolo, nunca o
 * valor numérico que o acompanha (esse permanece em `label`, apenas
 * sem o símbolo redundante).
 */
function stripRedundantCurrencySymbol(
  label: string,
  currency: string | undefined
): string {
  if (!currency) {
    return label;
  }

  let result = label;
  for (const symbol of CURRENCY_SYMBOLS) {
    result = result.split(symbol).join("");
  }

  return normalizeWhitespaceAndUnicode(result);
}

/**
 * Re-emite uma data ISO já detectada (`yyyy-mm-dd`,
 * `DefaultFinancialLineClassifier`, Mission 046) com mês/dia sempre
 * com dois dígitos — defensivo/idempotente: o Classifier já produz
 * esse formato, mas o Normalizer é a camada que garante a forma
 * canônica final, independentemente de qual componente produziu a
 * data. Nunca reinterpreta um formato diferente de data — isso
 * continua sendo responsabilidade exclusiva do Classifier.
 */
function normalizeDate(date: string | undefined): string | undefined {
  if (!date) {
    return undefined;
  }

  const match = ISO_DATE_PATTERN.exec(date);
  if (!match) {
    return date;
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Re-emite `amount` com no máximo duas casas decimais — o padrão de
 * valor de `DefaultFinancialLineClassifier` (Mission 046) já só
 * captura até duas casas, então isso é defensivo/idempotente na
 * prática, garantindo a forma canônica final e eliminando qualquer
 * artefato de ponto flutuante (ex.: `4200.000000000001`). Nunca
 * arredonda de forma a mudar o valor de fato representado na linha —
 * apenas remove ruído de representação binária.
 */
function normalizeAmount(amount: number | undefined): number | undefined {
  if (amount === undefined) {
    return undefined;
  }

  return Math.round(amount * 100) / 100;
}

/** `currency` sempre em maiúsculas — `DefaultFinancialLineClassifier` já produz códigos ISO em maiúsculas (`BRL`/`USD`/`EUR`); defensivo para qualquer outra fonte futura. */
function normalizeCurrency(currency: string | undefined): string | undefined {
  return currency ? currency.toUpperCase() : undefined;
}

function normalizeLine(line: RawFinancialLine): RawFinancialLine {
  const currency = normalizeCurrency(line.currency);
  const label = normalizeWhitespaceAndUnicode(
    stripRedundantCurrencySymbol(line.label, currency)
  );
  const date = normalizeDate(line.date);
  const amount = normalizeAmount(line.amount);

  return {
    ...line,
    label,
    ...(amount !== undefined ? { amount } : {}),
    ...(currency ? { currency } : {}),
    ...(date ? { date } : {}),
  };
}

/**
 * Primeira implementação concreta de `FinancialLineNormalizer`
 * (Mission 047 — Financial Line Normalization). Limpeza e
 * padronização puramente sintáticas — nunca reclassifica, nunca
 * infere um campo que `FinancialLineClassifier` deixou ausente,
 * nunca usa IA/LLM/embeddings/heurística de classificação.
 *
 * Desde a Mission 072, `"r$"` é removido da `label` como uma unidade
 * completa, igual `"R$"` — corrige o resíduo (`"r"` solto) que ficava
 * na `label` quando `currency` já era `"BRL"` a partir de um símbolo
 * minúsculo (descoberto na Mission 071).
 *
 * `normalize()` nunca modifica `documentId`/`companyId`/`source`, nem
 * `kindHint`/`resourceTypeHint`/`eventTypeHint` (decisão exclusiva do
 * Classifier) — apenas `label` (espaços, forma Unicode, símbolo
 * monetário redundante removido) e a forma canônica de `amount`/
 * `currency`/`date` já detectados.
 */
export class DefaultFinancialLineNormalizer implements FinancialLineNormalizer {
  normalize(document: RawFinancialDocument): RawFinancialDocument {
    return {
      ...document,
      lines: document.lines.map((line) => normalizeLine(line)),
    };
  }
}
