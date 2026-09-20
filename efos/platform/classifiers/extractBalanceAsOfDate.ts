import type { RawFinancialDocument, RawFinancialLine } from "@/efos/engines/data";

import { DATE_DMY_PATTERN, DATE_ISO_PATTERN } from "./detectMonetaryAmount";

/**
 * Mission 192 Closure — Complete Statement Economics & Balance-Date
 * Semantics, D-111. Um Balancete/Balanço Patrimonial é verdade
 * financeira PONTUAL ("Caixa = R$ 80.000,00 EM 31/07/2026") — mas,
 * antes desta correção, a data real do saldo era perdida por completo
 * na ingestão: `Resource` (Domain) não tinha nenhum campo de data, e
 * `DefaultFinancialLineClassifier` (que continua classificando estas
 * linhas como recurso — Mission 192 nunca o alterou) nunca captura
 * contexto de nível de documento.
 *
 * Este módulo é DELIBERADAMENTE separado de
 * `DefaultFinancialStatementClassifier` (que resolve período de
 * AGREGADO, um intervalo — Mission 192) — aqui resolvemos uma data
 * ÚNICA e PONTUAL, um conceito economicamente diferente (Seção 15/16
 * da missão: nunca inventar `occurredAt`, escolher a menor
 * representação canônica segura). Nunca reclassifica nenhuma linha —
 * apenas ANOTA `asOfDate` em linhas que `DefaultFinancialLineClassifier`
 * já classificou como `kindHint === "resource"`.
 */

/** "balancete" / "balanço patrimonial" — nunca "dre"/"demonstração do resultado" (isso pertence ao outro classificador). */
const BALANCE_HEADER_PATTERN = /balancete|balan[cç]o patrimonial/i;

/** "Data-base: 31/07/2026" / "Data base 31/07/2026". */
const DATA_BASE_PATTERN = /data[\s-]?base:?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})/i;

/** "posição em 31/07/2026" / "em 31/07/2026" perto do cabeçalho. */
const POSITION_ON_PATTERN = /posi[cç][aã]o em\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})/i;

function toIsoDate(day: number, month: number, year: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

/**
 * Documento é um Balancete/Balanço com vocabulário de cabeçalho
 * reconhecível — nunca decidido pela `categoria` cosmética do upload
 * (mesmo princípio de `DefaultFinancialStatementClassifier`, Seção 13
 * da Mission 192).
 */
export function looksLikePointInTimeBalance(document: RawFinancialDocument): boolean {
  return document.lines.some((line) => BALANCE_HEADER_PATTERN.test(line.label));
}

/**
 * Extrai a data-base ÚNICA do documento inteiro (nunca por linha) —
 * apenas os 3 padrões demonstravelmente necessários (mesmo espírito da
 * Seção 10 da Mission 192: nunca um motor de NLP de data). Primeira
 * linha que casar qualquer um dos três vence.
 */
export function extractBalanceAsOfDate(
  document: RawFinancialDocument
): string | undefined {
  for (const line of document.lines) {
    const dataBaseMatch = DATA_BASE_PATTERN.exec(line.label);
    if (dataBaseMatch) {
      const [, day, month, year] = dataBaseMatch.map(Number) as unknown as [
        number,
        number,
        number,
        number,
      ];
      return toIsoDate(day, month, year);
    }

    const positionMatch = POSITION_ON_PATTERN.exec(line.label);
    if (positionMatch) {
      const [, day, month, year] = positionMatch.map(Number) as unknown as [
        number,
        number,
        number,
        number,
      ];
      return toIsoDate(day, month, year);
    }

    // Fallback: uma data completa (dd/mm/yyyy ou ISO) na MESMA linha do
    // cabeçalho "Balancete"/"Balanço Patrimonial" — cobre o formato
    // realista "Balancete Patrimonial - 31/07/2026" (sem "Data-base:").
    if (BALANCE_HEADER_PATTERN.test(line.label)) {
      const dmy = DATE_DMY_PATTERN.exec(line.label);
      if (dmy) {
        const [, day, month, year] = dmy.map(Number) as unknown as [
          number,
          number,
          number,
          number,
        ];
        return toIsoDate(day, month, year);
      }
      const iso = DATE_ISO_PATTERN.exec(line.label);
      if (iso) {
        const [, year, month, day] = iso.map(Number) as unknown as [
          number,
          number,
          number,
          number,
        ];
        return toIsoDate(day, month, year);
      }
    }
  }

  return undefined;
}

/**
 * Anota `asOfDate` em toda linha já classificada como
 * `kindHint === "resource"` — nunca reclassifica, nunca toca em
 * `resourceType`/`amount`/`label`/qualquer outro campo. Documento sem
 * data-base determinável é devolvido inalterado (nunca uma data
 * fabricada) — o chamador (`prepareFinancialDocuments`) decide o que
 * fazer com um Balancete sem data (hoje: prossegue sem `asOfDate`,
 * nunca excluído — a ausência de data não invalida os saldos em si,
 * apenas os deixa sem cronologia própria, mesmo tratamento que
 * qualquer `Resource` já recebia antes desta missão).
 */
export function annotateResourceLinesWithAsOfDate(
  document: RawFinancialDocument
): RawFinancialDocument {
  if (!looksLikePointInTimeBalance(document)) {
    return document;
  }

  const asOfDate = extractBalanceAsOfDate(document);
  if (!asOfDate) {
    return document;
  }

  return {
    ...document,
    lines: document.lines.map((line): RawFinancialLine => {
      if (line.kindHint !== "resource") {
        return line;
      }
      return { ...line, asOfDate };
    }),
  };
}
