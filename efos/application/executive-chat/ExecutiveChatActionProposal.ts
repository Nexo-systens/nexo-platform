import type {
  CollectionPeriodChangeAssumption,
  OperatingCostChangeAssumption,
  ScenarioAssumption,
} from "@/efos/application/scenario-simulation";

/**
 * Missions 189/190 — Governed Executive Chat Actions / Conversational
 * Scenario Comparison.
 *
 * Vocabulário FECHADO de ações que o Chat pode propor — nunca uma URL,
 * nome de rota, nome de Server Action, ou identificador de função
 * arbitrário (Seção 6/30 da Mission 189). Auditoria da Mission 189
 * (Seção 3/4/22/23) confirmou que nenhuma rota/âncora por-entidade
 * existe hoje para uma `Decision`/`Recommendation` específica — tudo é
 * renderizado inline em `app/(app)/companies/[id]/page.tsx` — então
 * navegação por-entidade (`OPEN_DECISION`/`OPEN_RECOMMENDATION` com um
 * id) foi deliberadamente NÃO incluída no catálogo (Seção 4 — "Do not
 * expand scope simply because a capability exists"; nenhum id seria
 * validável contra uma rota que não existe). As 6 ações abaixo são as
 * únicas comprovadas úteis e seguras pela auditoria — 3 de navegação
 * (para seções já renderizadas na mesma página), 2 computacionais
 * (preparar uma simulação real via `simulateScenarioAction()`, Mission
 * 180/182) e 1 de comparação (Mission 190 — preparar uma comparação
 * real via `compareScenariosAction()`, Mission 183, sempre exatamente 2
 * alternativas, nunca um array de N cenários) — nenhuma duplicada.
 */
export const EXECUTIVE_CHAT_NAVIGATION_ACTION_TYPES = [
  "OPEN_SCENARIO_LAB",
  "OPEN_DECISION_CENTER",
  "OPEN_KNOWLEDGE",
] as const;
export type ExecutiveChatNavigationActionType = (typeof EXECUTIVE_CHAT_NAVIGATION_ACTION_TYPES)[number];

export const EXECUTIVE_CHAT_SCENARIO_ACTION_TYPES = [
  "PREPARE_OPERATING_COST_SCENARIO",
  "PREPARE_COLLECTION_PERIOD_SCENARIO",
] as const;
export type ExecutiveChatScenarioActionType = (typeof EXECUTIVE_CHAT_SCENARIO_ACTION_TYPES)[number];

/**
 * Mission 190 — Conversational Scenario Comparison. Terceira categoria,
 * aditiva — exatamente 1 tipo (`PREPARE_SCENARIO_COMPARISON`, sempre
 * com exatamente 2 alternativas, nunca um array de N cenários, Seção 5).
 */
export const EXECUTIVE_CHAT_COMPARISON_ACTION_TYPES = ["PREPARE_SCENARIO_COMPARISON"] as const;
export type ExecutiveChatComparisonActionType = (typeof EXECUTIVE_CHAT_COMPARISON_ACTION_TYPES)[number];

export const EXECUTIVE_CHAT_ACTION_TYPES = [
  ...EXECUTIVE_CHAT_NAVIGATION_ACTION_TYPES,
  ...EXECUTIVE_CHAT_SCENARIO_ACTION_TYPES,
  ...EXECUTIVE_CHAT_COMPARISON_ACTION_TYPES,
] as const;
export type ExecutiveChatActionType = (typeof EXECUTIVE_CHAT_ACTION_TYPES)[number];

/**
 * Forma BRUTA e UNTRUSTED — exatamente o que o tool schema
 * (`efos/infrastructure/executive-chat/executiveChatToolSchema.ts`)
 * aceita do modelo. Deliberadamente UM formato PLANO (nunca uma união
 * discriminada com `required` variável por tipo) — mesma estratégia de
 * `basis` (D-068, Mission 135): achatar para evitar a complexidade de
 * schema que já quebrou o limite de "compiled grammar" da Anthropic em
 * missões anteriores; a forma RICA/discriminada só existe do lado
 * confiável (`ExecutiveChatResolvedAction`, abaixo), nunca no wire
 * format. Nunca contém `label` — o texto do botão/card é SEMPRE
 * determinístico, calculado pela camada de apresentação a partir do
 * `type`/`assumption` já validados (Seção 39/45: nenhum texto de
 * confirmação pode depender de prosa livre do modelo).
 */
/**
 * Mission 190 — uma alternativa bruta/untrusted dentro de uma proposta
 * de comparação — mesmo vocabulário de campo (`kind`/`direction`/
 * `amount`/`deltaDays`) da proposta de cenário único, nunca um segundo
 * formato. `kind` aqui é o discriminante de `ScenarioAssumption`
 * (`"operating_cost_change"` | `"collection_period_change"`) — nunca
 * confundido com `ExecutiveChatActionType` (`type`, no nível acima).
 */
