import type { FinancialModelAggregate, Period } from "@/efos/domain";
import {
  simulateCollectionPeriodScenario,
  simulateOperatingCostScenario,
  type ScenarioProjection,
} from "@/efos/application/scenario-simulation";

/**
 * Mission 182/183 (dispatch original) — movido de
 * `modules/scenarios/actions/scenario-simulation.actions.ts` para cá
 * na Mission 184 (Scenario-to-Decision Governance Bridge).
 *
 * **Por que a mudança de arquivo**: um módulo `"use server"` exige que
 * TODO export de nível superior seja uma função assíncrona (restrição
 * de build do Next.js — Server Actions) — `runSingleScenario()` sempre
 * foi puro e síncrono (nenhum I/O, nenhuma chamada a `createClient()`),
 * e a Mission 184 precisa reaproveitá-lo de um SEGUNDO arquivo de ação
 * (`modules/scenarios/actions/scenario-decision.actions.ts`), o que
 * exigiria exportá-lo do arquivo `"use server"` original — quebrando
 * essa restrição. A correção correta nunca é "tornar `runSingleScenario`
 * assíncrono artificialmente" (introduziria uma `Promise` sem
 * nenhum I/O real por trás), e sim mover a função pura para fora do
 * limite `"use server"`, onde ela sempre pertenceu por natureza —
 * `scenario-simulation.actions.ts` e `scenario-decision.actions.ts`
 * agora importam a MESMA função pura daqui, nunca duas implementações
 * de despacho.
 *
 * Vive em `modules/scenarios/lib/` (nunca em `efos/application/`)
 * porque `OPERATING_COST_REJECTION_MESSAGES`/
 * `COLLECTION_PERIOD_REJECTION_MESSAGES` são texto de produto em
 * PT-BR — a mesma fronteira já estabelecida por
 * `modules/scenarios/lib/scenario-language.ts`.
 */
export type ScenarioRequest =
  | {
      readonly kind: "operating_cost_change";
      readonly operatingExpensesDeltaAmount: number;
      readonly operatingExpensesDeltaCurrency: string;
    }
  | {
      readonly kind: "collection_period_change";
      readonly collectionPeriodDeltaDays: number;
    };

const OPERATING_COST_REJECTION_MESSAGES = {
  "company-mismatch": "A execução resolvida não pertence a esta empresa.",
  "non-finite-amount": "O valor informado para a mudança de despesa operacional é inválido.",
  "zero-amount": "Informe um valor diferente de zero para simular uma mudança.",
  "would-make-operating-expenses-negative":
    "A redução informada excede o total atual de despesas operacionais.",
} as const;

const COLLECTION_PERIOD_REJECTION_MESSAGES = {
  "company-mismatch": "A execução resolvida não pertence a esta empresa.",
  "baseline-collection-period-unavailable":
    "Não é possível determinar o prazo médio de recebimento atual desta empresa (Receita não disponível na verdade financeira atual) — a simulação não pode partir de um baseline indefinido.",
  "non-finite-delta": "O valor informado para a mudança de prazo de recebimento é inválido.",
  "zero-delta": "Informe um valor diferente de zero para simular uma mudança.",
  "would-make-collection-period-negative": "A redução informada excede o prazo médio de recebimento atual.",
  "would-make-cash-negative":
    "O aumento de prazo informado exigiria mais caixa do que a empresa atualmente possui.",
} as const;

export type SingleScenarioOutcome =
  | { readonly outcome: "simulated"; readonly projection: ScenarioProjection }
  | { readonly outcome: "rejected"; readonly error: string };

/**
 * Único ponto que despacha uma `ScenarioRequest` para o simulador puro
 * correspondente — reaproveitado por `simulateScenarioAction()`,
 * `compareScenariosAction()` (uma/duas chamadas, MESMO
 * `financialModel`/`period`) e `createScenarioDecisionAction()`
 * (Mission 184, recomputação server-side no momento de formalizar uma
 * Decision) — nunca duas implementações de despacho.
 */
export function runSingleScenario(
  companyId: string,
  financialModel: FinancialModelAggregate,
  period: Period,
  request: ScenarioRequest
): SingleScenarioOutcome {
  if (request.kind === "operating_cost_change") {
    const outcome = simulateOperatingCostScenario(companyId, financialModel, period, {
      kind: "operating_cost_change",
      scenarioType: "adjust_operating_costs",
      operatingExpensesDelta: {
        amount: request.operatingExpensesDeltaAmount,
        currency: request.operatingExpensesDeltaCurrency,
      },
    });

    if (outcome.outcome === "rejected") {
      return { outcome: "rejected", error: OPERATING_COST_REJECTION_MESSAGES[outcome.reason] };
    }
    return { outcome: "simulated", projection: outcome.projection };
  }

  const outcome = simulateCollectionPeriodScenario(companyId, financialModel, period, {
    kind: "collection_period_change",
    scenarioType: "adjust_collection_terms",
    collectionPeriodDeltaDays: request.collectionPeriodDeltaDays,
  });

  if (outcome.outcome === "rejected") {
    return { outcome: "rejected", error: COLLECTION_PERIOD_REJECTION_MESSAGES[outcome.reason] };
  }
  return { outcome: "simulated", projection: outcome.projection };
}
