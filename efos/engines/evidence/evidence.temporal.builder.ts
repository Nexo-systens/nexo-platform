import type {
  EvidenceCategory,
  EvidenceConfidence,
  EvidenceSeverity,
  EvidenceSource,
  FinancialKnowledgeGraphAggregate,
  FinancialModelAggregate,
  IndicatorsAggregate,
  Period,
} from "@/efos/domain";
import { EVIDENCE_SEVERITIES } from "@/efos/domain";

import {
  CURRENT_LIQUIDITY_MINIMUM,
  MINIMUM_PERIODS_FOR_SUSTAINED_DETERIORATION,
  RECOGNIZED_INDICATOR_NAMES,
} from "./evidence.constants";
import {
  computeOperatingCashFlow,
  findIndicatorByName,
  sourcesForEvents,
  sourcesForIndicator,
} from "./evidence.builder";
import type { EvidenceDraft, EvidenceHistoricalPeriod } from "./evidence.types";
import { periodOf } from "./evidence.validator";

/**
 * Mission 166 — Temporal Evidence Detection (D-087). Mission 168
 * estendeu este arquivo com "Melhora Sustentada" (Sustained
 * Improvement), a Evidence positiva simétrica aprovada pelo design da
 * Mission 167.
 *
 * Regras que comparam o período atual contra períodos ANTERIORES da
 * mesma empresa — deliberadamente separadas de `evidence.builder.ts`
 * (regras de período único, Mission 009), por instrução explícita da
 * missão. Nunca reimplementa a mesma fórmula duas vezes:
 * `findIndicatorByName`/`sourcesForIndicator`/`sourcesForEvents`/
 * `computeOperatingCashFlow` são todas reaproveitadas de
 * `evidence.builder.ts`, nunca duplicadas aqui.
 *
 * Escopo aprovado pela Mission 166A (design review): "Declínio
 * Sustentado" (Rule A), com escalonamento de severidade dobrado nela
 * (Rule C nunca é uma regra própria). Escopo aprovado pela Mission 167
 * (design review): "Melhora Sustentada" — espelho direto de Declínio
 * Sustentado, mesmo algoritmo de janela máxima (generalizado em
 * `findMaximalRun()` para aceitar a direção desejada), mesmo mapa de
 * direcionalidade (D-087, inalterado), `type: "positive"`, severidade
 * SEMPRE fixa `"low"` (nunca escalona — não há limiar de crise a
 * cruzar), deliberadamente Context-inerte (nenhuma mudança em
 * ContextEngine/ReasoningEngine/RecommendationEngine).
 *
 * **IMPORTANTE (Mission 168, Etapa 3)**: "Melhora Sustentada" significa
 * exatamente que um Indicator reconhecido melhorou favoravelmente
 * segundo o mapa de direcionalidade — NUNCA "recuperação financeira",
 * "normalização", "saúde financeira", "resolução de crise", "Outcome
 * favorável" ou "encerramento de um Context adverso". Uma Evidence
 * positiva não apaga nem reinterpreta nenhuma Evidence de declínio já
 * produzida em execuções anteriores.
 *
 * Recovery propriamente dita (vincular uma melhora a uma deterioração
 * anterior específica), transição de estado, volatilidade e "mudança
 * significativa" (Rule B) permanecem deliberadamente fora deste
 * arquivo — ver README.md.
 */

export type TemporalSnapshot = EvidenceHistoricalPeriod;

/** Resultado de extrair um valor numérico de um snapshot — `available: false` cobre tanto Indicator ausente/indisponível quanto qualquer outro motivo estrutural de não ter valor. */
export interface TemporalMetricValue {
  readonly available: boolean;
  readonly value?: number;
}

export type MetricDirectionality = "higher_is_favorable" | "lower_is_favorable";

export interface TemporalMetricDefinition {
  readonly metricKey: string;
  readonly label: string;
  readonly category: EvidenceCategory;
  readonly directionality: MetricDirectionality;
  readonly unit: string;
  readonly confidence: EvidenceConfidence;
  readonly extractValue: (snapshot: TemporalSnapshot) => TemporalMetricValue;
  readonly sourcesFor: (
    window: readonly TemporalSnapshot[],
    graph: FinancialKnowledgeGraphAggregate
  ) => EvidenceSource[];
  /**
   * Presente apenas quando o metric já tem uma regra ABSOLUTA
   * existente em `evidence.builder.ts` (Mission 009) — usado
   * exclusivamente para o escalonamento de severidade (Etapa 7 da
   * Mission 166), nunca para decidir se a Evidence temporal é emitida.
   */
  readonly absoluteBreach?: (currentValue: number) => boolean;
}

