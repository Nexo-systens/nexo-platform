import type {
  AuditTrail,
  Decision,
  DecisionAggregate,
  Provenance,
} from "@/efos/domain";

import { DECISION_ENGINE_CONSTANTS } from "./decision.constants";
import type { DecisionDraft } from "./decision.types";

/**
 * Mapper do Decision Engine. Responsavel exclusivamente por converter
 * os rascunhos produzidos pelo builder (decision.builder.ts) no
 * contrato oficial de saida (DecisionAggregate, efos/domain) — nenhuma
 * regra de priorizacao acontece aqui.
 */

function buildProvenance(source: string): Provenance {
  // Confianca fixa nesta fase: o Engine prioriza deterministicamente a
  // partir do que recebeu, nao avalia a qualidade do dado de entrada.
  // Distinta de `Decision.confidence` (RecommendationConfidence,
  // traduzida/consolidada das Recommendations combinadas) — ver
  // decision.builder.ts e docs/DECISIONS.md D-011.
  return { source, confidence: { value: 100, level: "very_high" } };
}

function buildAuditTrail(timestamp: string): AuditTrail {
  return { createdAt: timestamp, updatedAt: timestamp, version: 1 };
}

function buildDecisionId(financialModelId: string, key: string): string {
  return `${DECISION_ENGINE_CONSTANTS.idPrefix}-${financialModelId}-${key}`;
}

export function mapDraftsToAggregate(
  companyId: string,
  financialModelId: string,
  drafts: readonly DecisionDraft[]
): DecisionAggregate {
  const timestamp = new Date().toISOString();
  const provenance = buildProvenance(DECISION_ENGINE_CONSTANTS.name);
  const audit = buildAuditTrail(timestamp);

  const decisions: Decision[] = drafts.map((draft) => ({
    id: buildDecisionId(financialModelId, draft.key),
    companyId,
    type: draft.type,
    priority: draft.priority,
    confidence: draft.confidence,
    title: draft.title,
    description: draft.description,
    rationale: draft.rationale,
    recommendations: draft.recommendationIds,
    reasonings: draft.reasoningIds,
    contexts: draft.contextIds,
    evidences: draft.evidenceIds,
    supportingData: draft.supportingData,
    provenance,
    audit,
  }));

  return { companyId, financialModelId, decisions };
}
