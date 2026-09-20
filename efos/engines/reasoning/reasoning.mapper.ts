import type {
  AuditTrail,
  Provenance,
  Reasoning,
  ReasoningAggregate,
} from "@/efos/domain";

import { REASONING_ENGINE_CONSTANTS } from "./reasoning.constants";
import type { ReasoningDraft } from "./reasoning.types";

/**
 * Mapper do Reasoning Engine. Responsavel exclusivamente por converter
 * os rascunhos produzidos pelo builder (reasoning.builder.ts) no
 * contrato oficial de saida (ReasoningAggregate, efos/domain) —
 * nenhuma regra de inferencia acontece aqui.
 */

function buildProvenance(source: string): Provenance {
  // Confianca fixa nesta fase: o Engine infere deterministicamente a
  // partir do que recebeu, nao avalia a qualidade do dado de entrada.
  // Distinta de `Reasoning.confidence` (ReasoningConfidence,
  // consolidada dos Contexts combinados) — ver reasoning.builder.ts e
  // docs/DECISIONS.md D-009.
  return { source, confidence: { value: 100, level: "very_high" } };
}

function buildAuditTrail(timestamp: string): AuditTrail {
  return { createdAt: timestamp, updatedAt: timestamp, version: 1 };
}

function buildReasoningId(financialModelId: string, key: string): string {
  return `${REASONING_ENGINE_CONSTANTS.idPrefix}-${financialModelId}-${key}`;
}

export function mapDraftsToAggregate(
  companyId: string,
  financialModelId: string,
  drafts: readonly ReasoningDraft[]
): ReasoningAggregate {
  const timestamp = new Date().toISOString();
  const provenance = buildProvenance(REASONING_ENGINE_CONSTANTS.name);
  const audit = buildAuditTrail(timestamp);

  const reasonings: Reasoning[] = drafts.map((draft) => ({
    id: buildReasoningId(financialModelId, draft.key),
    companyId,
    type: draft.type,
    confidence: draft.confidence,
    title: draft.title,
    description: draft.description,
    contexts: draft.contextIds,
    evidences: draft.evidenceIds,
    supportingData: draft.supportingData,
    provenance,
    audit,
  }));

  return { companyId, financialModelId, reasonings };
}