function indicatorMetricValue(
  indicatorName: string
): (snapshot: TemporalSnapshot) => TemporalMetricValue {
  return (snapshot) => {
    const indicator = findIndicatorByName(snapshot.indicators, indicatorName);
    if (!indicator || indicator.result.status !== "available") {
      return { available: false };
    }
    return { available: true, value: indicator.result.value };
  };
}

function indicatorSources(
  indicatorName: string
): (
  window: readonly TemporalSnapshot[],
  graph: FinancialKnowledgeGraphAggregate
) => EvidenceSource[] {
  // Deduplicado a uma única entrada (Mission 166A, Etapa 5): o mesmo
  // Indicator.id é idêntico em todos os períodos da mesma empresa
  // (D-001/Mission 163) — citar o do período atual (último do window)
  // já é suficiente; citar o mesmo id várias vezes não adiciona
  // rastreabilidade real.
  return (window, graph) => {
    const current = window[window.length - 1];
    const indicator = findIndicatorByName(current.indicators, indicatorName);
    return indicator ? sourcesForIndicator(indicator, graph) : [];
  };
}

function operatingCashFlowValue(snapshot: TemporalSnapshot): TemporalMetricValue {
  const { netOperatingCashFlow } = computeOperatingCashFlow(
    snapshot.financialModel.events
  );
  return { available: true, value: netOperatingCashFlow };
}

function operatingCashFlowSources(
  window: readonly TemporalSnapshot[],
  graph: FinancialKnowledgeGraphAggregate
): EvidenceSource[] {
  // Diferente de Indicator.id, os ids de FinancialEvent SAO distintos
  // por período (Mission 166A, Etapa 5) — aqui, ao contrário das
  // métricas baseadas em Indicator, a rastreabilidade correta agrega
  // os eventos reais de TODOS os períodos da janela, nunca só o atual.
  const allEvents = window.flatMap((snapshot) => {
    const { inflowEvents, outflowEvents } = computeOperatingCashFlow(
      snapshot.financialModel.events
    );
    return [...inflowEvents, ...outflowEvents];
  });
  return sourcesForEvents(allEvents, graph);
}

/**
 * Mapa de direcionalidade financeira (Mission 166A, Etapa "Financial
 * Directionality Review") — conservador por desenho: apenas métricas
 * com interpretação universalmente segura estão listadas. Working
 * capital, endividamento, composição de endividamento, prazo médio de
 * pagamento, receita, despesas operacionais, patrimônio líquido,
 * contas a receber/pagar (como valores brutos) foram deliberadamente
 * EXCLUÍDOS — nunca classificados por intuição (ver README.md).
 */
