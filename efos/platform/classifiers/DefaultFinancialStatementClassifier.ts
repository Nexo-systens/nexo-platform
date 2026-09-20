import type { Period, StatementCategory } from "@/efos/domain";
import type {
  RawFinancialDocument,
  RawFinancialLine,
} from "@/efos/engines/data";

import {
  DATE_DMY_PATTERN,
  DATE_ISO_PATTERN,
  detectAmountAndCurrency,
} from "./detectMonetaryAmount";
import type {
  FinancialStatementClassifier,
  StatementClassificationSummary,
} from "./FinancialStatementClassifier";

/** `dd/mm/yyyy` a `dd/mm/yyyy` — o formato mais comum de cabeçalho de DRE brasileira. */
const PERIOD_RANGE_PATTERN =
  /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(?:a|à|-|ate|até)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\b/i;

/** `Competência: 07/2026` / `Competencia 07/2026`. */
const COMPETENCE_PATTERN = /compet[eê]ncia:?\s*(\d{1,2})\/(\d{4})/i;

const MONTH_NAMES: Readonly<Record<string, number>> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

/** `Julho/2026`, `Julho de 2026` — mês por extenso (sem acento, ver `normalize()`). */
const MONTH_NAME_PATTERN = new RegExp(
  `\\b(${Object.keys(MONTH_NAMES).join("|")})\\s*(?:\\/|de)\\s*(\\d{4})\\b`,
  "i"
);

/**
 * Per-line date — reaproveita exatamente `DATE_DMY_PATTERN`/
 * `DATE_ISO_PATTERN` (`detectMonetaryAmount.ts`, extraídas de
 * `DefaultFinancialLineClassifier`, Mission 046) apenas para DETECTAR
 * se uma linha tem data própria — nunca para produzir um `date`/
 * `occurredAt` em uma `StatementLine` (Seção 6 da Mission 192).
 */
function lineHasOwnDate(label: string): boolean {
  return DATE_DMY_PATTERN.test(label) || DATE_ISO_PATTERN.test(label);
}

/**
 * Frases de categoria de demonstrativo (Mission 192, Seção 7/15/17) —
 * checadas na ordem abaixo, mais específica primeiro (mesmo princípio
 * de D-040, Mission 075, agora aplicado a FRASES inteiras em vez de
 * palavras soltas). `Despesas com Vendas` corresponde à frase inteira
 * de `operating_expense`, verificada ANTES de qualquer frase de
 * `gross_revenue`/`net_revenue` — nunca corresponde por conter a
 * substring "vendas" isolada (Mission 191, achado nº1; Mission 192,
 * Seção 29). Todas as strings já vêm sem acento — comparadas contra
 * `normalize()` (NFD + remoção de diacríticos + minúsculas), mesma
 * função já usada por `DefaultFinancialLineClassifier`.
 */
const STATEMENT_CATEGORY_PHRASES: ReadonlyArray<
  readonly [StatementCategory, readonly string[]]
> = [
  [
    "cost_of_goods_services",
    [
      "custo dos produtos vendidos",
      "custo das mercadorias vendidas",
      "custo dos servicos prestados",
      "custo dos produtos e servicos vendidos",
      "cmv",
      "cpv",
      "csv",
      "csp",
    ],
  ],
  [
    "operating_expense",
    [
      "despesas com pessoal",
      "despesas de pessoal",
      "despesa com pessoal",
      "despesas com vendas",
      "despesa com vendas",
      "despesas comerciais",
      "despesa comercial",
      "despesas administrativas",
      "despesa administrativa",
      "despesas gerais e administrativas",
      "despesas gerais",
      "despesas operacionais",
      "outras despesas operacionais",
      "despesas com marketing",
    ],
  ],
  // Mission 192 Closure — Complete Statement Economics & Balance-Date
  // Semantics, D-110: "Despesas Financeiras"/"Receitas Financeiras" são
  // frases DISTINTAS, cada uma checada isoladamente — nunca fundidas em
  // `financial_result` (a Mission 192 original fazia isso, e um DRE com
  // as duas linhas separadas fazia `sumStatementLines()` somar as
  // magnitudes em vez de subtrair, dobrando o efeito da menor delas em
  // vez de calcular o líquido real). `financial_result` permanece
  // reservada para o caso mais raro de uma única linha JÁ NETADA
  // ("Resultado Financeiro: -80.000,00") — extraída com sinal, nunca
  // com `Math.abs()` (ver `indicators.calculator.ts`).
  [
    "financial_expense",
    ["despesas financeiras", "despesa financeira"],
  ],
  [
    "financial_income",
    ["receitas financeiras", "receita financeira"],
  ],
  [
    "financial_result",
    ["resultado financeiro"],
  ],
  [
    "taxes",
    [
      "impostos sobre o lucro",
      "impostos e contribuicoes sobre o lucro",
      "provisao para imposto de renda",
      "irpj",
      "csll",
    ],
  ],
  [
    "revenue_deductions",
    [
      "deducoes da receita",
      "deducoes de vendas",
      "impostos sobre vendas",
      "impostos sobre a receita",
      "devolucoes de vendas",
      "devolucoes",
      "abatimentos",
    ],
  ],
  [
    "gross_revenue",
    [
      "receita bruta de vendas",
      "receita bruta operacional",
      "receita bruta",
      "faturamento bruto",
    ],
  ],
  [
    "net_revenue",
    [
      "receita liquida de vendas",
      "receita operacional liquida",
      "receita liquida",
      "faturamento liquido",
    ],
  ],
  ["gross_profit", ["lucro bruto", "resultado bruto"]],
  [
    "net_income",
    [
      "lucro liquido do exercicio",
      "resultado liquido do exercicio",
      "lucro liquido",
      "resultado liquido",
      "prejuizo liquido do exercicio",
      "prejuizo do exercicio",
      "prejuizo liquido",
    ],
  ],
];

