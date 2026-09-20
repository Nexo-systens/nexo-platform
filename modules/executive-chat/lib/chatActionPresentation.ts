import type { ExecutiveChatNavigationActionType } from "@/efos/application/executive-chat";
import { describeScenarioAssumption } from "@/modules/scenarios/lib/scenario-language";
import type { ExecutiveChatResolvedAction } from "@/efos/application/executive-chat";

/**
 * Mission 189 — Governed Executive Chat Actions.
 *
 * Vocabulário de apresentação DETERMINÍSTICO — nunca o `reason` livre
 * do modelo é usado como título/rótulo de confirmação (Seção 11/39/45:
 * o texto do que SERÁ executado nunca pode depender de prosa livre da
 * IA). Âncoras fixas (Seção 30 — "Server constructs or chosen canonical
 * navigation target", nunca aceito do provider) apontando para os ids
 * já adicionados nesta missão: `#scenario-lab` (`ScenarioLab.tsx`),
 * `#decision-center` (`DecisionCenter.tsx`), `#knowledge`
 * (`KnowledgeSection.tsx`).
 */
export const EXECUTIVE_CHAT_NAVIGATION_ANCHORS: Readonly<Record<ExecutiveChatNavigationActionType, string>> = {
  OPEN_SCENARIO_LAB: "scenario-lab",
  OPEN_DECISION_CENTER: "decision-center",
  OPEN_KNOWLEDGE: "knowledge",
};

export const EXECUTIVE_CHAT_NAVIGATION_TITLES: Readonly<Record<ExecutiveChatNavigationActionType, string>> = {
  OPEN_SCENARIO_LAB: "Abrir Scenario Lab",
  OPEN_DECISION_CENTER: "Abrir Central de Decisões",
  OPEN_KNOWLEDGE: "Ver conhecimento organizacional",
};

/**
 * Título fixo do card de ação computacional — nunca o `label`
 * hipotético do modelo (removido do contrato, ver
 * `ExecutiveChatActionProposal.ts`). A descrição do QUE será executado
 * (Seção 45 — "display the actual structured assumption") reaproveita
 * `describeScenarioAssumption()`, o MESMO vocabulário neutro já usado
 * pelo Scenario Lab (Mission 181/182) — nunca um segundo formatador.
 */
export function describeChatScenarioAction(action: Extract<ExecutiveChatResolvedAction, { kind: "scenario" }>): {
  readonly title: string;
  readonly assumptionDescription: string;
} {
  const title =
    action.type === "PREPARE_OPERATING_COST_SCENARIO" ? "Simular cenário de despesas operacionais" : "Simular cenário de prazo de recebimento";
  return { title, assumptionDescription: describeScenarioAssumption(action.assumption) };
}

/**
 * Mission 190 — Conversational Scenario Comparison. Mesmo princípio de
 * `describeChatScenarioAction()`: título sempre fixo, descrição de CADA
 * alternativa sempre via `describeScenarioAssumption()` — nunca a prosa
 * do modelo, mesmo quando as duas alternativas são do mesmo mecanismo
 * financeiro (Seção 18/33 — comparação do mesmo tipo é permitida sem
 * tratamento especial).
 */
export function describeChatComparisonAction(action: Extract<ExecutiveChatResolvedAction, { kind: "comparison" }>): {
  readonly title: string;
  readonly alternativeADescription: string;
  readonly alternativeBDescription: string;
} {
  return {
    title: "Comparar cenários",
    alternativeADescription: describeScenarioAssumption(action.alternativeA),
    alternativeBDescription: describeScenarioAssumption(action.alternativeB),
  };
}
