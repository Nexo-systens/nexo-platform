import type { ChangeDirection, MetricComparison } from "@/efos/application/history";
import type { IndicatorUnit } from "@/efos/domain";
import { TEMPORAL_METRIC_DEFINITIONS } from "@/efos/engines/evidence";
import { formatIndicatorDelta, formatIndicatorValue } from "@/lib/format-indicator";

/**
 * Mission 204 — sistema de números: como uma variação entre duas análises
 * é apresentada.
 *
 * Regras:
 * - direção sempre em texto e símbolo (↑/↓/=), nunca só em cor;
 * - "melhora"/"piora" SOMENTE para métricas que o EFOS já classifica
 *   canonicamente (`TEMPORAL_METRIC_DEFINITIONS`, D-087: margens,
 *   liquidezes, prazo de recebimento, fluxo operacional). Para as demais
 *   (ex.: Endividamento Geral) a variação é neutra — a UI não inventa
 *   juízo financeiro que o EFOS não fez;
 * - valor ausente nunca vira zero ("—" + "indisponível").
 */

export type ChangeDesirability = "favorable" | "unfavorable" | "neutral";

export interface MetricChangePresentation {
  readonly metricName: string;
  readonly previousText: string;
  readonly currentText: string;
  /** Variação com sinal e unidade ("-3,63 p.p.", "+R$ 5.000"); ausente quando não há comparação numérica. */
  readonly deltaText?: string;
  readonly symbol: "↑" | "↓" | "=" | "";
  readonly directionLabel: string;
  readonly desirability: ChangeDesirability;
  /** "Melhora"/"Piora" — só quando o EFOS classifica a métrica. */
  readonly desirabilityLabel?: string;
  /** Frase completa para leitores de tela. */
  readonly accessibleText: string;
}

const DIRECTIONALITY = new Map(
  TEMPORAL_METRIC_DEFINITIONS.map((definition) => [definition.label, definition.directionality] as const)
);

export function isIndicatorUnit(unit: string | undefined): unit is IndicatorUnit {
  return unit === "ratio" || unit === "percentage" || unit === "currency" || unit === "days";
}

export function formatMetricValue(value: number | undefined, unit: string | undefined): string {
  if (value === undefined) return "—";
  return isIndicatorUnit(unit) ? formatIndicatorValue(value, unit) : new Intl.NumberFormat("pt-BR").format(value);
}

const DIRECTION_TEXT: Readonly<Record<ChangeDirection, string>> = {
  increased: "subiu",
  decreased: "caiu",
  unchanged: "estável",
  added: "novo",
  removed: "removido",
  "not-comparable": "não comparável",
  "became-available": "passou a estar disponível",
  "became-unavailable": "deixou de estar disponível",
  unavailable: "indisponível",
};

/** Variação em dias abaixo de 1 mantém uma casa decimal — nunca "+0 dias" para uma mudança real. */
function formatDelta(delta: number, unit: IndicatorUnit): string {
  if (unit === "days" && Math.abs(delta) < 1) {
    const magnitude = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(delta));
    return `${delta > 0 ? "+" : "-"}${magnitude} dia`;
  }
  return formatIndicatorDelta(delta, unit);
}

export function metricDesirability(metricName: string, direction: ChangeDirection): ChangeDesirability {
  const directionality = DIRECTIONALITY.get(metricName);
  if (!directionality || (direction !== "increased" && direction !== "decreased")) return "neutral";
  const higher = direction === "increased";
  return (directionality === "higher_is_favorable") === higher ? "favorable" : "unfavorable";
}

export function describeMetricChange(comparison: MetricComparison): MetricChangePresentation {
  const { metricName, direction, unit } = comparison;
  const desirability = metricDesirability(metricName, direction);
  const desirabilityLabel =
    desirability === "favorable" ? "Melhora" : desirability === "unfavorable" ? "Piora" : undefined;
  const deltaText =
    comparison.absoluteChange !== undefined && isIndicatorUnit(unit) && (direction === "increased" || direction === "decreased")
      ? formatDelta(comparison.absoluteChange, unit)
      : undefined;
  const symbol = direction === "increased" ? "↑" : direction === "decreased" ? "↓" : direction === "unchanged" ? "=" : "";
  const previousText = formatMetricValue(comparison.previousValue, unit);
  const currentText = formatMetricValue(comparison.currentValue, unit);

  return {
    metricName,
    previousText,
    currentText,
    deltaText,
    symbol,
    directionLabel: DIRECTION_TEXT[direction],
    desirability,
    desirabilityLabel,
    accessibleText: [
      `${metricName}: ${currentText}`,
      comparison.previousValue !== undefined ? `antes ${previousText}` : undefined,
      `${DIRECTION_TEXT[direction]}${deltaText ? ` ${deltaText}` : ""}`,
      desirabilityLabel?.toLowerCase(),
    ]
      .filter(Boolean)
      .join(", "),
  };
}
