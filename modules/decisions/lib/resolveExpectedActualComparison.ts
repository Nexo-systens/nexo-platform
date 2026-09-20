import type { Decision } from "@/efos/domain";
import type { HistoricalExecution } from "@/efos/application/history";
import type { FinancialOutcomeObservation } from "@/efos/application/financial-observation";
import {
  buildExpectedActualComparison,
  type BuildExpectedActualComparisonOutcome,
  type ExpectedActualComparisonBundle,
  type ObservedFinancialTruthResolution,
} from "@/efos/application/scenario-outcome-comparison";
import { derivePeriodFromIndicators, resolveCurrentFinancialExecution } from "./selectCurrentFinancialExecution";

/**
 * Mission 185 — Expected vs Actual Decision Intelligence. Revisada pela
 * Mission 185 Closure — Observation Horizon & Temporal Eligibility.
 *
 * Ponto de orquestração entre a resolução de verdade financeira e a
 * composição pura `buildExpectedActualComparison()`
 * (`efos/application/scenario-outcome-comparison/`) — agora produzindo
 * DUAS camadas (Seção 8/16 da missão de fechamento, nunca fundidas):
 *
 * - **`live`** — O é sempre a verdade financeira canônica MAIS ATUAL
 *   (`resolveCurrentFinancialExecution()`, D-088/Mission 176 — a MESMA
 *   função já reaproveitada por `resolveScenarioBaseline()`). Uma
 *   comparação que se atualiza a cada novo período reportado, nunca
 *   uma avaliação final.
 * - **`formal`** — presente apenas quando existe uma
 *   `FinancialOutcomeObservation` já registrada para esta Decision
 *   (Mission 139, D-071 — o executivo clicou explicitamente "Calcular
 *   observação financeira"). O é ancorado à execução ESPECÍFICA
 *   referenciada por `window.observationExecutionId` — identidade por
 *   `executionId` (D-089: nunca por `Period` sozinho, nunca por
 *   `executedAt`) — localizada dentro do MESMO `history` já carregado,
 *   nunca uma segunda consulta. Se essa execução não for encontrada
 *   (ex.: histórico incompleto), `formal` fica `undefined` — nunca um
 *   valor fabricado ou aproximado.
 *
 * Pura e síncrona, dado `history`/`financialObservations` já
 * carregados pelo chamador — mesmo padrão de
 * `resolveCurrentFinancialExecution()` em si.
 *
 * **Isolamento de empresa (Seção 23)**: `resolveCurrentFinancialExecution()`
 * já filtra `history` por `companyId === decision.companyId`
 * internamente. Para `formal`, a busca por `executionId` reafirma essa
 * checagem explicitamente (defesa em profundidade — nunca confia
 * apenas em `history` já vir corretamente escopado pelo chamador).
 */
export function resolveExpectedActualComparison(
  decision: Decision,
  history: readonly HistoricalExecution[],
  financialObservations: readonly FinancialOutcomeObservation[] = []
): ExpectedActualComparisonBundle {
  const resolution = resolveCurrentFinancialExecution(decision.companyId, history);

  let liveObserved: ObservedFinancialTruthResolution;
  if (resolution.outcome === "no-history") {
    liveObserved = { outcome: "no-history" };
  } else if (resolution.outcome === "ambiguous") {
    liveObserved = { outcome: "ambiguous" };
  } else {
    const indicators = resolution.execution.snapshot.execution.indicators;
    const period = indicators ? derivePeriodFromIndicators(indicators) : undefined;
    liveObserved = indicators && period ? { outcome: "resolved", indicators, period } : { outcome: "no-history" };
  }

  const live = buildExpectedActualComparison(decision, liveObserved, "live");

  // Mais recente primeiro (`getFinancialObservationsByDecision()` já
  // ordena por `computed_at DESC`) — a observação formal mais recente
  // é a única exibida (Seção 15 da missão de fechamento: nunca uma
  // trajetória completa nesta missão, apenas a mais atual).
  const latestObservation = financialObservations[0];
  let formal: BuildExpectedActualComparisonOutcome | undefined;

  if (latestObservation) {
    const anchoredExecution = history.find(
      (execution) =>
        execution.executionId === latestObservation.window.observationExecutionId &&
        execution.companyId === decision.companyId
    );
    const indicators = anchoredExecution?.snapshot.execution.indicators;
    const period = indicators ? derivePeriodFromIndicators(indicators) : undefined;
    const formalObserved: ObservedFinancialTruthResolution =
      indicators && period ? { outcome: "resolved", indicators, period } : { outcome: "no-history" };
    const formalResult = buildExpectedActualComparison(decision, formalObserved, "formal");

    // Mission 186 — Decision Learning from Expected vs Observed. Anexa
    // a proveniência exata (`financialObservationId`/`observationExecutionId`)
    // à comparação formal comparável — só aqui `latestObservation` (a
    // `FinancialOutcomeObservation` completa) está disponível;
    // `buildExpectedActualComparison()` nunca a recebe (Seção 30 da
    // Mission 186 — nenhuma seleção de observação é reimplementada em
    // outro módulo, esta é a única atribuição).
    formal =
      formalResult.outcome === "built" && formalResult.comparison.eligibility === "comparable"
        ? {
            outcome: "built",
            comparison: {
              ...formalResult.comparison,
              observationAnchor: {
                financialObservationId: latestObservation.id,
                observationExecutionId: latestObservation.window.observationExecutionId,
              },
            },
          }
        : formalResult;
  }

  return { live, formal };
}
