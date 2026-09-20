import type { Decision, IndicatorsAggregate, Period } from "@/efos/domain";
import { INDICATOR_DEFINITIONS, type IndicatorDirectionality } from "@/efos/engines/indicators";
import { readScenarioDecisionContext } from "@/efos/application/decision-lifecycle";
import { classifyScenarioMetricImpact, directionalityForScenarioMetric } from "@/efos/application/scenario-simulation";

import type {
  BuildExpectedActualComparisonOutcome,
  ExpectedActualAlignment,
  ExpectedActualBasis,
  ExpectedActualDirectionConsistency,
  ExpectedActualMetricComparison,
  ObservedFinancialTruthResolution,
} from "./ExpectedActualComparison";

/**
 * Mission 185 Closure, Seção 9/12/17 — o texto muda por `basis`
 * porque a força epistêmica de cada camada é genuinamente diferente
 * (nunca apenas estética): `"live"` é uma distância ATUAL para uma
 * META modelada, que se move a cada novo período reportado — nunca
 * uma previsão de período específico, nunca uma avaliação final.
 * `"formal"` é ancorada a um momento que o executivo escolheu
 * explicitamente (`FinancialOutcomeObservation`, Mission 139) — mais
 * forte, mas ainda assim nunca causal.
 */
const DISCLAIMERS: Readonly<Record<ExpectedActualBasis, string>> = {
  live: "Comparação AO VIVO entre a meta financeira modelada no momento da decisão e o estado financeiro canônico mais atual — nunca uma previsão para um período específico, nunca uma avaliação final: esta comparação se atualiza automaticamente à medida que novos períodos são reportados, e nunca prova que a decisão causou o resultado observado.",
  formal: "Comparação ancorada ao momento em que uma observação financeira foi explicitamente registrada — permanece fixa a partir desse registro, mesmo que dados mais novos surjam depois, e nunca prova que a decisão causou o resultado observado.",
};

const GENERIC_LIMITATIONS: readonly string[] = [
  "O período observado pode conter outras mudanças financeiras não relacionadas a esta decisão.",
  "Associação temporal, nunca prova de causalidade.",
];

/**
 * Mission 185, Seção 12 — "Horizon Feasibility Audit". A vertical de
 * prazo de recebimento tem uma limitação genuína e adicional que a de
 * Despesas Operacionais não tem: o efeito de uma mudança de prazo se
 * acumula gradualmente à medida que novas vendas passam a seguir o
 * novo prazo (a hipótese original assume a troca instantânea de saldo,
 * `simulateCollectionPeriodScenario.ts`) — o período observado
 * imediatamente seguinte pode subestimar o efeito de longo prazo.
 * Nenhuma vertical é bloqueada; a diferença é documentada explicitamente.
 */
const SCENARIO_VERTICAL_LIMITATIONS: Readonly<Record<string, readonly string[]>> = {
  adjust_operating_costs: GENERIC_LIMITATIONS,
  adjust_collection_terms: [
    "Uma mudança de prazo de recebimento tende a se refletir gradualmente na Financial Truth, à medida que novas vendas passam a seguir o novo prazo — a hipótese original assume uma troca instantânea de saldo (Mission 182), então o período observado imediatamente seguinte pode subestimar o efeito de prazo mais longo.",
    ...GENERIC_LIMITATIONS,
  ],
};

/**
 * Localiza o valor de um indicador na verdade financeira OBSERVADA
 * (`IndicatorsAggregate`, já um agregado real e persistido — nunca
 * recalculado aqui) a partir do `metricKey` camelCase usado por
 * `INDICATOR_DEFINITIONS`/`ScenarioDecisionContext.comparison`.
 * `Indicator.name` armazena o rótulo em português
 * (`INDICATOR_DEFINITIONS[key].name`, mesma convenção de
 * `RECOGNIZED_INDICATOR_NAMES`, Evidence Engine) — mesmo princípio de
 * busca de `findIndicatorByName()` (`evidence.builder.ts`), reafirmado
 * aqui em vez de importado (módulo interno de outro Engine, nunca
 * exportado pelo barrel público). `undefined` cobre tanto "indicador
 * não existe nesta execução" quanto `status !== "available"` (D-052) —
 * nunca um valor fabricado.
 */
function findObservedValue(indicators: IndicatorsAggregate, metricKey: string): number | undefined {
  const definition = (INDICATOR_DEFINITIONS as Record<string, { readonly name: string } | undefined>)[metricKey];
  if (!definition) return undefined;
  const indicator = indicators.indicators.find((candidate) => candidate.name === definition.name);
  if (!indicator || indicator.result.status !== "available") return undefined;
  return indicator.result.value;
}

/**
 * Mesma disciplina de cronologia de `resolveCurrentFinancialExecution()`
 * (startDate decide, endDate desempata) — nunca `executedAt` (Seção 22).
 */
function periodIsAfter(candidate: Period, reference: Period): boolean {
  if (candidate.startDate !== reference.startDate) return candidate.startDate > reference.startDate;
  return candidate.endDate > reference.endDate;
}

/**
 * Alinhamento de magnitude (O vs. E, Seção 16/19) — nunca confundido
 * com consistência de direção (O-B vs. E-B). `expectationGap === 0` é
 * tratado explicitamente como `"as-expected"`, distinto de `"neutral"`
 * (direcionalidade desconhecida, Seção 19: "unknown directionality
 * must remain neutral").
 */
function classifyAlignment(expectationGap: number, directionality: IndicatorDirectionality | undefined): ExpectedActualAlignment {
  if (expectationGap === 0) return "as-expected";
  if (!directionality) return "neutral";
  return classifyScenarioMetricImpact(expectationGap, directionality) === "favorable" ? "better-than-expected" : "worse-than-expected";
}