export interface RawScenarioAlternative {
  readonly kind: string;
  readonly direction: string;
  readonly amount?: number;
  readonly deltaDays?: number;
}

export interface RawExecutiveChatActionProposal {
  readonly type: string;
  readonly reason: string;
  readonly direction?: string;
  readonly amount?: number;
  readonly deltaDays?: number;
  /** Mission 190 — presentes apenas quando `type === "PREPARE_SCENARIO_COMPARISON"`; sempre as DUAS juntas ou nenhuma. */
  readonly alternativeA?: RawScenarioAlternative;
  readonly alternativeB?: RawScenarioAlternative;
}

/**
 * Forma CONFIÁVEL e RESOLVIDA — o que de fato chega a
 * `ExecutiveChatAnswer.proposedActions` e à UI. `assumption` reaproveita
 * DIRETAMENTE `OperatingCostChangeAssumption`/`CollectionPeriodChangeAssumption`
 * (`efos/application/scenario-simulation`, D-091/D-092) — nunca um
 * contrato duplicado; a camada de Platform (`modules/executive-chat/`)
 * converte esse `assumption` para o `ScenarioRequest` que
 * `simulateScenarioAction()` já aceita (Seção 17: "Reuse D-092
 * contracts", nunca duplicar tipos de Scenario).
 *
 * **Nunca contém**: `companyId` (a ação sempre executa contra a MESMA
 * empresa da conversa atual, nunca um valor do proposal — Seção 9/33);
 * um valor financeiro projetado/computado (Seção 39 — `assumption`
 * carrega apenas a HIPÓTESE, nunca um resultado); rota/URL (Seção 30 —
 * a âncora de navegação é resolvida por uma tabela fixa em
 * `modules/executive-chat/`, nunca aceita do provider).
 */
export type ExecutiveChatResolvedAction =
  | { readonly kind: "navigation"; readonly type: ExecutiveChatNavigationActionType; readonly reason: string }
  | {
      readonly kind: "scenario";
      readonly type: "PREPARE_OPERATING_COST_SCENARIO";
      readonly reason: string;
      readonly assumption: OperatingCostChangeAssumption;
    }
  | {
      readonly kind: "scenario";
      readonly type: "PREPARE_COLLECTION_PERIOD_SCENARIO";
      readonly reason: string;
      readonly assumption: CollectionPeriodChangeAssumption;
    }
  | {
      readonly kind: "comparison";
      readonly type: "PREPARE_SCENARIO_COMPARISON";
      readonly reason: string;
      readonly alternativeA: ScenarioAssumption;
      readonly alternativeB: ScenarioAssumption;
    };

/** Seção 37 — nunca spam de ações; no máximo 3 por resposta. */
export const MAX_EXECUTIVE_CHAT_PROPOSED_ACTIONS = 3;

const MAX_REASON_LENGTH = 400;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Mission 190 — ÚNICA autoridade de conversão sinal+magnitude → delta
 * assinado (Seção 7: "Define one authority for sign conversion"),
 * extraída para ser reaproveitada tanto pelo cenário único
 * (`PREPARE_OPERATING_COST_SCENARIO`/`PREPARE_COLLECTION_PERIOD_SCENARIO`)
 * quanto por CADA alternativa de uma comparação
 * (`PREPARE_SCENARIO_COMPARISON`) — nunca duas implementações do mesmo
 * cálculo. Mesma disciplina de `resolveExecutiveChatActionProposal()`:
 * puro, sem I/O, nunca resolve baseline real, apenas forma e sinal.
 */
function resolveScenarioAssumptionFromParts(
  kind: string,
  direction: string | undefined,
  amount: number | undefined,
  deltaDays: number | undefined
): ScenarioAssumption | undefined {
  if (kind === "operating_cost_change") {
    if (direction !== "increase" && direction !== "decrease") return undefined;
    if (!isPositiveFiniteNumber(amount)) return undefined;

    const signedAmount = direction === "increase" ? amount : -amount;
    return {
      kind: "operating_cost_change",
      scenarioType: "adjust_operating_costs",
      operatingExpensesDelta: { amount: signedAmount, currency: "BRL" },
    };
  }

  if (kind === "collection_period_change") {
    if (direction !== "longer" && direction !== "shorter") return undefined;
    if (!isPositiveFiniteNumber(deltaDays)) return undefined;

    const signedDays = direction === "longer" ? deltaDays : -deltaDays;
    return { kind: "collection_period_change", scenarioType: "adjust_collection_terms", collectionPeriodDeltaDays: signedDays };
  }

  return undefined;
}

