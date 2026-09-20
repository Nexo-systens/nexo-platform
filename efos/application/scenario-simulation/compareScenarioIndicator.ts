import type { IndicatorUnit } from "@/efos/domain";
import {
  INDICATOR_DEFINITIONS,
  type CalculatedIndicator,
  type IndicatorDirectionality,
} from "@/efos/engines/indicators";

import type { ScenarioMetricComparison } from "./ScenarioProjection";

/**
 * Mission 182 — Scenario Engine Generalization. Extraída de dentro de
 * `simulateOperatingCostScenario.ts` (Mission 180) — provada
 * genuinamente compartilhada (Seção 13) pela segunda vertical
 * (`simulateCollectionPeriodScenario.ts`), que precisa exatamente da
 * mesma comparação baseline→projetado→delta, apenas sobre uma lista
 * diferente de chaves de indicador. Nunca codifica nenhuma semântica
 * específica de uma vertical — apenas lê `CalculatedIndicator` e
 * `INDICATOR_DEFINITIONS` (`indicators.constants.ts`, canônico para
 * TODOS os 20 indicadores, nunca um segundo dicionário).
 */
export function labelForScenarioMetric(key: string): string {
  const definition = (INDICATOR_DEFINITIONS as Record<string, { name: string } | undefined>)[key];
  return definition?.name ?? key;
}

export function unitForScenarioMetric(key: string): IndicatorUnit {
  const definition = (INDICATOR_DEFINITIONS as Record<string, { unit: IndicatorUnit } | undefined>)[
    key
  ];
  if (!definition) {
    throw new Error(`Indicador desconhecido em INDICATOR_DEFINITIONS: ${key}`);
  }
  return definition.unit;
}

/**
 * Mission 183 — Executive Scenario Comparison (D-093). `undefined`
 * quando `INDICATOR_DEFINITIONS` não atribui uma direção canônica a
 * este indicador (Seção 8 — nunca adivinhada aqui, nunca um segundo
 * dicionário incompleto).
 */
export function directionalityForScenarioMetric(key: string): IndicatorDirectionality | undefined {
  return (INDICATOR_DEFINITIONS as Record<string, { directionality?: IndicatorDirectionality } | undefined>)[
    key
  ]?.directionality;
}

/**
 * Mission 183 — Executive Scenario Comparison (D-093).
 *
 * Classificação de impacto de um delta — nunca adivinha uma direção
 * quando `INDICATOR_DEFINITIONS` não atribui uma canonicamente (Seção
 * 8): `directionality` ausente sempre classifica como `"neutral"`, o
 * mesmo valor usado para `delta === 0` — "neutral" significa "nada a
 * afirmar sobre melhora/piora aqui", nunca uma terceira opção
 * arbitrária ou um palpite.
 *
 * Corrige um defeito real da Mission 182: `scenarioMetricDeltaTone()`
 * (`modules/scenarios/lib/scenario-language.ts`, removida nesta
 * missão) classificava a tonalidade só pelo SINAL do delta —
 * classificando incorretamente um AUMENTO de Prazo Médio de
 * Recebimento (adverso — clientes demoram mais para pagar, `delta >
 * 0`) como "positivo"/verde, porque nunca consultava a direção
 * canônica real (`lower_is_favorable` para este indicador).
 */
export function classifyScenarioMetricImpact(
  delta: number,
  directionality: IndicatorDirectionality | undefined
): "favorable" | "unfavorable" | "neutral" {
  if (delta === 0) return "neutral";
  if (!directionality) return "neutral";
  if (directionality === "higher_is_favorable") return delta > 0 ? "favorable" : "unfavorable";
  return delta < 0 ? "favorable" : "unfavorable";
}

/**
 * `delta = projectedValue - baselineValue` SEMPRE (Seção 14/26 da
 * Mission 180) — nunca variação percentual relativa. `status:
 * "unavailable"` preserva a disciplina D-052 do Indicators Engine: um
 * indicador cujo baseline OU projeção seja `unavailable` nunca fabrica
 * um delta. `impact` calculado UMA ÚNICA VEZ aqui (Mission 183) —
 * reaproveitado por toda apresentação de cenário único e por
 * `buildExecutiveScenarioComparison()`, nunca recalculado em nenhum dos
 * dois.
 */
export function compareScenarioIndicator(
  key: string,
  baseline: Readonly<Record<string, CalculatedIndicator>>,
  projected: Readonly<Record<string, CalculatedIndicator>>
): ScenarioMetricComparison {
  const label = labelForScenarioMetric(key);
  const unit = unitForScenarioMetric(key);
  const baselineResult = baseline[key]?.result;
  const projectedResult = projected[key]?.result;

  const baselineAvailable = baselineResult?.status === "available";
  const projectedAvailable = projectedResult?.status === "available";

  if (baselineAvailable && projectedAvailable) {
    const delta = projectedResult.value - baselineResult.value;
    return {
      metricKey: key,
      label,
      unit,
      status: "compared",
      baselineValue: baselineResult.value,
      projectedValue: projectedResult.value,
      delta,
      impact: classifyScenarioMetricImpact(delta, directionalityForScenarioMetric(key)),
    };
  }

  const reason =
    !baselineAvailable && !projectedAvailable
      ? "both-unavailable"
      : !baselineAvailable
        ? "baseline-unavailable"
        : "projected-unavailable";

  return { metricKey: key, label, unit, status: "unavailable", reason };
}