/** `header`/título de demonstrativo — usado apenas para reforçar `looksLikeFinancialStatement()`. */
const STATEMENT_HEADER_PATTERN =
  /demonstra[cç][aã]o do resultado|\bdre\b|balancete|balan[cç]o patrimonial/i;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthPeriod(year: number, month: number): Period {
  const lastDay = lastDayOfMonth(year, month);
  return {
    startDate: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
    endDate: new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59)).toISOString(),
  };
}

/**
 * Extrai o período ÚNICO do documento inteiro (Mission 192, Seção
 * 9/10) — nunca por linha. Tenta, nesta ordem, os três padrões
 * demonstravelmente necessários por documentos brasileiros reais
 * (Seção 10 da missão — "support the minimal patterns demonstrably
 * needed", nunca um motor de NLP de data). Primeira linha que casar
 * qualquer um dos três vence; nenhuma tentativa de combinar sinais
 * conflitantes de linhas diferentes.
 */
function extractStatementPeriod(
  document: RawFinancialDocument
): Period | undefined {
  for (const line of document.lines) {
    const rangeMatch = PERIOD_RANGE_PATTERN.exec(line.label);
    if (rangeMatch) {
      const [d1, m1, y1, d2, m2, y2] = rangeMatch.slice(1).map(Number);
      return {
        startDate: new Date(Date.UTC(y1, m1 - 1, d1)).toISOString(),
        endDate: new Date(Date.UTC(y2, m2 - 1, d2, 23, 59, 59)).toISOString(),
      };
    }

    const competenceMatch = COMPETENCE_PATTERN.exec(line.label);
    if (competenceMatch) {
      const month = Number(competenceMatch[1]);
      const year = Number(competenceMatch[2]);
      if (month >= 1 && month <= 12) {
        return monthPeriod(year, month);
      }
    }

    const monthNameMatch = MONTH_NAME_PATTERN.exec(normalize(line.label));
    if (monthNameMatch) {
      const month = MONTH_NAMES[monthNameMatch[1]];
      const year = Number(monthNameMatch[2]);
      return monthPeriod(year, month);
    }
  }

  return undefined;
}

function classifyLineCategory(
  label: string
): { category: StatementCategory; isTotalLine: boolean } | undefined {
  const normalizedLabel = normalize(label);

  for (const [category, phrases] of STATEMENT_CATEGORY_PHRASES) {
    if (phrases.some((phrase) => normalizedLabel.includes(phrase))) {
      const isTotalLine =
        normalizedLabel.includes("total") || normalizedLabel.includes("subtotal");
      return { category, isTotalLine };
    }
  }

  return undefined;
}

/**
 * Uma linha que declara o PERÍODO do documento (ex.: "DRE - Período:
 * 01/07/2026 a 31/07/2026") contém, estruturalmente, o mesmo padrão de
 * data usado para detectar uma transação — mas não é uma transação.
 * Sem esta exclusão, um documento curto (poucas linhas de conteúdo)
 * podia ser incorretamente lido como "majoritariamente transacional"
 * só porque a ÚNICA linha de cabeçalho continha uma data, distorcendo
 * a proporção `datedLineCount / totalLines` (bug encontrado e
 * corrigido nesta missão, Mission 192 Closure).
 */
function isPeriodDeclarationLine(label: string): boolean {
  return (
    PERIOD_RANGE_PATTERN.test(label) ||
    COMPETENCE_PATTERN.test(label) ||
    MONTH_NAME_PATTERN.test(normalize(label))
  );
}