export const TEMPORAL_METRIC_DEFINITIONS: readonly TemporalMetricDefinition[] = [
  {
    metricKey: "gross-margin",
    label: "Margem Bruta",
    category: "profitability",
    directionality: "higher_is_favorable",
    unit: "percentage",
    confidence: "verified",
    extractValue: indicatorMetricValue(RECOGNIZED_INDICATOR_NAMES.grossMargin),
    sourcesFor: indicatorSources(RECOGNIZED_INDICATOR_NAMES.grossMargin),
    absoluteBreach: (value) => value < 0,
  },
  {
    metricKey: "operating-margin",
    label: "Margem Operacional",
    category: "profitability",
    directionality: "higher_is_favorable",
    unit: "percentage",
    confidence: "verified",
    extractValue: indicatorMetricValue(
      RECOGNIZED_INDICATOR_NAMES.operatingMargin
    ),
    sourcesFor: indicatorSources(RECOGNIZED_INDICATOR_NAMES.operatingMargin),
    absoluteBreach: (value) => value < 0,
  },
  {
    metricKey: "net-margin",
    label: "Margem Líquida",
    category: "profitability",
    directionality: "higher_is_favorable",
    unit: "percentage",
    confidence: "verified",
    extractValue: indicatorMetricValue(RECOGNIZED_INDICATOR_NAMES.netMargin),
    sourcesFor: indicatorSources(RECOGNIZED_INDICATOR_NAMES.netMargin),
    absoluteBreach: (value) => value < 0,
  },
  {
    metricKey: "current-liquidity",
    label: "Liquidez Corrente",
    category: "liquidity",
    directionality: "higher_is_favorable",
    unit: "ratio",
    confidence: "verified",
    extractValue: indicatorMetricValue(
      RECOGNIZED_INDICATOR_NAMES.currentLiquidity
    ),
    sourcesFor: indicatorSources(RECOGNIZED_INDICATOR_NAMES.currentLiquidity),
    absoluteBreach: (value) => value < CURRENT_LIQUIDITY_MINIMUM,
  },
  {
    metricKey: "quick-liquidity",
    label: "Liquidez Seca",
    category: "liquidity",
    directionality: "higher_is_favorable",
    unit: "ratio",
    confidence: "verified",
    extractValue: indicatorMetricValue(
      RECOGNIZED_INDICATOR_NAMES.quickLiquidity
    ),
    sourcesFor: indicatorSources(RECOGNIZED_INDICATOR_NAMES.quickLiquidity),
    // Sem regra absoluta existente para Liquidez Seca — nunca escalona.
  },
  {
    metricKey: "immediate-liquidity",
    label: "Liquidez Imediata",
    category: "liquidity",
    directionality: "higher_is_favorable",
    unit: "ratio",
    confidence: "verified",
    extractValue: indicatorMetricValue(
      RECOGNIZED_INDICATOR_NAMES.immediateLiquidity
    ),
    sourcesFor: indicatorSources(RECOGNIZED_INDICATOR_NAMES.immediateLiquidity),
    // Sem regra absoluta existente para Liquidez Imediata — nunca escalona.
    // Representa "caixa deteriorando" (Mission 165/166A) via este
    // Indicator já formal — nunca um conceito novo de "Caixa bruto".
  },
  {
    metricKey: "average-receipt-period",
    label: "Prazo Médio de Recebimento",
    category: "profitability",
    directionality: "lower_is_favorable",
    unit: "days",
    confidence: "verified",
    extractValue: indicatorMetricValue(
      RECOGNIZED_INDICATOR_NAMES.averageReceiptPeriod
    ),
    sourcesFor: indicatorSources(RECOGNIZED_INDICATOR_NAMES.averageReceiptPeriod),
    // Sem regra absoluta existente — nunca escalona.
  },
  {
    metricKey: "operating-cash-flow",
    label: "Fluxo de Caixa Operacional",
    category: "cash_flow",
    directionality: "higher_is_favorable",
    unit: "currency",
    confidence: "high", // mesma confiança da regra absoluta irmã — convenção, não Indicator validado.
    extractValue: operatingCashFlowValue,
    sourcesFor: operatingCashFlowSources,
    absoluteBreach: (value) => value < 0,
  },
];

/**
 * Sentido de transição que uma regra temporal está procurando — o
 * mesmo par-a-par usado por Declínio Sustentado (`"unfavorable"`,
 * Mission 166) e por Melhora Sustentada (`"favorable"`, Mission 168).
 * "Unchanged" nunca satisfaz nenhum dos dois sentidos — quebra a
 * janela em ambas as direções (Mission 166A/167: "unchanged breaks
 * the run").
 */
type ChangeDesirability = "favorable" | "unfavorable";

function matchesDesiredChange(
  directionality: MetricDirectionality,
  desired: ChangeDesirability,
  previous: number,
  current: number
): boolean {
  const increased = current > previous;
  const decreased = current < previous;
  if (desired === "unfavorable") {
    return directionality === "higher_is_favorable" ? decreased : increased;
  }
  return directionality === "higher_is_favorable" ? increased : decreased;
}

/**
 * Encontra a MAIOR janela consecutiva, terminando sempre no período
 * atual (último item de `values`), em que cada transição par-a-par
 * corresponde ao sentido desejado (`desired`) — nunca uma sub-janela
 * sobreposta, nunca um resultado por período (Mission 166A, Etapa
 * "Rule A"; generalizada pela Mission 168 para também servir Melhora
 * Sustentada, mesmo algoritmo, sentido oposto — nunca uma segunda
 * implementação). Um valor indisponível em qualquer ponto interrompe a
 * extensão da janela (nunca inventa um valor); "unchanged" também
 * interrompe (não satisfaz nem `"favorable"` nem `"unfavorable"`).
 * Retorna `undefined` quando a janela resultante é menor que
 * `MINIMUM_PERIODS_FOR_SUSTAINED_DETERIORATION` — a mesma constante,
 * mesmo valor, é compartilhada pelas duas direções (Mission 168, Etapa
 * 7: nenhum limiar novo).
 */
