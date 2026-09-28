import type { ExecutionComparison, HistoricalExecution } from "@/efos/application/history";
import { compareExecutions } from "@/efos/application/history";
import type { ExecutiveReport } from "@/efos/application/report";
import type { Evidence, Indicator, Period, Recommendation } from "@/efos/domain";

import { formatEngineText } from "./engine-text";
import { formatPeriodLabel, type PeriodLabel } from "./period-label";
import { severityTag, priorityTag, type SemanticTag } from "./insight-semantics";
import { describeMetricChange, formatMetricValue, type MetricChangePresentation } from "./metric-change";

/**
 * Mission 204 — situação executiva de uma empresa, montada SOMENTE do que
 * o EFOS já produziu: o `ExecutiveReport` da última análise e a
 * comparação canônica (`compareExecutions`, Mission 085) com a análise
 * anterior. Função pura: nenhum cálculo financeiro novo, nenhum insight
 * que o EFOS não tenha emitido; ausência continua explícita.
 */

/** Métricas de manchete: rentabilidade, liquidez e alavancagem — nesta ordem. */
export { formatPeriodLabel, type PeriodLabel } from "./period-label";

export const HEADLINE_METRICS = ["Margem Líquida", "Margem Bruta", "Liquidez Corrente", "Endividamento Geral"] as const;

export function reportIndicators(report: ExecutiveReport | undefined): readonly Indicator[] {
  const section = report?.sections.find((candidate) => candidate.type === "indicators");
  return section?.type === "indicators" ? section.indicators.indicators : [];
}

export function reportPeriod(report: ExecutiveReport | undefined): Period | undefined {
  return reportIndicators(report).find((indicator) => indicator.period)?.period;
}

function reportEvidence(report: ExecutiveReport | undefined): readonly Evidence[] {
  const section = report?.sections.find((candidate) => candidate.type === "evidence");
  return section?.type === "evidence" ? section.evidence.evidences : [];
}

function reportRecommendations(report: ExecutiveReport | undefined): readonly Recommendation[] {
  const section = report?.sections.find((candidate) => candidate.type === "recommendation");
  return section?.type === "recommendation" ? section.recommendation.recommendations : [];
}

export interface HeadlineMetric {
  readonly name: string;
  /** Valor atual formatado; `undefined` = indisponível (nunca zero). */
  readonly valueText?: string;
  readonly change?: MetricChangePresentation;
}

export interface SituationSignal {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly tag: SemanticTag;
  readonly favorable: boolean;
}

export interface SituationRecommendation {
  readonly id: string;
  readonly title: string;
  readonly expectedImpact: string;
  readonly tag: SemanticTag;
}

export interface ExecutiveSituation {
  readonly period?: PeriodLabel;
  readonly previousPeriod?: PeriodLabel;
  readonly analysesCount: number;
  readonly headline: readonly HeadlineMetric[];
  /** Evidências do EFOS, as mais graves primeiro. */
  readonly signals: readonly SituationSignal[];
  readonly signalsTotal: number;
  readonly recommendations: readonly SituationRecommendation[];
  /** Quantas métricas classificadas pelo EFOS melhoraram/pioraram desde a análise anterior. */
  readonly movement: { readonly improved: number; readonly worsened: number } | undefined;
}

const SEVERITY_ORDER: Readonly<Record<string, number>> = { critical: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_ORDER = SEVERITY_ORDER;

export function buildExecutiveSituation(history: readonly HistoricalExecution[]): ExecutiveSituation | undefined {
  const current = history.at(-1);
  if (!current?.report) return undefined;
  const previous = history.length > 1 ? history.at(-2) : undefined;
  const comparison: ExecutionComparison | undefined = previous ? compareExecutions(previous, current) : undefined;
  const comparisonByName = new Map(comparison?.metrics.map((metric) => [metric.metricName, metric] as const) ?? []);

  const indicators = reportIndicators(current.report);
  const headline: HeadlineMetric[] = HEADLINE_METRICS.flatMap((name) => {
    const indicator = indicators.find((candidate) => candidate.name === name);
    if (!indicator) return [];
    const metric = comparisonByName.get(name);
    return [
      {
        name,
        valueText:
          indicator.result.status === "available" ? formatMetricValue(indicator.result.value, indicator.unit) : undefined,
        change: metric ? describeMetricChange(metric) : undefined,
      },
    ];
  });

  const changes = comparison?.metrics.map(describeMetricChange) ?? [];
  const movement = comparison
    ? {
        improved: changes.filter((change) => change.desirability === "favorable").length,
        worsened: changes.filter((change) => change.desirability === "unfavorable").length,
      }
    : undefined;

  const evidence = [...reportEvidence(current.report)].sort(
    (a, b) =>
      Number(a.type === "positive") - Number(b.type === "positive") ||
      (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  );

  const recommendations = [...reportRecommendations(current.report)]
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))
    .map((recommendation) => ({
      id: recommendation.id,
      title: formatEngineText(recommendation.title),
      expectedImpact: formatEngineText(recommendation.expectedImpact),
      tag: priorityTag(recommendation.priority),
    }));

  const period = reportPeriod(current.report);
  const previousPeriod = reportPeriod(previous?.report);

  return {
    period: period ? formatPeriodLabel(period) : undefined,
    previousPeriod: previousPeriod ? formatPeriodLabel(previousPeriod) : undefined,
    analysesCount: history.length,
    headline,
    signals: evidence.map((item) => ({
      id: item.id,
      title: formatEngineText(item.title),
      description: formatEngineText(item.description),
      tag: severityTag(item.severity),
      favorable: item.type === "positive",
    })),
    signalsTotal: evidence.length,
    recommendations,
    movement,
  };
}
