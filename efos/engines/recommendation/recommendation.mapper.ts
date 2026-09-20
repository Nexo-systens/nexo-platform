import type {
  AuditTrail,
  Provenance,
  Recommendation,
  RecommendationAggregate,
} from "@/efos/domain";

import { RECOMMENDATION_ENGINE_CONSTANTS } from "./recommendation.constants";
import type { RecommendationDraft } from "./recommendation.types";

/**
 * Mapper do Recommendation Engine. Responsavel exclusivamente por
 * converter os rascunhos produzidos pelo builder
 * (recommendation.builder.ts) no contrato oficial de saida
 * (RecommendationAggregate, efos/domain) — nenhuma regra de
 * recomendacao acontece aqui.
 */

function buildProvenance(source: string): Provenance {
  // Confianca fixa nesta fase: o Engine recomenda deterministicamente
  // a partir do que recebeu, nao avalia a qualidade do dado de
  // entrada. Distinta de `Recommendation.confidence`
  // (RecommendationConfidence, traduzida do Reasoning de origem) — ver
  // recommendation.builder.ts e docs/DECISIONS.md D-010.
  return { source, confidence: { value: 100, level: "very_high" } };
}

function buildAuditTrail(timestamp: string): AuditTrail {
  return { createdAt: timestamp, updatedAt: timestamp, version: 1 };
}

function buildRecommendationId(financialModelId: string, key: string): string {
  return `${RECOMMENDATION_ENGINE_CONSTANTS.idPrefix}-${financialModelId}-${key}`;
}

export function mapDraftsToAggregate(
  companyId: string,
  financialModelId: string,
  drafts: readonly RecommendationDraft[]
): RecommendationAggregate {
  const timestamp = new Date().toISOString();
  const provenance = buildProvenance(RECOMMENDATION_ENGINE_CONSTANTS.name);
  const audit = buildAuditTrail(timestamp);

  const recommendations: Recommendation[] = drafts.map((draft) => ({
    id: buildRecommendationId(financialModelId, draft.key),
    companyId,
    type: draft.type,
    priority: draft.priority,
    confidence: draft.confidence,
    title: draft.title,
    description: draft.description,
    expectedImpact: draft.expectedImpact,
    reasonings: draft.reasoningIds,
    contexts: draft.contextIds,
    evidences: draft.evidenceIds,
    supportingData: draft.supportingData,
    provenance,
    audit,
  }));

  return { companyId, financialModelId, recommendations };
}
