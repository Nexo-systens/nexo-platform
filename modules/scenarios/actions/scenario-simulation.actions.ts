"use server";

import { getCurrentUser } from "@/modules/auth/services/auth.service";
import { getCompanyById } from "@/modules/companies/services/company.service";
import { createClient } from "@/lib/supabase/server";
import { SupabaseExecutionRepository } from "@/efos/infrastructure/repositories";
import { SupabasePersistenceClient } from "@/efos/infrastructure/providers";
import { DefaultHistoricalExecutionService } from "@/efos/application/history";
import type { FinancialModelAggregate, Period } from "@/efos/domain";
import {
  buildExecutiveScenarioComparison,
  type ExecutiveScenarioComparison,
  type ScenarioProjection,
} from "@/efos/application/scenario-simulation";
import {
  derivePeriodFromIndicators,
  hasCompleteFinancialTruth,
  resolveCurrentFinancialExecution,
} from "@/modules/decisions/lib/selectCurrentFinancialExecution";
import { runSingleScenario, type ScenarioRequest, type SingleScenarioOutcome } from "@/modules/scenarios/lib/runSingleScenario";
import { computeScenarioBaselineIdentity, type ScenarioBaselineIdentity } from "@/modules/scenarios/lib/scenarioBaselineIdentity";

export type { ScenarioRequest } from "@/modules/scenarios/lib/runSingleScenario";
export type { ScenarioBaselineIdentity } from "@/modules/scenarios/lib/scenarioBaselineIdentity";

/**
 * Mission 180 — Scenario Intelligence Foundation & First Real
 * Simulation. Generalizada pela Mission 182 — Scenario Engine
 * Generalization (Seção 21). Estendida pela Mission 183 — Executive
 * Scenario Comparison (Seção 22).
 *
 * Até a Mission 182, esta ação só existia para a vertical de Despesas
 * Operacionais. Generalizada numa única `simulateScenarioAction()` com
 * entrada em união discriminada por `kind` — apenas a delegação ao
 * simulador puro difere por vertical, cada simulador permanece
 * inteiramente especializado (Seção 14).
 *
 * A Mission 183 precisou comparar DUAS execuções de simulação a partir
 * do MESMO baseline (Seção 4/22) — um risco real de concorrência
 * existiria se cada simulação resolvesse seu próprio baseline
 * independentemente (Seção 23: uma nova execução poderia ser
 * persistida entre as duas chamadas, fazendo cada cenário partir de
 * uma verdade financeira diferente). `resolveScenarioBaseline()`
 * (passos 1-3 abaixo) é chamada EXATAMENTE UMA VEZ por operação —
 * tanto em `simulateScenarioAction()` (um cenário) quanto em
 * `compareScenariosAction()` (dois cenários, o MESMO `financialModel`/
 * `period` repassado para ambas as chamadas de simulador, nunca
 * re-resolvido entre elas).
 *
 * 1. autentica (`getCurrentUser()`) e resolve a empresa via RLS
 *    (`getCompanyById()`) — `companyId` do client nunca é aceito como
 *    autorização por si só;
 * 2. obtém o baseline canônico via `HistoricalExecutionService.getHistory()`
 *    + `resolveCurrentFinancialExecution()` (D-088/D-089/D-090) — nunca
 *    `executedAt`/última linha/ordem de array;
 * 3. falha fechado (Seção 27, Mission 180) se a verdade financeira for
 *    ausente, ambígua, incompleta, ou se `financialModel` estiver
 *    ausente da execução resolvida;
 * 4. delega todo o cálculo ao(s) simulador(es) puro(s) correspondente(s)
 *    (`efos/application/scenario-simulation/`) — esta Server Action
 *    nunca calcula nada, apenas resolve I/O e repassa;
 * 5. (só em `compareScenariosAction()`) delega a comparação a
 *    `buildExecutiveScenarioComparison()`, igualmente pura.
 *
 * Nunca escreve em nenhuma tabela — nenhum `INSERT`/`UPDATE`/
 * `revalidatePath` neste arquivo (sem persistência, sem efeito
 * colateral). Nunca chama `AnthropicExecutiveAIProvider`.
 *
 * **Mission 184**: `runSingleScenario()` (o despacho puro por `kind`)
 * foi movido para `modules/scenarios/lib/runSingleScenario.ts` — um
 * módulo `"use server"` exige que todo export de nível superior seja
 * assíncrono (restrição de build do Next.js), e a Mission 184 precisa
 * reaproveitar essa mesma função pura de um segundo arquivo de ação
 * (`scenario-decision.actions.ts`). `ScenarioRequest` é reexportado
 * daqui (`export type {...}`) para que nenhum import existente na UI
 * precisasse mudar.
 */

export type SimulateScenarioInput = ScenarioRequest & { readonly companyId: string };

export type SimulateScenarioActionResult =
  | {
      readonly success: true;
      readonly projection: ScenarioProjection;
      /**
       * Mission 184 Closure — identidade EXATA (período + impressão
       * digital do `FinancialModel`) da verdade financeira usada nesta
       * simulação — nunca apenas `projection.period`. O client guarda
       * este valor e o ecoa de volta em `createScenarioDecisionAction()`
       * ao formalizar a Decision — sempre uma REIVINDICAÇÃO
       * reverificada no servidor, nunca uma autoridade aceita como tal.
       */
      readonly baselineIdentity: ScenarioBaselineIdentity;
    }
  | {
      readonly success: false;
      readonly error: string;
      readonly stage: "auth" | "access" | "financial-truth" | "assumption";
    };