function classifyDirectionConsistency(
  observedImpact: "favorable" | "unfavorable" | "neutral",
  expectedImpact: "favorable" | "unfavorable" | "neutral"
): ExpectedActualDirectionConsistency {
  if (observedImpact === "neutral" || expectedImpact === "neutral") return "neutral";
  return observedImpact === expectedImpact ? "consistent-direction" : "opposite-direction";
}

/**
 * Único ponto de composição de Expected vs. Actual (Seção 21 —
 * "smallest pure Application capability"). Nunca calcula um indicador
 * novo (reaproveita `IndicatorsAggregate` já produzido pelo Indicators
 * Engine); nunca infere causalidade; nunca recomputa a expectativa
 * histórica (`scenarioContext` já é o snapshot congelado de D-094/
 * D-095/D-096); nunca lê `scenarioContext.alternative` (Seção 33 — a
 * alternativa não escolhida nunca é tratada como executada).
 *
 * `basis` (Mission 185 Closure) nunca muda a aritmética B/E/O — apenas
 * a interpretação/linguagem anexada ao resultado (`disclaimer`) e,
 * indiretamente, QUAL execução o chamador resolveu como `observed`
 * antes de chegar aqui (`resolveExpectedActualComparison()`) — esta
 * função permanece agnóstica a COMO `observed` foi escolhido.
 */
export function buildExpectedActualComparison(
  decision: Decision,
  observed: ObservedFinancialTruthResolution,
  basis: ExpectedActualBasis
): BuildExpectedActualComparisonOutcome {
  const scenarioContext = readScenarioDecisionContext(decision.supportingData);
  if (!scenarioContext) {
    return { outcome: "not-scenario-backed" };
  }

  const base = {
    decisionId: decision.id,
    companyId: decision.companyId,
    scenarioType: scenarioContext.scenarioType,
    basis,
    baselinePeriod: scenarioContext.period,
    nature: "observational" as const,
    disclaimer: DISCLAIMERS[basis],
    limitations: SCENARIO_VERTICAL_LIMITATIONS[scenarioContext.scenarioType] ?? GENERIC_LIMITATIONS,
  };

  if (observed.outcome === "no-history") {
    return {
      outcome: "built",
      comparison: {
        ...base,
        eligibility: "insufficient-data",
        reason: "Não há verdade financeira observável para esta empresa ainda.",
        metrics: [],
      },
    };
  }

  if (observed.outcome === "ambiguous") {
    return {
      outcome: "built",
      comparison: {
        ...base,
        eligibility: "ambiguous-truth",
        reason:
          "A verdade financeira atual desta empresa não pôde ser estabelecida sem ambiguidade — nenhum resultado observado pode ser comparado com segurança.",
        metrics: [],
      },
    };
  }

  // Seção 24/25 — "Observation Must Be After the Decision Baseline" /
  // "Same-Period Reanalysis". Um período IDÊNTICO ao baseline nunca é
  // tratado como resultado posterior — mesmo se o conteúdo tivesse
  // mudado (o que já teria sido rejeitado como "ambiguous"/"conflicting"
  // por `resolveCurrentFinancialExecution()`, D-088/Mission 170C, antes
  // mesmo de chegar aqui — ver `resolveExpectedActualComparison.ts`).
  if (!periodIsAfter(observed.period, scenarioContext.period)) {
    const samePeriod =
      observed.period.startDate === scenarioContext.period.startDate &&
      observed.period.endDate === scenarioContext.period.endDate;
    return {
      outcome: "built",
      comparison: {
        ...base,
        eligibility: "awaiting-observation",
        reason: samePeriod
          ? "A verdade financeira mais recente ainda é do mesmo período em que a decisão foi tomada — nenhum resultado posterior foi reportado ainda."
          : "A verdade financeira mais recente disponível não é posterior ao período em que a decisão foi tomada.",
        metrics: [],
      },
    };
  }

  const metrics: ExpectedActualMetricComparison[] = scenarioContext.comparison.map((entry) => {
    if (entry.status === "unavailable") {
      return { metricKey: entry.metricKey, label: entry.label, unit: entry.unit, status: "unavailable", reason: "expected-unavailable" };
    }

    const observedValue = findObservedValue(observed.indicators, entry.metricKey);
    if (observedValue === undefined) {
      return { metricKey: entry.metricKey, label: entry.label, unit: entry.unit, status: "unavailable", reason: "observed-unavailable" };
    }

    const directionality = directionalityForScenarioMetric(entry.metricKey);
    const expectedChange = entry.delta;
    const observedChange = observedValue - entry.baselineValue;
    const expectationGap = observedValue - entry.projectedValue;
    const observedImpact = classifyScenarioMetricImpact(observedChange, directionality);

    return {
      metricKey: entry.metricKey,
      label: entry.label,
      unit: entry.unit,
      status: "compared",
      baselineValue: entry.baselineValue,
      expectedValue: entry.projectedValue,
      observedValue,
      expectedChange,
      observedChange,
      expectationGap,
      directionConsistency: classifyDirectionConsistency(observedImpact, entry.impact),
      expectationAlignment: classifyAlignment(expectationGap, directionality),
    };
  });

  return {
    outcome: "built",
    comparison: {
      ...base,
      eligibility: "comparable",
      observedPeriod: observed.period,
      reason: basis === "formal" ? "Avaliação formal comparável." : "Comparação atual disponível — atualiza-se a cada novo período reportado.",
      metrics,
    },
  };
}
