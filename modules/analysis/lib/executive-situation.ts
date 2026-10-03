import {
  resolvePreviousPeriodComparison,
  selectLatestPeriodExecution,
  type HistoricalExecution,
  type PreviousPeriodComparison,
  type PreviousPeriodState,
} from "@/efos/application/history";
import type { ExecutiveReport } from "@/efos/application/report";
import type { Evidence, Indicator, Period, Recommendation } from "@/efos/domain";

import { formatEngineText } from "./engine-text";
import { formatPeriodLabel, type PeriodLabel } from "./period-label";
import { severityTag, priorityTag, type SemanticTag } from "./insight-semantics";
import { describeMetricChange, formatMetricValue, type MetricChangePresentation } from "./metric-change";

/**
 * Mission 204 — situação executiva de uma empresa, montada SOMENTE do que
 * o EFOS já produziu: o `ExecutiveReport` e a comparação canônica
 * (`compareExecutions`, Mission 085). Função pura: nenhum cálculo
 * financeiro novo, nenhum insight que o EFOS não tenha emitido; ausência
 * continua explícita.
 *
 * Mission 209 (D-134) — a situação é a do período mais recente (versão
 * mais recente), comparada com o período anterior canônico, resolvidos
 * pela autoridade única de `efos/application/history`
 * (`selectLatestPeriodExecution`/`resolvePreviousPeriodComparison`). Antes,
 * a Visão geral e o Dashboard comparavam com a execução imediatamente
 * anterior — uma reanálise do mesmo mês aparecia como "período anterior"
 * e produzia "estável" falso.
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
  /** Estado da comparação temporal: só `resolved` tem variações; os demais dizem por que não há. */
  readonly comparisonState: PreviousPeriodState;
  readonly analysesCount: number;
  readonly headline: readonly HeadlineMetric[];
  /** Evidências do EFOS, as mais graves primeiro. */
  readonly signals: readonly SituationSignal[];
  readonly signalsTotal: number;
  readonly recommendations: readonly SituationRecommendation[];
  /** Quantas métricas classificadas pelo EFOS melhoraram/pioraram desde o período anterior canônico. */
  readonly movement: { readonly improved: number; readonly worsened: number } | undefined;
}

/** Ordem de gravidade/prioridade dos Engines (a mais grave primeiro) — reaproveitada pelo relatório executivo (Mission 208). */
export const SEVERITY_ORDER: Readonly<Record<string, number>> = { critical: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_ORDER = SEVERITY_ORDER;

export function buildExecutiveSituation(history: readonly HistoricalExecution[]): ExecutiveSituation | undefined {
  const current = selectLatestPeriodExecution(history);
  if (!current) return undefined;
  return buildExecutiveSituationFor(current, resolvePreviousPeriodComparison(history, current), history.length);
}

/**
 * A situação de uma execução dada, com a comparação já resolvida pela
 * autoridade temporal — a Visão geral/Dashboard (acima) e o relatório
 * executivo (`modules/reports/`) chegam aqui pela mesma resolução.
 */
export function buildExecutiveSituationFor(
  current: HistoricalExecution,
  resolution: PreviousPeriodComparison,
  analysesCount: number
): ExecutiveSituation | undefined {
  if (!current.report) return undefined;
  const comparison = resolution.outcome === "resolved" ? resolution.comparison : undefined;
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

  const changes = comparison?.metrics.map((metric) => describeMetricChange(metric)) ?? [];
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

  return {
    period: period ? formatPeriodLabel(period) : undefined,
    previousPeriod: resolution.outcome === "resolved" ? formatPeriodLabel(resolution.baselinePeriod) : undefined,
    comparisonState: resolution.outcome,
    analysesCount,
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
