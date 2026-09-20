import type {
  Recommendation,
  RecommendationAggregate,
  RecommendationConfidence,
  RecommendationPriority,
} from "@/efos/domain";

import {
  IMMEDIATE_EXECUTION_PRIORITIES,
  MINIMUM_RECOMMENDATIONS_FOR_SEQUENCE,
  RECOMMENDATION_CONFIDENCE_SCALE,
  RECOMMENDATION_PRIORITY_SCALE,
} from "./decision.constants";
import type { DecisionDraft } from "./decision.types";

/**
 * Builder do Decision Engine. Centraliza toda regra de priorizacao —
 * nenhuma regra vive em decision.engine.ts. Le `RecommendationAggregate`
 * (o unico agregado do qual as regras atuais precisam — prioridade e
 * confianca de cada Recommendation ja bastam para decidir entre
 * "executar imediatamente" e "priorizar sequencia") e produz
 * exatamente um `DecisionDraft` quando ha pelo menos uma
 * Recommendation. Nunca cria prioridade arbitraria — sempre derivada
 * das Recommendations recebidas. Nunca executa acao, nunca simula
 * cenario, nunca usa IA sob nenhuma circunstancia.
 *
 * As duas regras sao mutuamente exclusivas por construcao: com
 * exatamente 1 Recommendation de prioridade alta/critica, "executar
 * imediatamente"; com 2+ Recommendations (qualquer prioridade),
 * "priorizar sequencia". Uma unica Recommendation de prioridade
 * baixa/media, isolada, nao gera Decision nesta fase (ver README.md,
 * "Limitacoes").
 */

function uniqueIds(
  recommendations: readonly Recommendation[],
  select: (recommendation: Recommendation) => readonly string[]
): string[] {
  return [...new Set(recommendations.flatMap(select))];
}

/** Prioridade mais grave entre as Recommendations combinadas — nunca inventada, sempre a maior das prioridades recebidas. */
function consolidatePriority(
  recommendations: readonly Recommendation[]
): RecommendationPriority {
  const maxRank = Math.max(
    ...recommendations.map((r) => RECOMMENDATION_PRIORITY_SCALE.indexOf(r.priority))
  );
  return RECOMMENDATION_PRIORITY_SCALE[maxRank];
}

/** Confiança mais fraca entre as Recommendations combinadas — o elo mais fraco determina o quão fundamentada a decisão está. */
function consolidateConfidence(
  recommendations: readonly Recommendation[]
): RecommendationConfidence {
  const minRank = Math.min(
    ...recommendations.map((r) => RECOMMENDATION_CONFIDENCE_SCALE.indexOf(r.confidence))
  );
  return RECOMMENDATION_CONFIDENCE_SCALE[minRank];
}

/**
 * Ordena Recommendations por prioridade decrescente e, em empate, por
 * confiança decrescente — critério único e determinístico, nunca
 * arbitrário. Não muta o array recebido.
 */
function orderByPriorityThenConfidence(
  recommendations: readonly Recommendation[]
): Recommendation[] {
  return [...recommendations].sort((a, b) => {
    const priorityDiff =
      RECOMMENDATION_PRIORITY_SCALE.indexOf(b.priority) -
      RECOMMENDATION_PRIORITY_SCALE.indexOf(a.priority);
    if (priorityDiff !== 0) return priorityDiff;

    return (
      RECOMMENDATION_CONFIDENCE_SCALE.indexOf(b.confidence) -
      RECOMMENDATION_CONFIDENCE_SCALE.indexOf(a.confidence)
    );
  });
}

export function detectExecuteImmediately(
  recommendationAggregate: RecommendationAggregate
): DecisionDraft[] {
  const { recommendations } = recommendationAggregate;
  if (recommendations.length !== 1) return [];

  const [recommendation] = recommendations;
  if (
    !(IMMEDIATE_EXECUTION_PRIORITIES as readonly string[]).includes(
      recommendation.priority
    )
  ) {
    return [];
  }

  return [
    {
      key: "execute-immediately",
      type: "execute_immediately",
      priority: recommendation.priority,
      confidence: recommendation.confidence,
      title: `Executar "${recommendation.title}" imediatamente`,
      description: `Única recomendação identificada nesta execução — "${recommendation.title}", prioridade ${recommendation.priority}.`,
      rationale: `Critério: única Recommendation nesta execução (sem concorrência de priorização) com prioridade "${recommendation.priority}" (uma das prioridades de execução imediata: ${IMMEDIATE_EXECUTION_PRIORITIES.join(", ")}) — executada sem necessidade de sequenciamento.`,
      recommendationIds: [recommendation.id],
      reasoningIds: recommendation.reasonings,
      contextIds: recommendation.contexts,
      evidenceIds: recommendation.evidences,
      supportingData: {
        recommendationType: recommendation.type,
        recommendationPriority: recommendation.priority,
      },
    },
  ];
}

export function detectPrioritizeSequence(
  recommendationAggregate: RecommendationAggregate
): DecisionDraft[] {
  const { recommendations } = recommendationAggregate;
  if (recommendations.length < MINIMUM_RECOMMENDATIONS_FOR_SEQUENCE) return [];

  const ordered = orderByPriorityThenConfidence(recommendations);
  const sequenceTitle = ordered.map((r) => `"${r.title}"`).join(" antes de ");

  return [
    {
      key: "prioritize-sequence",
      type: "prioritize_sequence",
      priority: consolidatePriority(recommendations),
      confidence: consolidateConfidence(recommendations),
      title: `Priorizar ${sequenceTitle}`,
      description: `${recommendations.length} recomendações identificadas nesta execução — ordenadas por prioridade e, em empate, por confiança.`,
      rationale: `Critério: ordenação decrescente por prioridade (${[...RECOMMENDATION_PRIORITY_SCALE].reverse().join(" > ")}) e, em caso de empate, por confiança decrescente (${[...RECOMMENDATION_CONFIDENCE_SCALE].reverse().join(" > ")}). Ordem resultante: ${ordered.map((r, i) => `${i + 1}. ${r.title} (${r.priority}/${r.confidence})`).join("; ")}.`,
      recommendationIds: ordered.map((r) => r.id),
      reasoningIds: uniqueIds(recommendations, (r) => r.reasonings),
      contextIds: uniqueIds(recommendations, (r) => r.contexts),
      evidenceIds: uniqueIds(recommendations, (r) => r.evidences),
      supportingData: {
        recommendationCount: recommendations.length,
        order: ordered.map((r) => r.id),
      },
    },
  ];
}

export function detectDecisions(
  recommendationAggregate: RecommendationAggregate
): DecisionDraft[] {
  return [
    ...detectExecuteImmediately(recommendationAggregate),
    ...detectPrioritizeSequence(recommendationAggregate),
  ];
}
