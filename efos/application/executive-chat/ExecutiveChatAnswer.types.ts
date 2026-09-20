import type {
  ExecutiveConfidence,
  ExecutiveHypothesis,
  ExecutiveInterpretation,
  ExecutiveUncertainty,
  InterpretationBasis,
} from "@/efos/application/executive-diagnosis";
import type { ExecutiveChatResolvedAction } from "./ExecutiveChatActionProposal";

/**
 * Contrato de saída de Executive Chat (Mission 188). Deliberadamente
 * reaproveita, sem cópia nem redefinição, o vocabulário de
 * interpretação já estabelecido por `ExecutiveDiagnosis` (D-059,
 * Mission 115): `InterpretationBasis` (referência rastreável a
 * elementos reais de `ExecutiveFinancialContext`/`ExecutiveKnowledgeContext`),
 * `ExecutiveConfidence`, `ExecutiveInterpretation` (usado aqui como
 * "Analysis") e `ExecutiveHypothesis`. Nenhum vocabulário paralelo de
 * confiança/rastreabilidade é criado — a distinção Fact/Analysis/
 * Hypothesis/Limitation exigida pela missão (Seção 11) é modelada como
 * 4 arrays estruturalmente distintos, nunca uma união de "tipo de
 * item" que poderia ser confundida.
 *
 * `ExecutiveUncertainty` (id/statement/reason) é reaproveinda para
 * "Limitation" — mesmo conceito: um motivo declarado explicitamente
 * pelo qual algo não pode ser concluído (Seção 18: "Não há dados
 * suficientes para concluir por que a margem caiu.").
 */
export interface ExecutiveChatFactualClaim {
  readonly id: string;
  readonly statement: string;
  readonly basis: InterpretationBasis;
}

/** "Analysis" (Seção 11) — reaproveita `ExecutiveInterpretation` (D-059) diretamente, ver comentário do módulo. */
export type ExecutiveChatAnalysis = ExecutiveInterpretation;

/** "Hypothesis" (Seção 11) — reaproveita `ExecutiveHypothesis` (D-059) diretamente. */
export type ExecutiveChatHypothesis = ExecutiveHypothesis;

/** "Limitation" (Seção 11/18) — reaproveita `ExecutiveUncertainty` (D-059) diretamente. */
export type ExecutiveChatLimitation = ExecutiveUncertainty;

/**
 * Vocabulário fechado de status de fundamentação (Seções 17/18/31).
 * `GROUNDED` — a pergunta foi respondida com base suficiente em
 * `context`/`knowledgeContext`. `PARTIAL` — parte da pergunta foi
 * respondida, mas alguma limitação relevante permanece (dado ausente/
 * incompleto). `UNSUPPORTED` — o contexto canônico atual não permite
 * responder a pergunta com nenhuma base real (ex.: previsão que o EFOS
 * não calcula, ou verdade financeira ambígua) — nunca acompanhado de
 * `factualClaims` não vazio (reforçado pelo validator).
 */
export const EXECUTIVE_CHAT_GROUNDING_STATUSES = ["GROUNDED", "PARTIAL", "UNSUPPORTED"] as const;
export type ExecutiveChatGroundingStatus = (typeof EXECUTIVE_CHAT_GROUNDING_STATUSES)[number];

/**
 * Fronteiras arquiteturais explícitas da resposta de chat (Seção 42),
 * mesmo precedente estrutural de `DiagnosisBoundaries` (Mission 115,
 * Etapa 16): um tipo literal fechado, nunca preenchido pelo modelo —
 * sempre injetado pelo adapter de infraestrutura (`AnthropicExecutiveChatProvider`),
 * nunca confiado à IA (mesmo princípio de `id`/`basedOn`/`boundaries`
 * em `ExecutiveDiagnosis`).
 */
export interface ExecutiveChatBoundaries {
  readonly doesNotChangeFinancialTruth: true;
  readonly doesNotMakeDecisions: true;
  readonly doesNotExecuteActions: true;
  readonly doesNotCreateRecommendations: true;
  readonly doesNotSimulateScenarios: true;
  readonly containsFactualClaims: true;
  readonly containsAnalysis: true;
  readonly containsHypotheses: true;
}

export const EXECUTIVE_CHAT_BOUNDARIES: ExecutiveChatBoundaries = {
  doesNotChangeFinancialTruth: true,
  doesNotMakeDecisions: true,
  doesNotExecuteActions: true,
  doesNotCreateRecommendations: true,
  doesNotSimulateScenarios: true,
  containsFactualClaims: true,
  containsAnalysis: true,
  containsHypotheses: true,
};

/**
 * `ExecutiveChatAnswer` (Mission 188) — contrato canônico de saída de
 * uma futura Executive AI conversacional. Espelha deliberadamente a
 * forma de `ExecutiveDiagnosis` (D-059) — `id`/`basedOn`/`boundaries`
 * nunca vêm do modelo, sempre injetados pelo adapter — mas nunca é o
 * mesmo tipo: `ExecutiveDiagnosis` é produzido periodicamente sobre um
 * `ExecutiveFinancialContext` inteiro; `ExecutiveChatAnswer` responde
 * uma pergunta pontual, carrega `requiresScenarioSimulation` (Seção
 * 15/32 da Mission 188 — nenhum campo aqui permite ao modelo reportar
 * um valor numérico calculado por ele mesmo; uma simulação sempre
 * exige o Scenario Engine real) e nunca é persistido (ver
 * `docs/DECISIONS.md`, D-103).
 *
 * `proposedActions?` (Mission 189 — Governed Executive Chat Actions,
 * D-104) — extensão puramente ADITIVA, mesmo precedente de
 * `financialEpisodes?`/`historicalIntelligence?`: OPCIONAL para que
 * qualquer `ExecutiveChatAnswer` construído antes desta missão (ex.:
 * fixtures do `test-mission188-executive-chat.ts`, nunca reescrito)
 * continue sendo um valor válido do tipo, sem nenhuma alteração.
 * Ausente/`undefined` significa "nenhuma ação proposta" — semântica
 * idêntica a um array vazio, nunca lida como erro. Carrega apenas
 * `ExecutiveChatResolvedAction` — a forma já VALIDADA/RESOLVIDA
 * (`resolveExecutiveChatActionProposals()`), nunca a forma bruta que o
 * provider emitiu.
 */
export interface ExecutiveChatAnswer {
  readonly id: string;
  readonly answer: string;
  readonly factualClaims: readonly ExecutiveChatFactualClaim[];
  readonly analysis: readonly ExecutiveChatAnalysis[];
  readonly hypotheses: readonly ExecutiveChatHypothesis[];
  readonly limitations: readonly ExecutiveChatLimitation[];
  readonly groundingStatus: ExecutiveChatGroundingStatus;
  readonly requiresScenarioSimulation: boolean;
  readonly basedOn: { readonly companyId: string; readonly generatedAt: string };
  readonly boundaries: ExecutiveChatBoundaries;
  readonly proposedActions?: readonly ExecutiveChatResolvedAction[];
}

export type { ExecutiveConfidence, InterpretationBasis };
