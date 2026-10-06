import type { Period } from "@/efos/domain";
import { periodPrecedes, type PeriodPositionedExecution } from "@/efos/application/history";

import { periodsEqual } from "../scenario-simulation/periodsEqual";

import type { FinancialOutcomeObservation } from "./FinancialOutcomeObservation";

/**
 * Mission 211 — Outcome Temporal Integrity (D-136).
 *
 * Um resultado financeiro só avalia uma decisão quando é informação
 * POSTERIOR à verdade financeira em que a decisão se baseou. "Posterior" é a
 * precedência canônica do EFOS (`periodPrecedes`, D-090/D-134): o período da
 * base termina até o início do período observado. Nunca `executedAt`,
 * `computedAt`, a data atual ou a ordem de gravação.
 *
 * - **Mesmo período** (reanálise, versão): nunca resultado.
 * - **Período anterior ou sobreposto**: nunca resultado.
 * - **Lacuna** (agosto → outubro sem setembro): continua posterior —
 *   nenhuma exigência de continuidade.
 * - **Período indeterminável**: nunca resultado (falha fechada).
 */
export type ObservationTiming = "posterior" | "same-period" | "not-after-base" | "undetermined";

export function classifyObservationTiming(basePeriod: Period | undefined, observedPeriod: Period | undefined): ObservationTiming {
  if (!basePeriod || !observedPeriod) return "undetermined";
  if (periodsEqual(basePeriod, observedPeriod)) return "same-period";
  return periodPrecedes(basePeriod, observedPeriod) ? "posterior" : "not-after-base";
}

/**
 * Uma observação gravada guarda só os ids das execuções (a linha não tem
 * período). Os períodos vêm das próprias execuções, localizadas por id e
 * sempre na MESMA empresa da observação — nunca por `Period`/`executedAt`
 * soltos (D-089). Devolve a observação com os períodos preenchidos quando
 * ela é posterior à base; `undefined` em qualquer outro caso.
 */
export function asPosteriorObservation(
  observation: FinancialOutcomeObservation,
  executions: readonly PeriodPositionedExecution[]
): FinancialOutcomeObservation | undefined {
  const find = (executionId: string) =>
    executions.find((execution) => execution.executionId === executionId && execution.companyId === observation.companyId);
  const base = find(observation.window.baselineExecutionId);
  const observed = find(observation.window.observationExecutionId);
  if (classifyObservationTiming(base?.period, observed?.period) !== "posterior") return undefined;
  return {
    ...observation,
    window: { ...observation.window, baselinePeriod: base?.period, observationPeriod: observed?.period },
  };
}

/**
 * A única porta de leitura de observações financeiras para resultado:
 * mantém só as posteriores à base, com períodos preenchidos. Registros
 * imutáveis anteriores à Mission 211 que não passem continuam no banco, mas
 * nunca chegam à Central de Decisões, ao relatório, à reconciliação ou ao
 * aprendizado como "resultado".
 */
export function keepPosteriorObservations(
  observations: readonly FinancialOutcomeObservation[],
  executions: readonly PeriodPositionedExecution[]
): FinancialOutcomeObservation[] {
  return observations.flatMap((observation) => {
    const posterior = asPosteriorObservation(observation, executions);
    return posterior ? [posterior] : [];
  });
}
