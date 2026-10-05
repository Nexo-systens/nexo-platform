import { createHumanDecision } from "@/efos/application/decision-lifecycle/createHumanDecision";
import type { CreateHumanDecisionCommand } from "@/efos/application/decision-lifecycle/CreateHumanDecisionCommand";
import {
  isScenarioDecisionProposer,
  type ScenarioDecisionContext,
  type ScenarioDecisionProposer,
} from "@/efos/application/decision-lifecycle/ScenarioDecisionContext";
import type { ScenarioProjection } from "@/efos/application/scenario-simulation";
import type { Decision, DecisionType, RecommendationConfidence, RecommendationPriority } from "@/efos/domain";

import type { ScenarioBaselineResolution } from "./resolveScenarioBaselineFromHistory";
import { runSingleScenario, type ScenarioRequest } from "./runSingleScenario";
import {
  PROPOSAL_BASELINE_CHANGED_MESSAGE,
  baselineClaimMatches,
  type ScenarioBaselineIdentity,
} from "./scenarioBaselineIdentity";

export interface ScenarioDecisionRequest {
  readonly companyId: string;
  /**
   * Mission 184 Closure — a identidade EXATA (período + impressão
   * digital do `FinancialModel`) que o cenário/comparação já exibido
   * ao executivo carregava — nunca tratada como autoritativa, apenas
   * como a reivindicação a ser reverificada contra o baseline atual.
   * Quando a decisão vem do Executive Chat (Mission 210), é a âncora
   * financeira da resposta que propôs o cenário.
   */
  readonly evaluatedBaselineIdentity: ScenarioBaselineIdentity;
  readonly request: ScenarioRequest;
  /** Presente apenas quando a Decision se origina de uma comparação — a alternativa NÃO escolhida, nunca convertida em uma segunda Decision. */
  readonly alternative?: ScenarioRequest;
  /** Mission 210 (D-135) — quem propôs o cenário; vocabulário fechado (`SCENARIO_DECISION_PROPOSERS`), validado aqui. */
  readonly proposedBy?: ScenarioDecisionProposer;
  readonly type: DecisionType;
  readonly priority: RecommendationPriority;
  readonly confidence: RecommendationConfidence;
  readonly title: string;
  readonly description: string;
  readonly rationale: string;
}

export type ComposeScenarioDecisionResult =
  | { readonly success: true; readonly decision: Decision }
  | {
      readonly success: false;
      readonly stage: "stale-baseline" | "assumption" | "command";
      readonly error: string;
      readonly errors?: readonly string[];
    };

const SCENARIO_LAB_BASELINE_CHANGED_MESSAGE =
  "A verdade financeira desta empresa foi atualizada desde que este cenário foi simulado — execute a simulação novamente antes de levá-la para uma decisão.";

function toScenarioDecisionContext(
  primary: ScenarioProjection,
  baselineFingerprint: string,
  alternative: ScenarioProjection | undefined,
  proposedBy: ScenarioDecisionProposer | undefined
): ScenarioDecisionContext {
  return {
    nature: "hypothetical",
    scenarioType: primary.scenarioType,
    assumption: primary.assumption,
    period: primary.period,
    comparison: primary.comparison,
    baselineFingerprint,
    alternative: alternative
      ? {
          scenarioType: alternative.scenarioType,
          assumption: alternative.assumption,
          comparison: alternative.comparison,
        }
      : undefined,
    proposedBy,
  };
}

/**
 * Composição pura da decisão tomada a partir de um cenário — o miolo de
 * `createScenarioDecisionAction()` (Mission 184/184 Closure), extraído na
 * Mission 210 (D-135) sem mudar a ordem nem as regras, para que a ação de
 * servidor e os testes executem exatamente o mesmo código. A ação cuida de
 * sessão, empresa (RLS) e leitura do histórico; daqui para frente nada
 * acessa banco.
 *
 * 1. `proposedBy` só aceita o vocabulário fechado — um valor adulterado
 *    recusa a decisão inteira (nunca grava uma origem inventada).
 * 2. A identidade reivindicada precisa ser EXATAMENTE a do baseline atual
 *    (período + impressão do Financial Model). Divergente ou malformada:
 *    recusa (`stale-baseline`) — nunca recomputa contra outra verdade e
 *    nunca reassocia a decisão a uma análise mais nova.
 * 3. Recomputa o(s) cenário(s) a partir do baseline atual e da hipótese
 *    (`runSingleScenario()`, o único despacho) — nenhum valor projetado
 *    vem do cliente.
 * 4. Delega a `createHumanDecision()` — a única composição de `Decision`
 *    humana do EFOS.
 */
export function composeScenarioDecision(
  input: ScenarioDecisionRequest,
  humanActorId: string,
  baseline: Extract<ScenarioBaselineResolution, { outcome: "ready" }>,
  id: string,
  createdAt: string
): ComposeScenarioDecisionResult {
  const proposedBy: unknown = input.proposedBy;
  if (proposedBy !== undefined && !isScenarioDecisionProposer(proposedBy)) {
    return { success: false, stage: "command", error: "Origem da decisão inválida." };
  }

  if (!baselineClaimMatches(input.evaluatedBaselineIdentity, baseline.identity)) {
    return {
      success: false,
      stage: "stale-baseline",
      error: proposedBy === "executive-chat" ? PROPOSAL_BASELINE_CHANGED_MESSAGE : SCENARIO_LAB_BASELINE_CHANGED_MESSAGE,
    };
  }

  const primaryOutcome = runSingleScenario(input.companyId, baseline.financialModel, baseline.period, input.request);
  if (primaryOutcome.outcome === "rejected") {
    return { success: false, stage: "assumption", error: primaryOutcome.error };
  }

  let alternativeProjection: ScenarioProjection | undefined;
  if (input.alternative) {
    const alternativeOutcome = runSingleScenario(input.companyId, baseline.financialModel, baseline.period, input.alternative);
    if (alternativeOutcome.outcome === "rejected") {
      return { success: false, stage: "assumption", error: alternativeOutcome.error };
    }
    alternativeProjection = alternativeOutcome.projection;
  }

  const command: CreateHumanDecisionCommand = {
    humanActorId,
    companyId: input.companyId,
    type: input.type,
    priority: input.priority,
    confidence: input.confidence,
    title: input.title,
    description: input.description,
    rationale: input.rationale,
    scenarioContext: toScenarioDecisionContext(
      primaryOutcome.projection,
      baseline.identity.financialModelFingerprint,
      alternativeProjection,
      proposedBy
    ),
  };

  const result = createHumanDecision(command, id, createdAt);
  if (!result.success) {
    return { success: false, stage: "command", error: "Comando de decisão inválido.", errors: result.error.errors };
  }
  return { success: true, decision: result.value };
}
