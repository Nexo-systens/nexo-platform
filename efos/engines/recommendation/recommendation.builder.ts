import type {
  Context,
  ContextAggregate,
  Reasoning,
  ReasoningAggregate,
  RecommendationConfidence,
  RecommendationPriority,
} from "@/efos/domain";

import {
  CONTEXT_SEVERITY_SCALE,
  IMPROVE_CASH_FLOW_REASONING_TYPE,
  REASONING_CONFIDENCE_SCALE,
  RECOMMENDATION_CONFIDENCE_SCALE,
  RECOMMENDATION_PRIORITY_SCALE,
  REDUCE_COSTS_REASONING_TYPE,
  REVIEW_OPERATIONS_REASONING_TYPE,
} from "./recommendation.constants";
import type { RecommendationDraft } from "./recommendation.types";

/**
 * Builder do Recommendation Engine. Centraliza toda regra de
 * recomendação — nenhuma regra vive em recommendation.engine.ts. Cada
 * função `detect*` lê `ReasoningAggregate` (para encontrar o
 * Reasoning de origem) e `ContextAggregate` (para derivar a
 * prioridade a partir da severidade dos Contexts referenciados pelo
 * Reasoning) e, se o Reasoning reconhecido existir, produz um
 * `RecommendationDraft`; caso contrário retorna `[]`. Nunca decide
 * qual recomendação será executada, nunca ordena roadmap executivo,
 * nunca executa ação, nunca calcula valor monetário. Não usa IA sob
 * nenhuma circunstância.
 *
 * As regras casam por `Reasoning.type` (`ReasoningType`, contrato
 * oficial do Domain — `efos/domain/enums/reasoning.ts`), nunca pelo id
 * interno de cada Reasoning (esquema privado do Reasoning Engine,
 * `reasoning.mapper.ts`) — evita acoplamento com detalhes de
 * implementação de outro Engine (D-002).
 */

function findReasoningByType(
  reasoningAggregate: ReasoningAggregate,
  type: string
): Reasoning | undefined {
  return reasoningAggregate.reasonings.find(
    (reasoning) => reasoning.type === type
  );
}

function findContextsByIds(
  contextAggregate: ContextAggregate,
  ids: readonly string[]
): Context[] {
  return contextAggregate.contexts.filter((context) =>
    ids.includes(context.id)
  );
}

/** Traduz a confiança de um Reasoning (ReasoningConfidence) para o vocabulário próprio de RecommendationConfidence — mesma posição ordinal, enum distinto (D-010). */
function translateConfidence(reasoning: Reasoning): RecommendationConfidence {
  const rank = REASONING_CONFIDENCE_SCALE.indexOf(reasoning.confidence);
  return RECOMMENDATION_CONFIDENCE_SCALE[rank];
}

/**
 * Prioridade derivada da severidade mais grave entre os Contexts que
 * sustentam o Reasoning de origem (via `Reasoning.contexts`,
 * resolvidos contra `ContextAggregate`) — traduzida para o vocabulário
 * próprio `RecommendationPriority`. Sem Contexts resolvidos (não
 * deveria ocorrer com entrada consistente), a prioridade cai para
 * `"medium"` — nunca inventa severidade.
 */
function priorityFromContexts(contexts: readonly Context[]): RecommendationPriority {
  if (contexts.length === 0) return "medium";

  const maxRank = Math.max(
    ...contexts.map((context) => CONTEXT_SEVERITY_SCALE.indexOf(context.severity))
  );
  return RECOMMENDATION_PRIORITY_SCALE[maxRank];
}

export function detectImproveCashFlow(
  reasoningAggregate: ReasoningAggregate,
  contextAggregate: ContextAggregate
): RecommendationDraft[] {
  const reasoning = findReasoningByType(
    reasoningAggregate,
    IMPROVE_CASH_FLOW_REASONING_TYPE
  );
  if (!reasoning) return [];

  const contexts = findContextsByIds(contextAggregate, reasoning.contexts);

  return [
    {
      key: "improve-cash-flow",
      type: "improve_cash_flow",
      priority: priorityFromContexts(contexts),
      confidence: translateConfidence(reasoning),
      title: "Reforçar geração de caixa operacional",
      description: `A conclusão "${reasoning.title}" indica risco financeiro de curto prazo — recomenda-se reforçar a geração de caixa operacional.`,
      expectedImpact: "Melhora esperada na liquidez operacional.",
      reasoningIds: [reasoning.id],
      contextIds: reasoning.contexts,
      evidenceIds: reasoning.evidences,
      supportingData: {
        reasoningType: reasoning.type,
        sourceContextCount: contexts.length,
      },
    },
  ];
}

export function detectReduceCosts(
  reasoningAggregate: ReasoningAggregate,
  contextAggregate: ContextAggregate
): RecommendationDraft[] {
  const reasoning = findReasoningByType(
    reasoningAggregate,
    REDUCE_COSTS_REASONING_TYPE
  );
  if (!reasoning) return [];

  const contexts = findContextsByIds(contextAggregate, reasoning.contexts);

  return [
    {
      key: "reduce-costs",
      type: "reduce_costs",
      priority: priorityFromContexts(contexts),
      confidence: translateConfidence(reasoning),
      title: "Revisar estrutura de custos",
      description: `A conclusão "${reasoning.title}" indica deterioração de margem — recomenda-se revisar a estrutura de custos.`,
      expectedImpact: "Melhora esperada na margem operacional.",
      reasoningIds: [reasoning.id],
      contextIds: reasoning.contexts,
      evidenceIds: reasoning.evidences,
      supportingData: {
        reasoningType: reasoning.type,
        sourceContextCount: contexts.length,
      },
    },
  ];
}

export function detectReviewOperations(
  reasoningAggregate: ReasoningAggregate,
  contextAggregate: ContextAggregate
): RecommendationDraft[] {
  const reasoning = findReasoningByType(
    reasoningAggregate,
    REVIEW_OPERATIONS_REASONING_TYPE
  );
  if (!reasoning) return [];

  const contexts = findContextsByIds(contextAggregate, reasoning.contexts);

  return [
    {
      key: "review-operations",
      type: "review_operations",
      priority: priorityFromContexts(contexts),
      confidence: translateConfidence(reasoning),
      title: "Revisar operações em múltiplas frentes financeiras",
      description: `A conclusão "${reasoning.title}" indica risco simultâneo em caixa e rentabilidade — recomenda-se uma revisão ampla das operações.`,
      expectedImpact: "Redução esperada do risco financeiro combinado (caixa e rentabilidade).",
      reasoningIds: [reasoning.id],
      contextIds: reasoning.contexts,
      evidenceIds: reasoning.evidences,
      supportingData: {
        reasoningType: reasoning.type,
        sourceContextCount: contexts.length,
      },
    },
  ];
}

export function detectRecommendations(
  reasoningAggregate: ReasoningAggregate,
  contextAggregate: ContextAggregate
): RecommendationDraft[] {
  return [
    ...detectImproveCashFlow(reasoningAggregate, contextAggregate),
    ...detectReduceCosts(reasoningAggregate, contextAggregate),
    ...detectReviewOperations(reasoningAggregate, contextAggregate),
  ];
}
