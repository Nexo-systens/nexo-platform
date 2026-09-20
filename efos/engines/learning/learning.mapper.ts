import type {
  AuditTrail,
  LearningAggregate,
  LearningRecord,
  Provenance,
} from "@/efos/domain";

import { LEARNING_ENGINE_CONSTANTS } from "./learning.constants";
import type { LearningDraft } from "./learning.types";

/**
 * Mapper do Learning Engine. Responsavel exclusivamente por converter
 * os rascunhos produzidos pelo builder (learning.builder.ts) no
 * contrato oficial de saida (LearningAggregate, efos/domain) —
 * nenhuma regra de consolidacao acontece aqui.
 */

function buildProvenance(source: string): Provenance {
  // Confianca fixa nesta fase: o Engine registra deterministicamente a
  // partir do que recebeu, nao avalia a qualidade do dado de entrada.
  // Distinta de `LearningRecord.confidence` (LearningConfidence,
  // traduzida da Reasoning/Decision de origem) — ver
  // learning.builder.ts e docs/DECISIONS.md D-013.
  return { source, confidence: { value: 100, level: "very_high" } };
}

function buildAuditTrail(timestamp: string): AuditTrail {
  return { createdAt: timestamp, updatedAt: timestamp, version: 1 };
}

function buildLearningRecordId(financialModelId: string, key: string): string {
  return `${LEARNING_ENGINE_CONSTANTS.idPrefix}-${financialModelId}-${key}`;
}

export function mapDraftsToAggregate(
  companyId: string,
  financialModelId: string,
  drafts: readonly LearningDraft[]
): LearningAggregate {
  const timestamp = new Date().toISOString();
  const provenance = buildProvenance(LEARNING_ENGINE_CONSTANTS.name);
  const audit = buildAuditTrail(timestamp);

  const learnings: LearningRecord[] = drafts.map((draft) => ({
    id: buildLearningRecordId(financialModelId, draft.key),
    companyId,
    type: draft.type,
    confidence: draft.confidence,
    title: draft.title,
    description: draft.description,
    source: draft.source,
    decisions: draft.decisionIds,
    recommendations: draft.recommendationIds,
    reasonings: draft.reasoningIds,
    contexts: draft.contextIds,
    evidences: draft.evidenceIds,
    supportingData: draft.supportingData,
    provenance,
    audit,
  }));

  return { companyId, financialModelId, learnings };
}
