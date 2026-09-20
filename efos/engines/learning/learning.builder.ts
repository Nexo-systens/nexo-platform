import type {
  Decision,
  DecisionAggregate,
  LearningConfidence,
  Reasoning,
  ReasoningAggregate,
  ReasoningConfidence,
  RecommendationAggregate,
  RecommendationConfidence,
} from "@/efos/domain";

import { RECURRING_RISK_REASONING_TYPE } from "./learning.constants";
import type { LearningDraft } from "./learning.types";

/**
 * Builder do Learning Engine. Centraliza toda regra de consolidação —
 * nenhuma regra vive em learning.engine.ts. Cada função `detect*` lê
 * os agregados já produzidos por Engines anteriores e, quando há algo
 * material a registrar, produz um `LearningDraft`; caso contrário
 * retorna `[]`. Nunca interpreta causa nova, nunca infere além do que
 * os agregados já expressam, nunca altera nenhum dos agregados
 * consumidos, nunca usa IA sob nenhuma circunstância. Todo
 * `LearningDraft` tem `source: "execution"` — este Engine só observa
 * dados de uma única execução do pipeline (ver README.md,
 * "Limitações").
 *
 * As regras casam por `Reasoning.type`/estrutura de `Decision`
 * (contratos oficiais do Domain), nunca por id interno de outro
 * Engine (D-002).
 */

/** Escalas ordinais locais — mesmo precedente de todo builder anterior (evidence/context/reasoning/recommendation/decision): cada Engine define sua própria escala, nunca importa a de outro. */
const REASONING_CONFIDENCE_SCALE: readonly ReasoningConfidence[] = [
  "low",
  "medium",
  "high",
  "verified",
];
const RECOMMENDATION_CONFIDENCE_SCALE: readonly RecommendationConfidence[] = [
  "low",
  "medium",
  "high",
  "verified",
];
const LEARNING_CONFIDENCE_SCALE: readonly LearningConfidence[] = [
  "low",
  "medium",
  "high",
  "verified",
];

function translateReasoningConfidence(
  confidence: ReasoningConfidence
): LearningConfidence {
  return LEARNING_CONFIDENCE_SCALE[REASONING_CONFIDENCE_SCALE.indexOf(confidence)];
}

function translateRecommendationConfidence(
  confidence: RecommendationConfidence
): LearningConfidence {
  return LEARNING_CONFIDENCE_SCALE[
    RECOMMENDATION_CONFIDENCE_SCALE.indexOf(confidence)
  ];
}

/**
 * Padrão de risco recorrente: quando um Reasoning `operational_risk`
 * existe, ele já é, por construção (Mission 011), o resultado de
 * risco de caixa e deterioração de rentabilidade coexistindo na
 * mesma execução. Este registro documenta essa coexistência
 * estruturalmente — nunca afirma recorrência *entre* execuções (não
 * há dado histórico disponível para isso, ver README.md,
 * "Limitações"); a linguagem é deliberadamente condicional.
 */
export function detectRecurringRiskPattern(
  reasoningAggregate: ReasoningAggregate,
  recommendationAggregate: RecommendationAggregate,
  decisionAggregate: DecisionAggregate
): LearningDraft[] {
  const drafts: LearningDraft[] = [];

  const operationalRiskReasonings = reasoningAggregate.reasonings.filter(
    (reasoning: Reasoning) => reasoning.type === RECURRING_RISK_REASONING_TYPE
  );

  for (const reasoning of operationalRiskReasonings) {
    const relatedRecommendations = recommendationAggregate.recommendations.filter(
      (recommendation) => recommendation.reasonings.includes(reasoning.id)
    );
    const relatedDecisions = decisionAggregate.decisions.filter((decision) =>
      decision.reasonings.includes(reasoning.id)
    );

    drafts.push({
      key: `recurring-risk-${reasoning.id}`,
      type: "recurring_risk",
      confidence: translateReasoningConfidence(reasoning.confidence),
      title: "Pressão de caixa e deterioração de rentabilidade coexistiram nesta execução",
      description: `A conclusão "${reasoning.title}" (Reasoning tipo "${reasoning.type}") indica que risco de caixa e deterioração de rentabilidade ocorreram simultaneamente nesta execução — se esse padrão se repetir em execuções futuras da mesma empresa, indicaria risco sistêmico recorrente, não apenas um evento isolado.`,
      source: "execution",
      decisionIds: relatedDecisions.map((d) => d.id),
      recommendationIds: relatedRecommendations.map((r) => r.id),
      reasoningIds: [reasoning.id],
      contextIds: reasoning.contexts,
      evidenceIds: reasoning.evidences,
      supportingData: {
        reasoningType: reasoning.type,
        relatedDecisionCount: relatedDecisions.length,
        relatedRecommendationCount: relatedRecommendations.length,
      },
    });
  }

  return drafts;
}

/**
 * Nota metodológica: para cada Decision produzida nesta execução,
 * registra estruturalmente qual conjunto de Recommendations/
 * Reasonings/Contexts a originou — documentação do "formato" que
 * levou a essa Decision, útil para revisão futura da metodologia
 * (nunca para alterar a metodologia automaticamente).
 */
export function detectMethodologyNotes(
  decisionAggregate: DecisionAggregate
): LearningDraft[] {
  return decisionAggregate.decisions.map((decision: Decision) => ({
    key: `methodology-note-${decision.id}`,
    type: "methodology_note",
    confidence: translateRecommendationConfidence(decision.confidence),
    title: `Registro metodológico: "${decision.title}"`,
    description: `Nesta execução, a Decision "${decision.title}" (tipo "${decision.type}") foi composta a partir de ${decision.recommendations.length} recomendação(ões) — ${decision.recommendations.length > 1 ? "conjunto de recomendações combinadas" : "recomendação isolada"} — derivadas de ${decision.contexts.length} contexto(s) financeiro(s).`,
    source: "execution",
    decisionIds: [decision.id],
    recommendationIds: decision.recommendations,
    reasoningIds: decision.reasonings,
    contextIds: decision.contexts,
    evidenceIds: decision.evidences,
    supportingData: {
      decisionType: decision.type,
      decisionPriority: decision.priority,
      recommendationCount: decision.recommendations.length,
      contextCount: decision.contexts.length,
    },
  }));
}

export function detectLearnings(
  reasoningAggregate: ReasoningAggregate,
  recommendationAggregate: RecommendationAggregate,
  decisionAggregate: DecisionAggregate
): LearningDraft[] {
  return [
    ...detectRecurringRiskPattern(
      reasoningAggregate,
      recommendationAggregate,
      decisionAggregate
    ),
    ...detectMethodologyNotes(decisionAggregate),
  ];
}
