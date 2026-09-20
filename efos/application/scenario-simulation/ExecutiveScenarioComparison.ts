import type { IndicatorUnit, Period } from "@/efos/domain";
import type { CalculatedIndicator, FinancialStatementInputs } from "@/efos/engines/indicators";

import type { ScenarioMetricComparison, ScenarioProjection } from "./ScenarioProjection";

/**
 * Mission 183 — Executive Scenario Comparison.
 *
 * Responde "como as consequências financeiras de decisões alternativas
 * se comparam?" — nunca "qual decisão devo tomar?" (Seção 3). Nunca um
 * motor de otimização, nunca uma pontuação/peso arbitrário (Seção 9),
 * nunca um vencedor automático (Seção 10).
 *
 * Deliberadamente um contrato SEPARADO de `ExecutionComparison`/
 * `MetricComparison` (`efos/application/history/`, Mission 085/086,
 * D-045/D-046) — aquele compara duas execuções REAIS ao longo do tempo
 * (cronologia histórica); este compara N projeções HIPOTÉTICAS contra
 * UM único baseline real compartilhado (simulação, nunca cronologia).
 * Conceitos relacionados, nunca fundidos.
 *
 * **Invariante do mesmo baseline (Seção 4/5)**: existe exatamente UM
 * campo `baseline`/`period` neste contrato — nunca um por cenário.
 * Estruturalmente impossível representar dois baselines diferentes
 * aqui; `buildExecutiveScenarioComparison()` também prova isso em tempo
 * de execução (falha fechado se os `ScenarioProjection`s recebidos não
 * compartilharem o mesmo baseline/período), nunca confiando apenas na
 * forma do tipo.
 */

/**
 * Uma linha da comparação — um indicador, sua leitura em CADA cenário
 * (`perScenario`, mesma ordem/tamanho de `ExecutiveScenarioComparison.scenarios`,
 * cada entrada é o MESMO `ScenarioMetricComparison` que
 * `ScenarioProjection.comparison` já usa — `metricKey`/`label`/`unit`
 * repetidos por entrada, nunca uma segunda forma de tipo apenas para
 * evitar essa repetição). Presente apenas quando pelo menos UM cenário
 * afeta causalmente este indicador (união dos `comparison` de cada
 * `ScenarioProjection`) — um cenário que NÃO afeta este indicador ainda
 * aparece aqui, com `delta: 0`/`impact: "neutral"` (prova de fronteira
 * causal, Seção 18 — nunca omitido para parecer mais abrangente do que
 * é).
 */
export interface ScenarioComparisonMetric {
  readonly metricKey: string;
  readonly label: string;
  readonly unit: IndicatorUnit;
  readonly perScenario: readonly ScenarioMetricComparison[];
}

export interface ExecutiveScenarioComparison {
  readonly companyId: string;
  readonly period: Period;
  readonly baseline: {
    readonly inputs: FinancialStatementInputs;
    readonly indicators: Readonly<Record<string, CalculatedIndicator>>;
  };
  readonly scenarios: readonly ScenarioProjection[];
  readonly metrics: readonly ScenarioComparisonMetric[];
  readonly nature: "hypothetical";
  readonly disclaimer: string;
  readonly limitations: readonly string[];
}

export type ExecutiveScenarioComparisonOutcome =
  | { readonly outcome: "compared"; readonly comparison: ExecutiveScenarioComparison }
  | { readonly outcome: "rejected"; readonly reason: "insufficient-scenarios" | "mismatched-baseline" };
