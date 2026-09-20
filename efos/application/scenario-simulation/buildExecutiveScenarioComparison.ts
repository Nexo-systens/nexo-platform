import { compareScenarioIndicator } from "./compareScenarioIndicator";
import type {
  ExecutiveScenarioComparisonOutcome,
  ScenarioComparisonMetric,
} from "./ExecutiveScenarioComparison";
import type { ScenarioProjection } from "./ScenarioProjection";

const SCENARIO_COMPARISON_LIMITATIONS: readonly string[] = [
  "Esta é uma comparação entre cenários hipotéticos, não uma previsão de fato (Product Vision: \"Não entregamos previsões. Entregamos cenários.\").",
  "Apenas relações financeiras já modeladas por cada simulador estão incluídas — consequências operacionais não modeladas (ex.: impacto em relacionamento com clientes/fornecedores, capacidade produtiva) nunca são inferidas.",
  "Nenhum cenário é automaticamente uma recomendação — esta comparação nunca escolhe um vencedor nem atribui uma pontuação única entre dimensões financeiras diferentes (Seção 9/10).",
  "Indicadores sem direção canônica de favorabilidade (D-093) são apresentados apenas como variação numérica neutra — nunca como 'melhora'/'piora' adivinhada.",
];

/**
 * Mission 183 — Executive Scenario Comparison.
 *
 * Reaproveita `compareScenarioIndicator()` (Mission 182, já calcula
 * `impact` desde a correção desta missão) sem alteração — nunca uma
 * segunda implementação de comparação (Seção 7: "Comparison consumes
 * scenario results. It does not become another financial engine"). A
 * união dos `metricKey` causalmente afetados por CADA cenário (nunca a
 * interseção — um indicador afetado por só um dos cenários ainda
 * aparece, com `delta: 0`/`impact: "neutral"` para o outro, provando a
 * fronteira causal, Seção 18).
 */
function compareScenarioProjections(
  baselineIndicators: ScenarioProjection["baseline"]["indicators"],
  scenarios: readonly ScenarioProjection[]
): readonly ScenarioComparisonMetric[] {
  const unionKeys: string[] = [];
  const seen = new Set<string>();
  for (const scenario of scenarios) {
    for (const entry of scenario.comparison) {
      if (!seen.has(entry.metricKey)) {
        seen.add(entry.metricKey);
        unionKeys.push(entry.metricKey);
      }
    }
  }

  return unionKeys.map((key) => {
    const perScenario = scenarios.map((scenario) =>
      compareScenarioIndicator(key, baselineIndicators, scenario.projected.indicators)
    );
    // label/unit são idênticos em toda entrada de `perScenario` para a
    // mesma key (vêm do mesmo INDICATOR_DEFINITIONS) — lidos de qualquer
    // uma, nunca recalculados.
    return { metricKey: key, label: perScenario[0].label, unit: perScenario[0].unit, perScenario };
  });
}

/**
 * Núcleo puro da comparação (Seção 21 — "compareScenarioProjections(baseline,
 * scenarios)"): nunca chama o Financial Model builder/Indicator Engine/
 * derivação de demonstrativo — consome exclusivamente `ScenarioProjection`s
 * já produzidos pelos simuladores de produção (Mission 180/182).
 *
 * **Prova em tempo de execução do invariante de mesmo baseline** (Seção
 * 4/5, além da garantia estrutural do tipo `ExecutiveScenarioComparison`
 * ter um único campo `baseline`): rejeita (`"mismatched-baseline"`) se
 * os cenários recebidos não compartilharem `companyId`/`period`/
 * `baseline` bit-a-bit idênticos — nunca assume que o chamador resolveu
 * o baseline corretamente, mesmo padrão de defesa em profundidade já
 * usado por `simulateOperatingCostScenario()`/`simulateCollectionPeriodScenario()`
 * (`financialModel.root.companyId !== companyId`).
 */
export function buildExecutiveScenarioComparison(
  companyId: string,
  scenarios: readonly ScenarioProjection[]
): ExecutiveScenarioComparisonOutcome {
  if (scenarios.length < 2) {
    return { outcome: "rejected", reason: "insufficient-scenarios" };
  }

  const [first, ...rest] = scenarios;
  const baselineFingerprint = JSON.stringify(first.baseline);
  const sameCompany = scenarios.every((s) => s.companyId === companyId);
  const samePeriod = rest.every(
    (s) => s.period.startDate === first.period.startDate && s.period.endDate === first.period.endDate
  );
  const sameBaseline = rest.every((s) => JSON.stringify(s.baseline) === baselineFingerprint);

  if (!sameCompany || !samePeriod || !sameBaseline) {
    return { outcome: "rejected", reason: "mismatched-baseline" };
  }

  const metrics = compareScenarioProjections(first.baseline.indicators, scenarios);

  return {
    outcome: "compared",
    comparison: {
      companyId,
      period: first.period,
      baseline: first.baseline,
      scenarios,
      metrics,
      nature: "hypothetical",
      disclaimer:
        "Esta é uma comparação entre cenários hipotéticos, não uma previsão de fato — nenhum vencedor é escolhido automaticamente.",
      limitations: SCENARIO_COMPARISON_LIMITATIONS,
    },
  };
}
