import type { IndicatorUnit, Period, ScenarioType } from "@/efos/domain";
import type {
  CalculatedIndicator,
  FinancialStatementInputs,
} from "@/efos/engines/indicators";

import type { ScenarioAssumption } from "./ScenarioAssumption";

/**
 * Mission 180 — Scenario Intelligence Foundation & First Real
 * Simulation.
 *
 * Comparação de UM indicador causalmente afetado pela hipótese (Seção
 * 14 — "Only compare metrics causally affected or defensibly
 * recalculated by the scenario"). `delta = projectedValue -
 * baselineValue` SEMPRE — nunca `(projected-baseline)/baseline*100`.
 * Para `unit === "percentage"` (ex.: Margem Operacional já em escala
 * 0-100, `indicators.calculator.ts`), isso significa que `delta` é
 * expresso em PONTOS PERCENTUAIS, nunca em variação percentual relativa
 * (Seção 26) — ex.: margem 20%→15% produz `delta: -5` (leia-se "-5
 * pontos percentuais"), nunca `-25` (que seria a variação relativa).
 * Para `unit` "currency"/"ratio"/"days", `delta` é a diferença simples
 * na própria unidade do indicador. `unit` vem de
 * `INDICATOR_DEFINITIONS` (`indicators.constants.ts`) — nunca um
 * segundo dicionário de unidades.
 *
 * `status: "unavailable"` preserva a mesma disciplina D-052 do
 * Indicators Engine — um indicador cujo baseline OU projeção seja
 * `unavailable` (ex.: Cobertura de Juros sem `interestExpense`) nunca
 * fabrica um delta.
 *
 * **`impact` (Mission 183 — Executive Scenario Comparison, D-093)**:
 * calculado UMA ÚNICA VEZ aqui, por `compareScenarioIndicator()` —
 * nunca recomputado separadamente na UI nem na comparação entre
 * cenários (`buildExecutiveScenarioComparison.ts`), ambos apenas leem
 * este campo. Corrige um defeito real: `scenarioMetricDeltaTone()`
 * (Mission 182, `modules/scenarios/lib/scenario-language.ts`, removida
 * nesta missão) classificava a tonalidade só pelo SINAL do delta,
 * classificando incorretamente um aumento de Prazo Médio de
 * Recebimento (`averageReceiptPeriod`, adverso — clientes demoram mais
 * para pagar) como "positivo"/verde. `impact` usa a direção canônica de
 * `INDICATOR_DEFINITIONS` (D-093) quando existe; `"neutral"` cobre
 * tanto `delta === 0` quanto "direção desconhecida" (nunca adivinhada).
 */
export type ScenarioMetricComparison =
  | {
      readonly metricKey: string;
      readonly label: string;
      readonly unit: IndicatorUnit;
      readonly status: "compared";
      readonly baselineValue: number;
      readonly projectedValue: number;
      readonly delta: number;
      readonly impact: "favorable" | "unfavorable" | "neutral";
    }
  | {
      readonly metricKey: string;
      readonly label: string;
      readonly unit: IndicatorUnit;
      readonly status: "unavailable";
      readonly reason: "baseline-unavailable" | "projected-unavailable" | "both-unavailable";
    };

/**
 * Resultado completo e determinístico de uma simulação (Seção 13).
 * Nunca estende `DomainEntity` — não carrega `id`/`audit` (Seção 18:
 * sem persistência nesta missão; Seção 24: "A Scenario is hypothetical,
 * not an execution" — não há identidade a preservar porque não há
 * nada, ainda, para identificar de novo mais tarde).
 *
 * `period` é SEMPRE o mesmo período da execução base (Seção 25): esta
 * vertical é deliberadamente de período único — "e se esta mudança já
 * tivesse valido durante o mesmo período da verdade financeira atual"
 * — nunca uma projeção multi-período/horizonte futuro. Declarado aqui
 * explicitamente em vez de omitido, para nunca ser confundido com uma
 * ausência acidental de horizonte.
 *
 * `baseline`/`projected` carregam os `FinancialStatementInputs`
 * completos (não apenas os campos afetados) para que qualquer consumo
 * futuro possa auditar o restante do modelo permaneceu idêntico
 * (prova de imutabilidade, Seção 11) sem precisar re-executar nada.
 *
 * **Mission 182**: `assumption: ScenarioAssumption` (união discriminada
 * por `kind`) — antes `OperatingCostChangeAssumption` sozinho. Esta foi
 * a ÚNICA mudança que `ScenarioProjection` precisou para representar
 * genuinamente as duas verticais (Seção 13/28) — todo o resto do
 * contrato (`baseline`/`projected`/`comparison`/`nature`/`disclaimer`/
 * `limitations`) já era suficientemente genérico (nunca estreitado a
 * Despesas Operacionais especificamente), prova de que a Mission 180
 * generalizou corretamente da primeira vez, sem necessidade de reescrita.
 */
export interface ScenarioProjection {
  readonly companyId: string;
  readonly scenarioType: ScenarioType;
  readonly period: Period;
  readonly assumption: ScenarioAssumption;
  readonly baseline: {
    readonly inputs: FinancialStatementInputs;
    readonly indicators: Readonly<Record<string, CalculatedIndicator>>;
  };
  readonly projected: {
    readonly inputs: FinancialStatementInputs;
    readonly indicators: Readonly<Record<string, CalculatedIndicator>>;
  };
  readonly comparison: readonly ScenarioMetricComparison[];
  /**
   * Marcador permanente e explícito de natureza hipotética (Seção 15) —
   * nunca "forecast"/"previsão" (Product Vision: "Não entregamos
   * previsões. Entregamos cenários."). Único valor possível — não é uma
   * classificação, é uma declaração fixa que qualquer consumidor futuro
   * (UI, Executive AI) pode inspecionar sem ambiguidade.
   */
  readonly nature: "hypothetical";
  readonly disclaimer: string;
  readonly limitations: readonly string[];
}

/**
 * Mission 182 (Seção 14): cada vertical mantém seu PRÓPRIO tipo de
 * resultado, com seu PRÓPRIO conjunto exato de motivos de rejeição —
 * nunca uma união combinada de motivos de ambas as verticais, que
 * tornaria o tipo de cada simulador impreciso (permitindo, por
 * exemplo, que `simulateOperatingCostScenario()` "pudesse" devolver
 * `"would-make-cash-negative"`, um motivo que nunca lhe pertence). O
 * único formato genuinamente compartilhado (Seção 13) é o caso de
 * sucesso, `{outcome: "simulated", projection: ScenarioProjection}` —
 * idêntico entre as duas verticais porque `ScenarioProjection` já é
 * suficientemente genérico (união discriminada em `assumption`).
 * `"company-mismatch"` aparece em ambos os conjuntos de motivos por
 * coincidência semântica genuína (a mesma defesa em profundidade se
 * aplica a qualquer vertical), nunca por uma união de tipos.
 */
export type OperatingCostScenarioSimulationOutcome =
  | { readonly outcome: "simulated"; readonly projection: ScenarioProjection }
  | {
      readonly outcome: "rejected";
      readonly reason:
        | "company-mismatch"
        | "non-finite-amount"
        | "zero-amount"
        | "would-make-operating-expenses-negative";
    };

export type CollectionPeriodScenarioSimulationOutcome =
  | { readonly outcome: "simulated"; readonly projection: ScenarioProjection }
  | {
      readonly outcome: "rejected";
      readonly reason:
        | "company-mismatch"
        | "baseline-collection-period-unavailable"
        | "non-finite-delta"
        | "zero-delta"
        | "would-make-collection-period-negative"
        | "would-make-cash-negative";
    };