function findMaximalRun(
  directionality: MetricDirectionality,
  desired: ChangeDesirability,
  values: readonly TemporalMetricValue[]
): { readonly startIndex: number; readonly endIndex: number } | undefined {
  const lastIndex = values.length - 1;
  if (lastIndex < 0 || !values[lastIndex].available) return undefined;

  let startIndex = lastIndex;
  for (let i = lastIndex; i > 0; i--) {
    const previous = values[i - 1];
    const current = values[i];
    if (!previous.available || !current.available) break;
    if (!matchesDesiredChange(directionality, desired, previous.value!, current.value!)) {
      break;
    }
    startIndex = i - 1;
  }

  const windowLength = lastIndex - startIndex + 1;
  if (windowLength < MINIMUM_PERIODS_FOR_SUSTAINED_DETERIORATION) {
    return undefined;
  }

  return { startIndex, endIndex: lastIndex };
}

function escalateSeverity(severity: EvidenceSeverity): EvidenceSeverity {
  const currentRank = EVIDENCE_SEVERITIES.indexOf(severity);
  const nextRank = Math.min(currentRank + 1, EVIDENCE_SEVERITIES.length - 1);
  return EVIDENCE_SEVERITIES[nextRank];
}

/** Severidade base fixa para toda Evidence de declínio sustentado (Mission 166A: nenhum limiar de magnitude inventado) — escalonada +1 nível apenas quando o valor atual também rompe o limiar absoluto já existente da mesma métrica. */
const BASE_SUSTAINED_DETERIORATION_SEVERITY: EvidenceSeverity = "medium";

/** Severidade SEMPRE fixa para toda Evidence de melhora sustentada (Mission 168, Etapa 6) — nunca escalona: não há limiar de crise a cruzar, e escalonar exigiria o mesmo mecanismo de referência a uma deterioração anterior específica que a Mission 167 deferiu (Recovery). */
const SUSTAINED_IMPROVEMENT_SEVERITY: EvidenceSeverity = "low";

/**
 * Monta os campos comuns (janela de snapshots/valores/períodos,
 * `observedPeriod`, array `periods` para `supportingData`) a partir de
 * uma janela máxima já encontrada por `findMaximalRun()` — reaproveitado
 * por Declínio Sustentado e Melhora Sustentada (Mission 168, Etapa 5:
 * nunca duplicar o algoritmo).
 */
function buildObservedWindow(
  window: readonly TemporalSnapshot[],
  values: readonly TemporalMetricValue[],
  found: { readonly startIndex: number; readonly endIndex: number }
): {
  readonly windowSnapshots: readonly TemporalSnapshot[];
  readonly windowValues: readonly TemporalMetricValue[];
  readonly currentValue: number;
  readonly observedPeriod: Period;
  readonly periods: readonly { startDate: string; endDate: string; value: number | undefined }[];
} {
  const { startIndex, endIndex } = found;
  const windowSnapshots = window.slice(startIndex, endIndex + 1);
  const windowValues = values.slice(startIndex, endIndex + 1);
  const currentValue = windowValues[windowValues.length - 1].value!;
  const windowPeriods = windowSnapshots.map((snapshot) => periodOf(snapshot.indicators)!);

  const observedPeriod: Period = {
    startDate: windowPeriods[0].startDate,
    endDate: windowPeriods[windowPeriods.length - 1].endDate,
  };

  const periods = windowPeriods.map((period, index) => ({
    startDate: period.startDate,
    endDate: period.endDate,
    value: windowValues[index].value,
  }));

  return { windowSnapshots, windowValues, currentValue, observedPeriod, periods };
}

function detectSustainedDeteriorationForMetric(
  definition: TemporalMetricDefinition,
  window: readonly TemporalSnapshot[],
  graph: FinancialKnowledgeGraphAggregate
): EvidenceDraft[] {
  const values = window.map(definition.extractValue);
  const found = findMaximalRun(definition.directionality, "unfavorable", values);
  if (!found) return [];

  const { windowSnapshots, currentValue, observedPeriod, periods } = buildObservedWindow(
    window,
    values,
    found
  );

  const escalated = definition.absoluteBreach?.(currentValue) ?? false;
  const severity = escalated
    ? escalateSeverity(BASE_SUSTAINED_DETERIORATION_SEVERITY)
    : BASE_SUSTAINED_DETERIORATION_SEVERITY;

  const directionLabel =
    definition.directionality === "higher_is_favorable" ? "queda" : "alta";

  return [
    {
      key: `${definition.metricKey}-sustained-decline`,
      type: "negative",
      category: definition.category,
      severity,
      confidence: definition.confidence,
      title: `Declínio sustentado de ${definition.label}`,
      description: `${definition.label} apresenta ${directionLabel} desfavorável em ${periods.length} períodos consecutivos, de ${observedPeriod.startDate} a ${observedPeriod.endDate}.`,
      supportingData: {
        indicatorName: definition.metricKey,
        unit: definition.unit,
        directionality: definition.directionality,
        periods,
        escalated,
        ...(escalated
          ? { escalationReason: "current-value-breaches-existing-absolute-threshold" }
          : {}),
      },
      sources: definition.sourcesFor(windowSnapshots, graph),
      observedPeriod,
    },
  ];
}

