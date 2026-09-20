import type { CollectionPeriodChangeAssumption, OperatingCostChangeAssumption } from "@/efos/application/scenario-simulation";
import type { ScenarioRequest } from "@/modules/scenarios/actions/scenario-simulation.actions";

/**
 * Mission 189 — Governed Executive Chat Actions.
 *
 * Converte um `OperatingCostChangeAssumption`/`CollectionPeriodChangeAssumption`
 * (Application Layer, `efos/application/scenario-simulation`, D-091/D-092)
 * já validado estruturalmente por `resolveExecutiveChatActionProposal()`
 * para o `ScenarioRequest` que `simulateScenarioAction()` (Mission 180/182)
 * já aceita — mapeamento 1:1, nunca um segundo tipo de Scenario, nunca
 * uma nova regra de negócio (Seção 17: "Reuse D-092 contracts"). Vive em
 * `modules/executive-chat/` (Platform), nunca em `efos/application/`,
 * porque `ScenarioRequest` é ele mesmo um tipo de Platform
 * (`modules/scenarios/actions/`) — `efos/application/executive-chat/`
 * nunca pode importar de `modules/` (REGRA 2).
 *
 * Nunca resolve baseline financeiro, nunca chama a Server Action —
 * apenas remodela o dado; `simulateScenarioAction()` continua sendo o
 * único ponto que resolve `resolveCurrentFinancialExecution()` e aplica
 * a validação semântica completa (Seção 43 — a verdade financeira é
 * sempre resolvida DE NOVO no momento da confirmação, nunca herdada do
 * momento em que o Chat propôs a ação).
 */
export function toScenarioRequest(
  assumption: OperatingCostChangeAssumption | CollectionPeriodChangeAssumption
): ScenarioRequest {
  if (assumption.kind === "operating_cost_change") {
    return {
      kind: "operating_cost_change",
      operatingExpensesDeltaAmount: assumption.operatingExpensesDelta.amount,
      operatingExpensesDeltaCurrency: assumption.operatingExpensesDelta.currency,
    };
  }

  return {
    kind: "collection_period_change",
    collectionPeriodDeltaDays: assumption.collectionPeriodDeltaDays,
  };
}