function countLinesWithOwnDate(document: RawFinancialDocument): number {
  return document.lines.filter(
    (line) => lineHasOwnDate(line.label) && !isPeriodDeclarationLine(line.label)
  ).length;
}

function countRecognizableCategoryLines(document: RawFinancialDocument): number {
  return document.lines.filter(
    (line) => classifyLineCategory(line.label) !== undefined
  ).length;
}

/**
 * Primeira implementação concreta de `FinancialStatementClassifier`
 * (Mission 192 — Canonical Financial Statement Ingestion & Period
 * Semantics, D-106). Interpretação de demonstrativo — nunca extração
 * de texto (isso é `PdfParser`/`CsvParser`, inalterados) nem
 * classificação transacional (isso é `DefaultFinancialLineClassifier`,
 * também inalterado, Seção 14/21 da missão).
 */
export class DefaultFinancialStatementClassifier
  implements FinancialStatementClassifier
{
  looksLikeFinancialStatement(document: RawFinancialDocument): boolean {
    const totalLines = document.lines.length;
    if (totalLines === 0) return false;

    const hasHeaderKeyword = document.lines.some((line) =>
      STATEMENT_HEADER_PATTERN.test(line.label)
    );
    const categoryLineCount = countRecognizableCategoryLines(document);
    const datedLineCount = countLinesWithOwnDate(document);

    // Vocabulário de demonstrativo reconhecível (>=2 linhas de
    // categoria, OU um cabeçalho explícito + ao menos 1) — E a maioria
    // das linhas NÃO tem data própria (um extrato bancário real tem
    // data em quase toda linha; um DRE real, em nenhuma ou quase
    // nenhuma). As duas condições isoladamente já bastam para não
    // confundir os dois formatos (Seção 13 da missão).
    const hasStatementVocabulary =
      categoryLineCount >= 2 || (hasHeaderKeyword && categoryLineCount >= 1);
    const isNotTransactionShaped = datedLineCount < totalLines / 2;

    return hasStatementVocabulary && isNotTransactionShaped;
  }

  classify(document: RawFinancialDocument): RawFinancialDocument {
    const period = extractStatementPeriod(document);

    if (!period) {
      // Seção 10/38 da missão: período não determinado com segurança —
      // NENHUMA linha é classificada como statement_line. Nunca um
      // fallback de relógio de execução, nunca uma suposição. O
      // documento permanece efetivamente vazio deste classificador —
      // `summarize()` reporta isso explicitamente para o chamador.
      return document;
    }

    return {
      ...document,
      lines: document.lines.map((line): RawFinancialLine => {
        const classified = classifyLineCategory(line.label);
        if (!classified) {
          return line;
        }

        // Reaproveita a MESMA extração de valor monetário já usada
        // pelo caminho transacional (`detectMonetaryAmount.ts`,
        // extraída de `DefaultFinancialLineClassifier`) — nunca um
        // segundo motor de regex de valor (Seção 15/16 da Mission
        // 192). Moeda nunca é lida daqui para currency — o padrão
        // brasileiro de DRE raramente prefixa cada linha com "R$";
        // ausência de símbolo permanece ausência (nunca BRL assumido
        // neste classificador — `toMoney()`, `financial-model.mapper.ts`,
        // já assume BRL como default quando `currency` está ausente).
        const { amount } = detectAmountAndCurrency(line.label);

        return {
          ...line,
          ...(amount !== undefined ? { amount } : {}),
          kindHint: "statement_line",
          statementCategory: classified.category,
          period,
          isTotalLine: classified.isTotalLine,
        };
      }),
    };
  }

  summarize(document: RawFinancialDocument): StatementClassificationSummary {
    const recognizedAsStatement = this.looksLikeFinancialStatement(document);
    const period = extractStatementPeriod(document);
    const classifiedLineCount = countRecognizableCategoryLines(document);
    const headerOrPeriodLines = document.lines.filter(
      (line) =>
        STATEMENT_HEADER_PATTERN.test(line.label) ||
        PERIOD_RANGE_PATTERN.test(line.label) ||
        COMPETENCE_PATTERN.test(line.label) ||
        MONTH_NAME_PATTERN.test(normalize(line.label))
    ).length;

    return {
      recognizedAsStatement,
      periodResolved: period !== undefined,
      classifiedLineCount: period ? classifiedLineCount : 0,
      unclassifiedLineCount: Math.max(
        0,
        document.lines.length - headerOrPeriodLines - (period ? classifiedLineCount : 0)
      ),
    };
  }
}
