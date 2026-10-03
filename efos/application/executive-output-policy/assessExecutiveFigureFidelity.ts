import type { ExecutiveFinancialContext } from "@/efos/application/executive-context";

import type { ExecutiveOutputText } from "./assessExecutiveOutputLanguage";

/**
 * Mission 206 — fidelidade numérica da saída de Executive AI (D-132).
 *
 * Os números da NEXO pertencem aos Engines. A Executive AI pode CITAR
 * um valor que já existe no contexto (indicador, figura de evidência,
 * variação já presente em `historicalIntelligence`), arredondado — nunca
 * calcular um novo, trocar o sinal ou dar número a algo indisponível.
 *
 * O que é verificado:
 * 1. toda figura com unidade (R$, %, p.p.) ou com casas decimais citada
 *    no texto precisa corresponder a um número do contexto (ou da
 *    própria pergunta, no Chat), com tolerância de uma unidade na última
 *    casa exibida e escala de "mil/milhões";
 * 2. um número colado ao nome de um indicador disponível, com a mesma
 *    magnitude do valor dele, não pode ter o sinal trocado;
 * 3. um indicador indisponível nunca aparece acompanhado de número.
 *
 * Inteiros sem unidade (contagens, anos) e datas não são julgados — são
 * frequentes em texto legítimo e não carregam valor financeiro.
 */

export interface ExecutiveFigureAssessment {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const MULTIPLIERS: ReadonlyArray<readonly [RegExp, number]> = [
  [/^mil$/i, 1_000],
  [/^milh(?:ão|ões|ao|oes)$/i, 1_000_000],
  [/^bilh(?:ão|ões|ao|oes)$/i, 1_000_000_000],
];

const FIGURE_PATTERN =
  /(R\$\s*)?([-−–]\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d+|\d+\.\d{1,2}(?!\d)|\d+)(?:\s+(mil|milh(?:ão|ões|ao|oes)|bilh(?:ão|ões|ao|oes))\b)?(\s*(?:%|p\.\s?p\.?|pontos? percentua(?:l|is)))?/giu;

interface CitedFigure {
  readonly raw: string;
  readonly value: number;
  readonly negative: boolean;
  readonly tolerance: number;
  readonly index: number;
}

function parseBrazilianNumber(body: string): { value: number; decimals: number } {
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(body)) {
    const [integer, fraction = ""] = body.replace(/\./g, "").split(",");
    return { value: Number(`${integer}.${fraction || "0"}`), decimals: fraction.length };
  }
  if (body.includes(",")) {
    const [integer, fraction] = body.split(",");
    return { value: Number(`${integer}.${fraction}`), decimals: fraction.length };
  }
  const [, fraction = ""] = body.split(".");
  return { value: Number(body), decimals: fraction.length };
}

/** Figuras citadas no texto que carregam valor financeiro (unidade ou casas decimais). */
export function extractCitedFigures(text: string): readonly CitedFigure[] {
  const figures: CitedFigure[] = [];
  for (const match of text.matchAll(FIGURE_PATTERN)) {
    const [raw, currency, sign, body, multiplierWord, unit] = match;
    const index = match.index ?? 0;
    const before = text.slice(Math.max(0, index - 1), index);
    const after = text.slice(index + raw.length, index + raw.length + 1);
    // Datas (01/05/2026, 2026-08-31) e horários nunca são figuras financeiras.
    if (/[/:]/.test(before) || /^[/:]/.test(after) || /\d-$/.test(text.slice(Math.max(0, index - 5), index))) continue;
    const hasDecimals = /,\d+$/.test(body) || /^\d+\.\d{1,2}$/.test(body);
    if (!currency && !unit && !hasDecimals && !multiplierWord) continue;
    const { value, decimals } = parseBrazilianNumber(body);
    if (!Number.isFinite(value)) continue;
    const multiplier = multiplierWord ? (MULTIPLIERS.find(([pattern]) => pattern.test(multiplierWord))?.[1] ?? 1) : 1;
    figures.push({
      raw: raw.trim(),
      value: value * multiplier,
      negative: Boolean(sign),
      tolerance: Math.pow(10, -decimals) * multiplier,
      index,
    });
  }
  return figures;
}