export type CompareScenariosInput = {
  readonly companyId: string;
  /** Exatamente 2 (Seção 12 — a missão prova baseline+A+B; N permanece possível na Application Layer sem complexidade adicional, mas o produto/testes ficam focados em 2). */
  readonly scenarios: readonly [ScenarioRequest, ScenarioRequest];
};

export type CompareScenariosActionResult =
  | {
      readonly success: true;
      readonly comparison: ExecutiveScenarioComparison;
      /** Mission 184 Closure — mesma identidade exata, ver `SimulateScenarioActionResult`. */
      readonly baselineIdentity: ScenarioBaselineIdentity;
    }
  | {
      readonly success: false;
      readonly error: string;
      readonly stage: "auth" | "access" | "financial-truth" | "assumption";
    };

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
 * Passos 1-3 do cabeçalho acima, extraídos por serem genuinamente
 * idênticos entre as duas verticais e entre simulação única/comparação
 * (Seção 13/21) — nunca uma segunda implementação de resolução de
 * baseline.
 *
 * Exportada desde a Mission 184 (Scenario-to-Decision Governance
 * Bridge) — `modules/scenarios/actions/scenario-decision.actions.ts`
 * reaproveita esta mesma função para recomputar, no servidor, o
 * cenário selecionado por um executivo ao formalizar uma Decision,
 * nunca uma segunda implementação de resolução de baseline.
 */
export async function resolveScenarioBaseline(companyId: string): Promise<ScenarioBaselineResolution> {
  const supabaseClient = await createClient();
  const persistenceClient = new SupabasePersistenceClient(supabaseClient);
  const executionRepository = new SupabaseExecutionRepository(persistenceClient);
  const historicalExecutionService = new DefaultHistoricalExecutionService(executionRepository);

  const history = await historicalExecutionService.getHistory(companyId);
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

  const currentHistoricalExecution = resolution.execution;
  const execution = currentHistoricalExecution.snapshot.execution;
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

export async function simulateScenarioAction(
  input: SimulateScenarioInput
): Promise<SimulateScenarioActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, stage: "auth", error: "Sessão expirada. Faça login novamente." };
  }

  const company = await getCompanyById(input.companyId);
  if (!company) {
    return { success: false, stage: "access", error: "Empresa não encontrada ou sem acesso." };
  }

  const baseline = await resolveScenarioBaseline(input.companyId);
  if (baseline.outcome === "rejected") {
    return { success: false, stage: "financial-truth", error: baseline.error };
  }

  const outcome = runSingleScenario(input.companyId, baseline.financialModel, baseline.period, input);
  if (outcome.outcome === "rejected") {
    return { success: false, stage: "assumption", error: outcome.error };
  }
  return { success: true, projection: outcome.projection, baselineIdentity: baseline.identity };
}

/**
 * Mission 183 — Executive Scenario Comparison.
 *
 * `resolveScenarioBaseline()` chamada EXATAMENTE UMA VEZ (Seção 22/23)
 * — o MESMO `financialModel`/`period` (mesma referência de objeto,
 * nunca uma segunda consulta) é repassado às duas chamadas de
 * `runSingleScenario()`. Nenhuma execução persistida entre T1 (baseline
 * resolvido) e T3 (segundo cenário simulado) pode afetar esta operação
 * — não há nenhum ponto de código entre as duas chamadas que consulte
 * `resolveCurrentFinancialExecution()`/o banco novamente.
 */
export async function compareScenariosAction(
  input: CompareScenariosInput
): Promise<CompareScenariosActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, stage: "auth", error: "Sessão expirada. Faça login novamente." };
  }

  const company = await getCompanyById(input.companyId);
  if (!company) {
    return { success: false, stage: "access", error: "Empresa não encontrada ou sem acesso." };
  }

  const baseline = await resolveScenarioBaseline(input.companyId);
  if (baseline.outcome === "rejected") {
    return { success: false, stage: "financial-truth", error: baseline.error };
  }

  const outcomes = input.scenarios.map((request) =>
    runSingleScenario(input.companyId, baseline.financialModel, baseline.period, request)
  );

  const firstRejected = outcomes.find(
    (outcome): outcome is Extract<SingleScenarioOutcome, { outcome: "rejected" }> => outcome.outcome === "rejected"
  );
  if (firstRejected) {
    return { success: false, stage: "assumption", error: firstRejected.error };
  }

  const projections = outcomes.map(
    (outcome) => (outcome as Extract<SingleScenarioOutcome, { outcome: "simulated" }>).projection
  );

  const comparisonOutcome = buildExecutiveScenarioComparison(input.companyId, projections);
  if (comparisonOutcome.outcome === "rejected") {
    const messages: Record<typeof comparisonOutcome.reason, string> = {
      "insufficient-scenarios": "São necessários pelo menos dois cenários para comparar.",
      "mismatched-baseline":
        "Os cenários não compartilham a mesma verdade financeira base — não é possível compará-los como alternativas.",
    };
    return { success: false, stage: "financial-truth", error: messages[comparisonOutcome.reason] };
  }

  return { success: true, comparison: comparisonOutcome.comparison, baselineIdentity: baseline.identity };
}
