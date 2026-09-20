import type {
  DecisionType,
  RecommendationConfidence,
  RecommendationPriority,
} from "@/efos/domain";
import type { RecommendationReferenceTrace } from "@/efos/application/executive-diagnosis";
import type { RecommendationGovernanceState } from "@/efos/application/recommendation-governance";
import type { RecommendationOutcomeReconciliation } from "@/efos/application/recommendation-outcome-reconciliation";

/**
 * Rótulos do formulário de `Decision` humana — extraídos de
 * `HumanDecisionSection.tsx` (Mission 127) na Mission 184 para reuso
 * por `modules/scenarios/components/ScenarioDecisionForm.tsx` (Scenario
 * Lab → Decision), mesmo padrão de extração já usado abaixo para os
 * dicionários de governança (Mission 179) e por `knowledgeLabels.ts`
 * (Mission 178) — nenhum dicionário de rótulo duplicado uma terceira
 * vez.
 */
export const DECISION_TYPE_LABELS: Record<DecisionType, string> = {
  execute_immediately: "Executar imediatamente",
  prioritize_sequence: "Priorizar em sequência",
};

export const DECISION_PRIORITY_LABELS: Record<RecommendationPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export const DECISION_CONFIDENCE_LABELS: Record<RecommendationConfidence, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  verified: "Verificada",
};

/**
 * Rótulos de governança de Recommendation/Decision (Missions 150-155) —
 * extraídos de `HumanDecisionSection.tsx` (Mission 179) para reuso por
 * `modules/decisions/lib/buildDecisionCenterQueue.ts`/`DecisionCenter.tsx`
 * sem duplicar dicionário — mesmo padrão de extração já usado por
 * `modules/decisions/lib/knowledgeLabels.ts` (Mission 178).
 */

export const RECOMMENDATION_CATEGORY_LABELS: Record<RecommendationReferenceTrace["category"], string> = {
  interpretations: "Interpretação",
  hypotheses: "Hipótese",
  risks: "Risco",
  priorities: "Prioridade",
  possibleActions: "Ação possível",
  questions: "Pergunta",
  uncertainties: "Incerteza",
  conflictInterpretations: "Interpretação de conflito",
};

/**
 * Mission 152 — veredito humano sobre a Recommendation, quando um
 * `DiagnosisReview` já existe — nunca bloqueia a seleção (Review nunca
 * gate de Decision, D-063), apenas torna o contexto visível.
 */
export const RECOMMENDATION_REVIEW_VERDICT_LABELS: Record<"ACCEPTED" | "REJECTED" | "MODIFIED", string> = {
  ACCEPTED: "aceita na revisão",
  REJECTED: "rejeitada na revisão",
  MODIFIED: "modificada na revisão",
};

/**
 * Mission 154 — rótulos honestos do ciclo de vida DERIVADO — nunca
 * interpretam Outcome/Execution como sucesso ou fracasso, apenas
 * nomeiam o estágio operacional real alcançado.
 */
export const GOVERNANCE_LIFECYCLE_LABELS: Record<NonNullable<RecommendationGovernanceState["lifecycleState"]>, string> = {
  NOT_REVIEWED: "Ainda não revisada",
  REVIEWED: "Revisada, sem decisão ainda",
  DECIDED: "Decidida, sem execução ainda",
  EXECUTING: "Em execução",
  BLOCKED: "Execução bloqueada",
  COMPLETED: "Execução concluída",
  CANCELLED: "Execução cancelada",
  OUTCOME_RECORDED: "Resultado registrado",
  LEARNING_OBSERVED: "Aprendizado derivado",
};

/**
 * Mission 155 — rótulos de RECONSTRUÇÃO estrutural — nunca de mérito.
 * Nenhum destes rótulos jamais afirma "a Recommendation funcionou/falhou".
 */
export const RECONCILIATION_STATE_LABELS: Record<NonNullable<RecommendationOutcomeReconciliation["reconciliationState"]>, string> = {
  NOT_DECIDED: "Ainda não decidida",
  DECIDED_NOT_EXECUTED: "Decidida, execução ainda não iniciada",
  EXECUTED_NO_OUTCOME: "Em ou após execução, sem resultado registrado",
  OUTCOME_RECORDED: "Resultado humano registrado",
  FINANCIAL_OBSERVATION_AVAILABLE: "Observação financeira disponível",
  LEARNING_RECORDED: "Aprendizado registrado",
};
