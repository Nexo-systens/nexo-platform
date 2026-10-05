import type { FinancialModelAggregate, Period } from "@/efos/domain";
import type { HistoricalExecution } from "@/efos/application/history";
import {
  derivePeriodFromIndicators,
  hasCompleteFinancialTruth,
  resolveCurrentFinancialExecution,
} from "@/modules/decisions/lib/selectCurrentFinancialExecution";

import { computeScenarioBaselineIdentity, type ScenarioBaselineIdentity } from "./scenarioBaselineIdentity";

export type ScenarioBaselineResolution =
  | {
      readonly outcome: "ready";
      readonly financialModel: FinancialModelAggregate;
      readonly period: Period;
      /** Mission 184 Closure — computada uma única vez junto da resolução, nunca uma segunda leitura do `FinancialModel`. */
      readonly identity: ScenarioBaselineIdentity;
    }
  | { readonly outcome: "rejected"; readonly error: string };

/**
 * Baseline canônico de cenário a partir do histórico de execuções — a parte
 * pura de `resolveScenarioBaseline()` (`scenario-simulation.actions.ts`),
 * extraída na Mission 210 (D-135) sem mudar o comportamento: um módulo
 * `"use server"` só exporta funções assíncronas, e esta resolução precisa
 * ser a MESMA em três pontos — simulação, formalização da decisão e a
 * âncora financeira de cada resposta do Executive Chat. Assim a âncora de
 * uma resposta é, por construção, a identidade do baseline que uma
 * simulação feita naquele instante usaria.
 *
 * `resolveCurrentFinancialExecution()` (D-088/D-089/D-090) continua sendo a
 * única autoridade sobre a verdade financeira atual: ausente, ambígua ou
 * incompleta rejeita, nunca escolhe.
 */
export function resolveScenarioBaselineFromHistory(
  companyId: string,
  history: readonly HistoricalExecution[]
): ScenarioBaselineResolution {
  const resolution = resolveCurrentFinancialExecution(companyId, history);

  if (resolution.outcome === "no-history") {
    return {
      outcome: "rejected",
      error: "Nenhuma análise executada ainda para esta empresa — execute a análise antes de simular um cenário.",
    };
  }

  if (resolution.outcome === "ambiguous") {
    const detail =
      resolution.reason === "malformed"
        ? "uma execução do período financeiro mais recente está incompleta"
        : resolution.reason === "unpositionable"
          ? "existe uma execução real desta empresa cujo período financeiro não pôde ser determinado"
          : "existem execuções conflitantes para o período financeiro mais recente, sem uma verdade financeira única defensável";
    return {
      outcome: "rejected",
      error: `Não é possível estabelecer a verdade financeira atual desta empresa (${detail}) — a simulação não pode partir de um baseline ambíguo.`,
    };
  }

  const execution = resolution.execution.snapshot.execution;
  if (!hasCompleteFinancialTruth(execution)) {
    return {
      outcome: "rejected",
      error: "A execução mais recente está incompleta — não é possível simular a partir dela.",
    };
  }

  const period = derivePeriodFromIndicators(execution.indicators);
  if (!period) {
    return {
      outcome: "rejected",
      error: "A execução mais recente não possui indicadores — não é possível derivar o período de referência.",
    };
  }

  if (!execution.financialModel) {
    return {
      outcome: "rejected",
      error: "A execução mais recente não possui o Modelo Financeiro completo — não é possível simular a partir dela.",
    };
  }

  return {
    outcome: "ready",
    financialModel: execution.financialModel,
    period,
    identity: computeScenarioBaselineIdentity(execution.financialModel, period),
  };
}
