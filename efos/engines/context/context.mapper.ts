import type {
  AuditTrail,
  Context,
  ContextAggregate,
  Provenance,
} from "@/efos/domain";

import { CONTEXT_ENGINE_CONSTANTS } from "./context.constants";
import type { ContextDraft } from "./context.types";

/**
 * Mapper do Context Engine. Responsavel exclusivamente por converter
 * os rascunhos produzidos pelo builder (context.builder.ts) no
 * contrato oficial de saida (ContextAggregate, efos/domain) — nenhuma
 * regra de agrupamento acontece aqui.
 */

function buildProvenance(source: string): Provenance {
  // Confianca fixa nesta fase: o Engine agrupa deterministicamente a
  // partir do que recebeu, nao avalia a qualidade do dado de entrada.
  // Distinta de `Context.confidence` (EvidenceConfidence, consolidada
  // das Evidences agrupadas) — ver context.builder.ts e
  // docs/DECISIONS.md D-008.
  return { source, confidence: { value: 100, level: "very_high" } };
}

function buildAuditTrail(timestamp: string): AuditTrail {
  return { createdAt: timestamp, updatedAt: timestamp, version: 1 };
}

function buildContextId(financialModelId: string, key: string): string {
  return `${CONTEXT_ENGINE_CONSTANTS.idPrefix}-${financialModelId}-${key}`;
}

export function mapDraftsToAggregate(
  companyId: string,
  financialModelId: string,
  drafts: readonly ContextDraft[]
): ContextAggregate {
  const timestamp = new Date().toISOString();
  const provenance = buildProvenance(CONTEXT_ENGINE_CONSTANTS.name);
  const audit = buildAuditTrail(timestamp);

  const contexts: Context[] = drafts.map((draft) => ({
    id: buildContextId(financialModelId, draft.key),
    companyId,
    type: draft.type,
    severity: draft.severity,
    confidence: draft.confidence,
    title: draft.title,
    description: draft.description,
    evidences: draft.evidenceIds,
    supportingData: draft.supportingData,
    provenance,
    audit,
  }));

  return { companyId, financialModelId, contexts };
}