/**
 * Resolve UM proposal bruto/untrusted numa ação confiável, ou
 * `undefined` se estruturalmente inválido (Seção 10/31 — "reject
 * malformed provider response... do not render a best-effort action").
 * Puro, sem I/O — NUNCA resolve baseline financeiro real ou aplica a
 * validação semântica completa de `validateOperatingCostChangeAssumption()`/
 * `validateCollectionPeriodChangeAssumption()` (essas exigem o baseline
 * real, só disponível dentro de `simulateScenarioAction()`/
 * `compareScenariosAction()` — Seção 43: a verdade financeira nunca é
 * resolvida duas vezes nem antecipada aqui). Esta função verifica
 * apenas a FORMA e o sinal — allowlist de `type`, `reason` não-vazio e
 * de tamanho razoável, `direction` pertencente ao vocabulário certo,
 * magnitude positiva finita — nunca "conserta" um valor inválido.
 *
 * **Mission 190 — `PREPARE_SCENARIO_COMPARISON` (Seção 8/35)**: as DUAS
 * alternativas devem estar presentes e AMBAS resolver com sucesso — se
 * qualquer uma for inválida (kind desconhecido, direction errada,
 * magnitude não-finita/não-positiva), a proposta INTEIRA é descartada,
 * nunca uma comparação parcial com apenas 1 lado executável (Seção 9/35:
 * "the comparison action is not executable... do NOT execute a partial
 * comparison"). Alternativas idênticas são permitidas sem tratamento
 * especial (Seção 19) — `buildExecutiveScenarioComparison()`/Mission 183
 * nunca rejeitou esse caso, e inventar uma regra nova aqui violaria a
 * mesma disciplina que a missão pede para não fazer.
 */
export function resolveExecutiveChatActionProposal(
  raw: RawExecutiveChatActionProposal
): ExecutiveChatResolvedAction | undefined {
  if (!isNonEmptyString(raw.reason) || raw.reason.length > MAX_REASON_LENGTH) return undefined;

  if ((EXECUTIVE_CHAT_NAVIGATION_ACTION_TYPES as readonly string[]).includes(raw.type)) {
    return { kind: "navigation", type: raw.type as ExecutiveChatNavigationActionType, reason: raw.reason };
  }

  if (raw.type === "PREPARE_OPERATING_COST_SCENARIO") {
    const assumption = resolveScenarioAssumptionFromParts("operating_cost_change", raw.direction, raw.amount, raw.deltaDays);
    if (!assumption || assumption.kind !== "operating_cost_change") return undefined;
    return { kind: "scenario", type: "PREPARE_OPERATING_COST_SCENARIO", reason: raw.reason, assumption };
  }

  if (raw.type === "PREPARE_COLLECTION_PERIOD_SCENARIO") {
    const assumption = resolveScenarioAssumptionFromParts("collection_period_change", raw.direction, raw.amount, raw.deltaDays);
    if (!assumption || assumption.kind !== "collection_period_change") return undefined;
    return { kind: "scenario", type: "PREPARE_COLLECTION_PERIOD_SCENARIO", reason: raw.reason, assumption };
  }

  if (raw.type === "PREPARE_SCENARIO_COMPARISON") {
    if (!raw.alternativeA || !raw.alternativeB) return undefined;

    const alternativeA = resolveScenarioAssumptionFromParts(
      raw.alternativeA.kind,
      raw.alternativeA.direction,
      raw.alternativeA.amount,
      raw.alternativeA.deltaDays
    );
    const alternativeB = resolveScenarioAssumptionFromParts(
      raw.alternativeB.kind,
      raw.alternativeB.direction,
      raw.alternativeB.amount,
      raw.alternativeB.deltaDays
    );
    if (!alternativeA || !alternativeB) return undefined;

    return { kind: "comparison", type: "PREPARE_SCENARIO_COMPARISON", reason: raw.reason, alternativeA, alternativeB };
  }

  return undefined;
}

/**
 * Resolve uma LISTA bruta — descarta silenciosamente propostas
 * inválidas (Seção 32: "the rest of the valid Chat response may remain
 * usable" — decisão deliberada desta missão, diferente da rejeição
 * ESTRITA de `basis` inválido: uma ação é uma sugestão de UI, nunca
 * evidência de uma alegação; descartá-la muda apenas affordances,
 * nunca o conteúdo epistêmico da resposta). Preserva a ordem original
 * (Seção 38 — a própria ordem do modelo já funciona como a "tabela de
 * prioridade explícita" aceitável pela missão; nenhuma engine de
 * ranking nova) e limita a `MAX_EXECUTIVE_CHAT_PROPOSED_ACTIONS`.
 */
export function resolveExecutiveChatActionProposals(
  raw: readonly RawExecutiveChatActionProposal[] | undefined
): readonly ExecutiveChatResolvedAction[] {
  if (!raw) return [];

  const resolved: ExecutiveChatResolvedAction[] = [];
  for (const item of raw) {
    if (resolved.length === MAX_EXECUTIVE_CHAT_PROPOSED_ACTIONS) break;
    const action = resolveExecutiveChatActionProposal(item);
    if (action) resolved.push(action);
  }
  return resolved;
}