function numberCandidatesFromString(text: string): number[] {
  const candidates: number[] = [];
  for (const [token] of text.matchAll(/-?\d[\d.,]*/g)) {
    const cleaned = token.replace(/[.,]+$/, "");
    const brazilian = cleaned.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
    const english = cleaned.replace(/,(?=\d{3}(?:\D|$))/g, "");
    for (const candidate of [brazilian, english, cleaned.replace(",", ".")]) {
      const value = Number(candidate);
      if (Number.isFinite(value)) candidates.push(value);
    }
  }
  return candidates;
}

/** Todo número presente no contexto (valores e números dentro de textos), sem interpretação. */
export function harvestCanonicalNumbers(value: unknown, into: number[] = [], seen = new WeakSet<object>()): number[] {
  if (typeof value === "number") {
    if (Number.isFinite(value)) into.push(value);
  } else if (typeof value === "string") {
    into.push(...numberCandidatesFromString(value));
  } else if (typeof value === "object" && value !== null) {
    if (seen.has(value)) return into;
    seen.add(value);
    for (const item of Array.isArray(value) ? value : Object.values(value)) harvestCanonicalNumbers(item, into, seen);
  }
  return into;
}

function isGrounded(figure: CitedFigure, canonical: readonly number[]): boolean {
  const magnitude = Math.abs(figure.value);
  const epsilon = 1e-9;
  return canonical.some((candidate) => {
    const reference = Math.abs(candidate);
    if (Math.abs(magnitude - reference) <= figure.tolerance + epsilon) return true;
    // Percentual citado sobre uma fração do contexto (0,2735 → 27,35%).
    return figure.raw.includes("%") && Math.abs(magnitude / 100 - reference) <= figure.tolerance / 100 + epsilon;
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Trecho logo depois de uma menção, até o fim da oração. */
function windowAfter(text: string, from: number, length: number): string {
  const slice = text.slice(from, from + length);
  const boundary = slice.search(/[;\n]|\.\s/);
  return boundary === -1 ? slice : slice.slice(0, boundary);
}

const UNAVAILABLE_WORDING = /indispon|não disponível|nao disponivel|sem dado|ausente|não foi possível calcular|não calculad/i;
const NEGATIVE_WORDING = /negativ|prejuízo|prejuizo|abaixo de zero/i;

export function assessExecutiveFigureFidelity(
  texts: readonly ExecutiveOutputText[],
  context: ExecutiveFinancialContext,
  extraAllowedSources: readonly unknown[] = []
): ExecutiveFigureAssessment {
  const errors: string[] = [];
  const canonical = harvestCanonicalNumbers([context, ...extraAllowedSources]);
  const indicators = context.financialTruth.indicators;
  const unavailableNames = new Set([
    ...indicators.filter((indicator) => indicator.result.status === "unavailable").map((indicator) => indicator.name),
    ...context.unknowns.map((unknown) => unknown.subject),
  ]);
  const available = indicators.flatMap((indicator) =>
    indicator.result.status === "available" ? [{ name: indicator.name, value: indicator.result.value }] : []
  );

  for (const { path, text } of texts) {
    for (const figure of extractCitedFigures(text)) {
      if (!isGrounded(figure, canonical)) {
        errors.push(`${path} cita "${figure.raw}", que não existe no contexto financeiro (número calculado ou inventado).`);
      }
    }

    for (const name of unavailableNames) {
      for (const match of text.matchAll(new RegExp(`\\b${escapeRegExp(name)}\\b`, "giu"))) {
        const after = windowAfter(text, (match.index ?? 0) + match[0].length, 32);
        if (/\d/.test(after) && !UNAVAILABLE_WORDING.test(after)) {
          errors.push(`${path} atribui um número a "${name}", que está indisponível no contexto.`);
        }
      }
    }

    for (const { name, value } of available) {
      if (value === 0) continue;
      for (const match of text.matchAll(new RegExp(`\\b${escapeRegExp(name)}\\b`, "giu"))) {
        const after = windowAfter(text, (match.index ?? 0) + match[0].length, 40);
        const [figure] = extractCitedFigures(after);
        if (!figure || Math.abs(Math.abs(figure.value) - Math.abs(value)) > figure.tolerance + 1e-9) continue;
        const flipped = value < 0 ? !figure.negative && !NEGATIVE_WORDING.test(after) : figure.negative;
        if (flipped) errors.push(`${path} cita "${name}" com o sinal trocado ("${figure.raw}").`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
