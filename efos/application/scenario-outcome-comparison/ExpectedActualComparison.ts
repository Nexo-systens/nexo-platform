import type { IndicatorsAggregate, IndicatorUnit, Period, ScenarioType } from "@/efos/domain";

/**
 * Mission 185 — Expected vs Actual Decision Intelligence. Revisada pela
 * Mission 185 Closure — Observation Horizon & Temporal Eligibility
 * (D-098, corrige/complementa D-097).
 *
 * Responde "depois de uma decisão executiva baseada num cenário
 * esperado, o que foi de fato observado depois?" — nunca "a decisão
 * causou o resultado observado" (Seção 3 da missão: Expected/Observed/
 * Attributed são três perguntas epistemicamente distintas; esta missão
 * implementa apenas Expected ↔ Observed).
 *
 * **Correção de fechamento — o que "Expected" de fato significa
 * (Seção 4/12 da missão de fechamento).** O Scenario Engine (D-091,
 * Mission 180) é deliberadamente de PERÍODO ÚNICO — "e se esta mudança
 * já tivesse valido durante o MESMO período da verdade financeira
 * atual", nunca uma projeção multi-período/horizonte futuro. Isso
 * significa que `expectedValue` (E) NUNCA é uma previsão para um
 * período futuro específico (P4, P5...) — é a META/ESTADO-ALVO
 * MODELADO sob a hipótese confirmada, assumindo-a sustentada. Comparar
 * E contra o estado observado de QUALQUER período posterior é
 * legítimo — mas apenas como "a que distância estamos da meta agora",
 * NUNCA como "a decisão acertou ou errou a previsão do período X"
 * (esse segundo enquadramento seria inventar uma previsão que o
 * Scenario Engine nunca fez).
 *
 * **`basis` (novo, Seção 8/16 da missão de fechamento) — duas camadas
 * epistemicamente distintas, nunca fundidas:**
 * - `"live"` — O (observado) é sempre a verdade financeira canônica
 *   MAIS ATUAL (`resolveCurrentFinancialExecution()`, D-088/Mission
 *   176) — uma comparação que se atualiza a cada novo período
 *   reportado (P4 → P5 → P6...), nunca uma avaliação final. Sempre
 *   disponível assim que elegível.
 * - `"formal"` — O é ancorado à execução ESPECÍFICA que o executivo
 *   escolheu explicitamente ao clicar "Calcular observação financeira"
 *   (`FinancialOutcomeObservation.window.observationExecutionId`,
 *   Mission 139, D-071) — identificada por `executionId` (D-089: nunca
 *   por `Period` sozinho), congelada no momento daquele clique, nunca
 *   substituída silenciosamente por um período mais novo depois.
 *   Presente apenas quando essa observação formal existe E sua
 *   execução ainda é localizável no histórico.
 *
 * **B → E → O (Seção 16/17)**: `baselineValue` (B, a verdade financeira
 * no momento da decisão, já congelada dentro de `ScenarioDecisionContext`,
 * D-094/D-095 — nunca reconstruída do zero), `expectedValue` (E, a
 * meta modelada do cenário confirmado — nunca uma previsão de período),
 * `observedValue` (O, cujo significado exato depende de `basis`, acima).
 * `expectedChange = E - B`, `observedChange = O - B`,
 * `expectationGap = O - E` — três perguntas diferentes, nunca
 * colapsadas numa só (Seção 16), e `expectationGap` é sempre uma
 * DISTÂNCIA ATUAL (`basis: "live"`) ou uma distância NA AVALIAÇÃO
 * FORMAL (`basis: "formal"`) — nunca "erro de previsão" (Seção 17).
 *
 * `nature: "observational"` (nunca `"causal"`) é reafirmado aqui pelo
 * mesmo princípio de `ScenarioProjection.nature: "hypothetical"`
 * (Mission 180) e `FinancialCorrelationClassification` (Mission 139,
 * D-071) — um marcador estrutural permanente, nunca uma classificação
 * que qualquer código poderia acidentalmente promover a causalidade.
 *
 * **`observationAnchor` (Mission 186 — Decision Learning from Expected
 * vs Observed).** Presente apenas quando `basis === "formal"` e
 * `eligibility === "comparable"`. Identifica exatamente qual
 * `FinancialOutcomeObservation` (`financialObservationId`) e qual
 * execução financeira específica (`observationExecutionId`, D-089)
 * fundamentaram esta camada `formal` — populado unicamente por
 * `resolveExpectedActualComparison()` (o único lugar que já conhece
 * `latestObservation`, a `FinancialOutcomeObservation` completa;
 * `buildExpectedActualComparison()` em si só recebe `indicators`/
 * `period` já resolvidos, nunca o registro de observação inteiro).
 * Necessário para que o Learning Loop (Mission 186) preserve a
 * proveniência exata de um aprendizado derivado sem precisar
 * reimplementar "qual observação é a formal mais recente" — a mesma
 * seleção que `resolveExpectedActualComparison()` já faz (Seção 30 da
 * Mission 186: "must NOT reimplement ... observation selection").
 */