/**
 * Mission 168 — Melhora Sustentada (Sustained Improvement). Espelho
 * exato de `detectSustainedDeteriorationForMetric()`, sentido
 * `"favorable"` em vez de `"unfavorable"` — mesmo algoritmo
 * (`findMaximalRun()`), mesmo mapa de direcionalidade (D-087),
 * `type: "positive"` (valor reservado desde a Mission 009, nunca usado
 * até agora), severidade SEMPRE `"low"` (nunca escalona —
 * `absoluteBreach` do metric é deliberadamente ignorado aqui: cruzar
 * de volta um limiar de saúde seria "Recovery", explicitamente
 * deferida pela Mission 167). Nunca afirma recuperação/normalização —
 * apenas que a métrica melhorou favoravelmente por um número
 * sustentado de períodos, segundo o mesmo mapa de direcionalidade já
 * aprovado.
 */
function detectSustainedImprovementForMetric(
  definition: TemporalMetricDefinition,
  window: readonly TemporalSnapshot[],
  graph: FinancialKnowledgeGraphAggregate
): EvidenceDraft[] {
  const values = window.map(definition.extractValue);
  const found = findMaximalRun(definition.directionality, "favorable", values);
  if (!found) return [];

  const { windowSnapshots, observedPeriod, periods } = buildObservedWindow(window, values, found);

  return [
    {
      key: `${definition.metricKey}-sustained-improvement`,
      type: "positive",
      category: definition.category,
      severity: SUSTAINED_IMPROVEMENT_SEVERITY,
      confidence: definition.confidence,
      title: `Melhora sustentada de ${definition.label}`,
      description: `${definition.label} apresenta movimento favorável sustentado em ${periods.length} períodos consecutivos, de ${observedPeriod.startDate} a ${observedPeriod.endDate} — não implica recuperação, normalização ou saúde financeira, apenas a direção observada segundo o mapa de direcionalidade (D-087).`,
      supportingData: {
        indicatorName: definition.metricKey,
        unit: definition.unit,
        directionality: definition.directionality,
        periods,
      },
      sources: definition.sourcesFor(windowSnapshots, graph),
      observedPeriod,
    },
  ];
}

/**
 * Ponto de entrada das regras temporais (Mission 166, D-087; Mission
 * 168 somou Melhora Sustentada). Retorna `[]` quando `priorPeriods`
 * está ausente ou vazio — preserva byte a byte o comportamento
 * anterior a esta missão (nenhuma regra temporal executa sem
 * histórico real). Nunca reordena/reexecuta as regras absolutas de
 * `evidence.builder.ts` — apenas soma novos rascunhos, com `key`s
 * distintas das 5 já existentes e entre si (`-sustained-decline` vs.
 * `-sustained-improvement`, nunca colidem por construção). Por
 * `findMaximalRun()` ser ancorada sempre no período atual, a mesma
 * métrica nunca produz as duas Evidences simultaneamente na mesma
 * execução — a última transição é favorável, desfavorável, ou
 * inalterada, nunca as duas ao mesmo tempo.
 */
export function detectTemporalEvidence(
  financialModel: FinancialModelAggregate,
  indicators: IndicatorsAggregate,
  priorPeriods: readonly EvidenceHistoricalPeriod[] | undefined,
  graph: FinancialKnowledgeGraphAggregate
): EvidenceDraft[] {
  if (!priorPeriods || priorPeriods.length === 0) return [];

  const window: readonly TemporalSnapshot[] = [
    ...priorPeriods,
    { financialModel, indicators },
  ];

  return TEMPORAL_METRIC_DEFINITIONS.flatMap((definition) => [
    ...detectSustainedDeteriorationForMetric(definition, window, graph),
    ...detectSustainedImprovementForMetric(definition, window, graph),
  ]);
}
