import type { ScenarioAssumption } from "@/efos/application/scenario-simulation";
import { formatIndicatorValue } from "@/lib/format-indicator";

export { formatIndicatorDelta as formatScenarioMetricDelta } from "@/lib/format-indicator";
export { classifyScenarioMetricImpact } from "@/efos/application/scenario-simulation";

/**
 * Mission 181 — First Production Scenario Lab Experience. Revisado pela
 * Mission 182 — Scenario Engine Generalization (D-092).
 *
 * Vocabulário neutro de produto para a vertical de mudança de Despesas
 * Operacionais. `ScenarioType` (`"adjust_operating_costs"`, D-092) é
 * vocabulário INTERNO do Domain — nunca exposto diretamente ao usuário
 * (Seção 5 da Mission 181): a UI usa exclusivamente "aumentar/reduzir
 * despesas operacionais", a direção neutra que a Application Layer
 * converte internamente para o sinal de `operatingExpensesDelta.amount`
 * (nunca mais para um `scenarioType` diferente por direção — Mission
 * 182 corrigiu essa distinção falsa, ver D-092: a direção já é
 * inteiramente capturada pelo sinal do valor monetário).
 */
export const OPERATING_COST_DIRECTIONS = ["increase", "decrease"] as const;
export type OperatingCostDirection = (typeof OPERATING_COST_DIRECTIONS)[number];

export const OPERATING_COST_DIRECTION_LABELS: Readonly<Record<OperatingCostDirection, string>> = {
  increase: "Aumentar despesas operacionais",
  decrease: "Reduzir despesas operacionais",
};

/** Único ponto que aplica o sinal correto ao valor monetário (sempre positivo, informado pelo usuário) conforme a direção escolhida. */
export function toSignedAmountForDirection(
  direction: OperatingCostDirection,
  magnitude: number
): number {
  return direction === "increase" ? magnitude : -magnitude;
}

/**
 * Os 8 indicadores causalmente afetados por esta vertical (Mission 180)
 * divididos por hierarquia executiva (Seção 12 da Mission 181 — nunca
 * renderizar os 8 com o mesmo peso visual). Primário: os 4 mais
 * universalmente compreendidos por um executivo (EBITDA/EBIT/margens).
 * Secundário: retorno sobre investimento/patrimônio/ativo e cobertura
 * de juros — mais especializados, `interestCoverage` frequentemente
 * `unavailable` quando a empresa não tem despesa de juros registrada.
 * O resultado completo (`ScenarioProjection.comparison`) continua
 * disponível por inteiro — esta divisão é puramente de apresentação,
 * nunca de omissão de dado.
 */
export const PRIMARY_SCENARIO_METRIC_KEYS = ["ebitda", "ebit", "operatingMargin", "netMargin"] as const;
export const SECONDARY_SCENARIO_METRIC_KEYS = ["roi", "roe", "roa", "interestCoverage"] as const;

/**
 * Mission 182 — Scenario Engine Generalization & Second Financial
 * Vertical.
 *
 * Vocabulário neutro de produto para a vertical de mudança de prazo de
 * recebimento. `ScenarioType` (`"adjust_collection_terms"`, D-092)
 * nunca exposto ao usuário — a UI usa exclusivamente "clientes demoram
 * mais/menos para pagar" (Seção 23: pergunta de negócio, nunca
 * "Modificar DSO").
 */
export const COLLECTION_PERIOD_DIRECTIONS = ["longer", "shorter"] as const;
export type CollectionPeriodDirection = (typeof COLLECTION_PERIOD_DIRECTIONS)[number];

export const COLLECTION_PERIOD_DIRECTION_LABELS: Readonly<Record<CollectionPeriodDirection, string>> = {
  longer: "Clientes demoram mais para pagar",
  shorter: "Clientes pagam mais rápido",
};

/** Único ponto que aplica o sinal correto ao número de dias (sempre positivo, informado pelo usuário) conforme a direção escolhida. */
export function toSignedDeltaDaysForDirection(
  direction: CollectionPeriodDirection,
  magnitudeDays: number
): number {
  return direction === "longer" ? magnitudeDays : -magnitudeDays;
}

/**
 * Os 3 indicadores causalmente afetados por esta vertical (Mission 182
 * — `simulateCollectionPeriodScenario.ts`, prova algébrica completa
 * no cabeçalho daquele arquivo). Diferentemente de Despesas
 * Operacionais, esta vertical afeta um conjunto deliberadamente PEQUENO
 * (Caixa/liquidez imediata é o único indicador de balanço que se move —
 * o Ativo Circulante total é preservado por construção) — nunca dividida
 * em primário/secundário porque os 3 já cabem confortavelmente numa
 * única lista.
 */
export const COLLECTION_PERIOD_SCENARIO_METRIC_KEYS = [
  "immediateLiquidity",
  "averageReceiptPeriod",
  "financialCycle",
] as const;

/**
 * Mission 183 — Executive Scenario Comparison (D-093).
 *
 * **Correção de um defeito real da Mission 182**: esta função antes se
 * chamava `scenarioMetricDeltaTone()` e classificava a tonalidade
 * apenas pelo SINAL do delta ("maior é sempre positivo") — isso estava
 * ERRADO para `averageReceiptPeriod` (Prazo Médio de Recebimento: um
 * AUMENTO é adverso, clientes demoram mais para pagar) e teria
 * classificado incorretamente esse aumento como "positivo"/verde.
 * Removida; a UI agora lê `entry.impact` diretamente de
 * `ScenarioMetricComparison` (calculado uma única vez por
 * `compareScenarioIndicator()`, `efos/application/scenario-simulation/`,
 * usando a direção canônica real de `INDICATOR_DEFINITIONS`) — nunca
 * recalculado aqui.
 */
export const SCENARIO_IMPACT_TONE_CLASSNAME: Readonly<
  Record<"favorable" | "unfavorable" | "neutral", string>
> = {
  favorable: "text-success",
  unfavorable: "text-destructive",
  neutral: "text-muted-foreground",
};

/**
 * Descrição em linguagem de negócio de uma `ScenarioAssumption` (Seção
 * 19 da Mission 183 — "no raw enums, no engine terminology"). Único
 * ponto que traduz o sinal do valor assinado (moeda ou dias) de volta
 * para a direção de produto correspondente — reaproveitado pelos dois
 * formulários de cenário único (Mission 181/182) e pela comparação
 * (Mission 183), nunca reimplementado em cada um.
 */
export function describeScenarioAssumption(assumption: ScenarioAssumption): string {
  if (assumption.kind === "operating_cost_change") {
    const amount = assumption.operatingExpensesDelta.amount;
    const direction = amount > 0 ? OPERATING_COST_DIRECTION_LABELS.increase : OPERATING_COST_DIRECTION_LABELS.decrease;
    return `${direction} em ${formatIndicatorValue(Math.abs(amount), "currency")}`;
  }

  const days = assumption.collectionPeriodDeltaDays;
  const direction = days > 0 ? COLLECTION_PERIOD_DIRECTION_LABELS.longer : COLLECTION_PERIOD_DIRECTION_LABELS.shorter;
  return `${direction} em ${Math.abs(days)} dias`;
}