export const EXPECTED_ACTUAL_BASES = ["live", "formal"] as const;
export type ExpectedActualBasis = (typeof EXPECTED_ACTUAL_BASES)[number];
export const EXPECTED_ACTUAL_ELIGIBILITY = [
  "comparable",
  "awaiting-observation",
  "insufficient-data",
  "ambiguous-truth",
] as const;
export type ExpectedActualEligibility = (typeof EXPECTED_ACTUAL_ELIGIBILITY)[number];

/**
 * Consistência de DIREÇÃO (Seção 19) — compara `observedChange` (O-B)
 * contra `expectedChange` (E-B), ambos classificados pela mesma
 * direcionalidade canônica (D-093). Responde "o indicador se moveu na
 * mesma direção favorável/desfavorável que se esperava?" — nunca
 * "a decisão funcionou".
 */
export const EXPECTED_ACTUAL_DIRECTION_CONSISTENCIES = [
  "consistent-direction",
  "opposite-direction",
  "neutral",
] as const;
export type ExpectedActualDirectionConsistency = (typeof EXPECTED_ACTUAL_DIRECTION_CONSISTENCIES)[number];

/**
 * Alinhamento de MAGNITUDE (Seção 19) — compara `observedValue`
 * diretamente contra `expectedValue` (`expectationGap`), nunca contra
 * o baseline. Pergunta DIFERENTE da anterior (Seção 16): "o resultado
 * observado foi melhor ou pior do que o que se projetava?" — ainda
 * assim nunca "a decisão foi bem-sucedida".
 */
export const EXPECTED_ACTUAL_ALIGNMENTS = [
  "better-than-expected",
  "worse-than-expected",
  "as-expected",
  "neutral",
] as const;
export type ExpectedActualAlignment = (typeof EXPECTED_ACTUAL_ALIGNMENTS)[number];

export type ExpectedActualMetricComparison =
  | {
      readonly metricKey: string;
      readonly label: string;
      readonly unit: IndicatorUnit;
      readonly status: "compared";
      readonly baselineValue: number;
      readonly expectedValue: number;
      readonly observedValue: number;
      readonly expectedChange: number;
      readonly observedChange: number;
      readonly expectationGap: number;
      readonly directionConsistency: ExpectedActualDirectionConsistency;
      readonly expectationAlignment: ExpectedActualAlignment;
    }
  | {
      readonly metricKey: string;
      readonly label: string;
      readonly unit: IndicatorUnit;
      readonly status: "unavailable";
      /**
       * `"expected-unavailable"` — a própria simulação original já não
       * conseguia projetar este indicador (D-052, herdado do
       * `ScenarioDecisionContext`). `"observed-unavailable"` — a
       * simulação original tinha um valor, mas a verdade financeira
       * observada posteriormente não o calcula (ex.: sem despesa de
       * juros no período observado). Nunca confundidos — motivos
       * estruturalmente diferentes.
       */
      readonly reason: "expected-unavailable" | "observed-unavailable";
    };

export interface ExpectedActualComparison {
  readonly decisionId: string;
  readonly companyId: string;
  readonly scenarioType: ScenarioType;
  /** Ver comentário do módulo — `"live"` (estado atual, sempre atualizado) ou `"formal"` (ancorado a uma observação financeira explicitamente registrada). */
  readonly basis: ExpectedActualBasis;
  readonly baselinePeriod: Period;
  /** Presente apenas quando `eligibility === "comparable"`. */
  readonly observedPeriod?: Period;
  readonly eligibility: ExpectedActualEligibility;
  readonly reason: string;
  readonly metrics: readonly ExpectedActualMetricComparison[];
  readonly nature: "observational";
  readonly disclaimer: string;
  readonly limitations: readonly string[];
  /** Ver comentário do módulo acima (Mission 186) — presente apenas quando `basis === "formal"` e `eligibility === "comparable"`. */
  readonly observationAnchor?: { readonly financialObservationId: string; readonly observationExecutionId: string };
}

export type BuildExpectedActualComparisonOutcome =
  | { readonly outcome: "not-scenario-backed" }
  | { readonly outcome: "built"; readonly comparison: ExpectedActualComparison };

/**
 * Mission 185 Closure — as duas camadas devolvidas juntas pelo
 * orquestrador (`modules/decisions/lib/resolveExpectedActualComparison.ts`).
 * `formal` é sempre `undefined` quando nenhuma `FinancialOutcomeObservation`
 * existe ainda para esta Decision — nunca um valor fabricado só para
 * preencher o campo.
 */
export interface ExpectedActualComparisonBundle {
  readonly live: BuildExpectedActualComparisonOutcome;
  readonly formal?: BuildExpectedActualComparisonOutcome;
}

/**
 * Contrato mínimo que o CHAMADOR (`modules/decisions/lib/resolveExpectedActualComparison.ts`)
 * deve fornecer, já traduzido a partir de `resolveCurrentFinancialExecution()`
 * (Mission 176 Closure/Final Closure) — esta camada Application nunca
 * importa de `modules/` (REGRA 2 análoga: Application não depende de
 * Experience/Platform), mesma fronteira já estabelecida entre
 * `efos/application/scenario-simulation/` e
 * `modules/scenarios/actions/scenario-simulation.actions.ts` (Mission 180).
 */
export type ObservedFinancialTruthResolution =
  | { readonly outcome: "resolved"; readonly indicators: IndicatorsAggregate; readonly period: Period }
  | { readonly outcome: "ambiguous" }
  | { readonly outcome: "no-history" };
