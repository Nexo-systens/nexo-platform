import {
  buildCanonicalPriorPeriods,
  compareExecutions,
  type ExecutionComparison,
  type HistoricalExecution,
} from "@/efos/application/history";
import { periodsEqual } from "@/efos/application/scenario-simulation";
import type { Period } from "@/efos/domain";
import { periodOf } from "@/efos/engines/evidence";

/**
 * Mission 208 — período de um relatório executivo.
 *
 * Um relatório é o `ExecutiveReport` de UMA execução (D-038, imutável). O
 * período dele é o período canônico dos indicadores dessa execução
 * (`periodOf`, o mesmo que o Evidence Engine e o Scenario Lab usam) —
 * nunca a data de geração, nunca a data atual.
 */
export function reportPeriodOf(execution: HistoricalExecution): Period | undefined {
  const indicators = execution.snapshot.execution.indicators;
  return indicators ? periodOf(indicators) : undefined;
}

function endsBefore(candidate: Period, current: Period): boolean {
  return new Date(candidate.endDate).getTime() <= new Date(current.startDate).getTime();
}

export type ReportComparison =
  | {
      readonly outcome: "resolved";
      readonly baseline: HistoricalExecution;
      readonly baselinePeriod: Period;
      readonly comparison: ExecutionComparison;
    }
  /** Nenhum período anterior analisado — primeira análise de período da empresa. */
  | { readonly outcome: "first-period" }
  /** O histórico anterior não tem uma verdade única defensável (reanálises divergentes, período indeterminável). */
  | { readonly outcome: "ambiguous" }
  /** O próprio relatório não tem período determinável. */
  | { readonly outcome: "unpositioned" };

/**
 * Período de comparação do relatório: o período anterior canônico — a
 * mesma regra da Evidence temporal (Mission 174/175R):
 * `buildCanonicalPriorPeriods()` sobre as execuções da empresa cujo período
 * termina até o início do período do relatório
 * (`restrictToPeriodsStrictlyBeforeCurrent`). Reanálises equivalentes do
 * mesmo período colapsam; divergentes tornam a comparação ambígua — o
 * relatório diz isso em vez de escolher uma versão por conveniência.
 *
 * Uma reanálise do MESMO período nunca vira "período anterior" (era o que
 * comparar com a execução imediatamente anterior faria).
 */
export function selectReportComparison(
  history: readonly HistoricalExecution[],
  current: HistoricalExecution
): ReportComparison {
  const currentPeriod = reportPeriodOf(current);
  if (!currentPeriod) return { outcome: "unpositioned" };

  // Mesma empresa, nunca a própria execução. Execuções sem período
  // determinável continuam na entrada: `buildCanonicalPriorPeriods()` falha
  // fechado com elas (não dá para provar que não são o período anterior).
  const candidates = history.filter((execution) => {
    if (execution.companyId !== current.companyId || execution.executionId === current.executionId) return false;
    const period = reportPeriodOf(execution);
    return period === undefined || endsBefore(period, currentPeriod);
  });

  const canonical = buildCanonicalPriorPeriods(current.companyId, candidates);
  if (canonical === undefined) return { outcome: "ambiguous" };
  const prior = canonical.at(-1);
  if (!prior) return { outcome: "first-period" };

  const baseline = candidates.find((execution) => execution.snapshot.execution.indicators === prior.indicators);
  const baselinePeriod = periodOf(prior.indicators);
  if (!baseline || !baselinePeriod) return { outcome: "ambiguous" };

  return { outcome: "resolved", baseline, baselinePeriod, comparison: compareExecutions(baseline, current) };
}

export type ReportVersion =
  | { readonly state: "unpositioned" }
  /** Versão mais recente do período (inclusive quando é a única). */
  | { readonly state: "latest"; readonly versions: number }
  /** O mesmo período foi analisado de novo depois desta versão. */
  | {
      readonly state: "earlier";
      readonly versions: number;
      readonly latestExecutionId: string;
      readonly latestExecutedAt: string;
    };

/**
 * Cada análise produz um relatório imutável. Analisar o mesmo período de
 * novo cria OUTRA versão — esta continua existindo, sem mudar. A versão
 * mais recente é a última na ordem canônica do histórico
 * (`compareHistoricalExecutionOrder`: `executedAt`, depois `executionId`).
 */
export function resolveReportVersion(
  history: readonly HistoricalExecution[],
  current: HistoricalExecution
): ReportVersion {
  const currentPeriod = reportPeriodOf(current);
  if (!currentPeriod) return { state: "unpositioned" };

  const samePeriod = history.filter((execution) => {
    if (execution.companyId !== current.companyId) return false;
    const period = reportPeriodOf(execution);
    return period !== undefined && periodsEqual(period, currentPeriod);
  });
  const latest = samePeriod.at(-1);

  if (!latest || latest.executionId === current.executionId) {
    return { state: "latest", versions: Math.max(samePeriod.length, 1) };
  }
  return {
    state: "earlier",
    versions: samePeriod.length,
    latestExecutionId: latest.executionId,
    latestExecutedAt: latest.executedAt,
  };
}
