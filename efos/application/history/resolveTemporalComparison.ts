import type { Period } from "@/efos/domain";
import { periodOf } from "@/efos/engines/evidence";

import { periodsEqual } from "../scenario-simulation/periodsEqual";

import { buildCanonicalPriorPeriods } from "./buildCanonicalPriorPeriods";
import { compareExecutions } from "./compareExecutions";
import type { ExecutionComparison } from "./ExecutionComparison";
import type { HistoricalExecution } from "./HistoricalExecution";

/**
 * Mission 209 — autoridade única de comparação temporal (D-134).
 *
 * Toda superfície que diz "mudou", "melhorou", "piorou" ou mostra uma
 * variação entre análises resolve AQUI qual execução comparar — Visão
 * geral, Dashboard, histórico da Análise, relatório executivo e o contexto
 * entregue à Executive AI. Nenhuma regra nova: é a semântica que a Evidence
 * temporal já usa (Missions 171/174/175R) e que o relatório executivo
 * adotou na Mission 208 (D-133), agora fora de um módulo visual.
 *
 * - **Período** de uma execução: `periodOf` dos indicadores — nunca
 *   `executedAt`, nunca a data atual.
 * - **Período anterior**: o período imediatamente anterior DISPONÍVEL —
 *   não a execução imediatamente anterior. Uma reanálise do mesmo período
 *   é uma versão, nunca "período anterior" de si mesma.
 * - **Versões**: execuções do mesmo período; a mais recente na ordem
 *   canônica do histórico (`executedAt`, depois `executionId`).
 * - **Ambiguidade**: histórico anterior sem uma verdade única defensável
 *   (reanálises divergentes, período indeterminável) → comparação
 *   ambígua, nunca uma versão escolhida por conveniência.
 *
 * Funções puras; só escolhem QUAIS execuções comparar. Os números da
 * comparação continuam vindo de `compareExecutions()` (D-045/D-046).
 */

export function executionPeriodOf(execution: HistoricalExecution): Period | undefined {
  const indicators = execution.snapshot.execution.indicators;
  return indicators ? periodOf(indicators) : undefined;
}

function endsBefore(candidate: Period, current: Period): boolean {
  return new Date(candidate.endDate).getTime() <= new Date(current.startDate).getTime();
}

export type PreviousPeriodComparison =
  | {
      readonly outcome: "resolved";
      readonly baseline: HistoricalExecution;
      readonly baselinePeriod: Period;
      readonly comparison: ExecutionComparison;
    }
  /** Nenhum período anterior analisado. */
  | { readonly outcome: "first-period" }
  /** O histórico anterior não tem uma verdade única defensável. */
  | { readonly outcome: "ambiguous" }
  /** A própria execução não tem período determinável. */
  | { readonly outcome: "unpositioned" };

export type PreviousPeriodState = PreviousPeriodComparison["outcome"];

/**
 * Compara `current` com o período anterior canônico: `buildCanonicalPriorPeriods()`
 * sobre as execuções da mesma empresa cujo período termina até o início do
 * período atual (a restrição de `restrictToPeriodsStrictlyBeforeCurrent`, no
 * runtime da Evidence temporal). Reanálises equivalentes de um período
 * colapsam; divergentes tornam a comparação ambígua. Execuções sem período
 * continuam na entrada: o colapso falha fechado com elas (não é possível
 * provar que não são o período anterior).
 */
export function resolvePreviousPeriodComparison(
  history: readonly HistoricalExecution[],
  current: HistoricalExecution
): PreviousPeriodComparison {
  const currentPeriod = executionPeriodOf(current);
  if (!currentPeriod) return { outcome: "unpositioned" };

  const candidates = history.filter((execution) => {
    if (execution.companyId !== current.companyId || execution.executionId === current.executionId) return false;
    const period = executionPeriodOf(execution);
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

/** A comparação resolvida, ou `undefined` quando não há período anterior defensável — nunca uma comparação fabricada. */
export function previousPeriodComparisonOf(
  history: readonly HistoricalExecution[],
  current: HistoricalExecution
): ExecutionComparison | undefined {
  const resolution = resolvePreviousPeriodComparison(history, current);
  return resolution.outcome === "resolved" ? resolution.comparison : undefined;
}

export type PeriodVersion =
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
 * Uma execução reduzida ao que a resolução de versão e de período mais
 * recente precisa — o índice de relatórios lê só metadados das execuções
 * (`modules/reports/lib/report-index.ts`) e usa a mesma regra por aqui.
 */
export interface PeriodPositionedExecution {
  readonly executionId: string;
  readonly companyId: string;
  readonly executedAt: string;
  readonly period?: Period;
}

function positioned(execution: HistoricalExecution): PeriodPositionedExecution {
  return {
    executionId: execution.executionId,
    companyId: execution.companyId,
    executedAt: execution.executedAt,
    period: executionPeriodOf(execution),
  };
}

/**
 * Cada análise é uma versão do seu período (D-133). Espera `history` na
 * ordem canônica (`getHistory`). Analisar de novo não altera nenhuma versão
 * anterior — só passa a existir uma mais recente.
 */
export function resolvePeriodVersion(history: readonly HistoricalExecution[], current: HistoricalExecution): PeriodVersion {
  return periodVersionAmong(history.map(positioned), positioned(current));
}

/** `resolvePeriodVersion` sobre entradas posicionadas, na ordem canônica (`compareHistoricalExecutionOrder`). */
export function periodVersionAmong(
  entries: readonly PeriodPositionedExecution[],
  current: PeriodPositionedExecution
): PeriodVersion {
  const currentPeriod = current.period;
  if (!currentPeriod) return { state: "unpositioned" };

  const samePeriod = entries.filter(
    (entry) => entry.companyId === current.companyId && entry.period !== undefined && periodsEqual(entry.period, currentPeriod)
  );
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

function laterPeriod(candidate: Period, reference: Period): boolean {
  if (candidate.startDate !== reference.startDate) return candidate.startDate > reference.startDate;
  return candidate.endDate > reference.endDate;
}

/** O período mais recente entre as entradas (início decide, fim desempata) — nunca `executedAt`. */
export function latestPeriodAmong(entries: readonly Pick<PeriodPositionedExecution, "period">[]): Period | undefined {
  let latest: Period | undefined;
  for (const { period } of entries) {
    if (period && (!latest || laterPeriod(period, latest))) latest = period;
  }
  return latest;
}

/**
 * A situação atual de uma empresa: a versão mais recente do período mais
 * recente — não a última execução. Reanalisar julho depois de agosto não
 * transforma julho na "situação atual". Execuções sem período ou sem
 * relatório não competem (não têm período a mostrar). Espera `history` na
 * ordem canônica e de uma única empresa.
 */
export function selectLatestPeriodExecution(history: readonly HistoricalExecution[]): HistoricalExecution | undefined {
  const candidates = history.filter((execution) => execution.report !== undefined && executionPeriodOf(execution) !== undefined);
  const latest = latestPeriodAmong(candidates.map(positioned));
  if (!latest) return undefined;
  return candidates.filter((execution) => periodsEqual(executionPeriodOf(execution)!, latest)).at(-1);
}
