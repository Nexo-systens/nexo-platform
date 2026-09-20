import type {
  AuditTrail,
  Evidence,
  EvidenceAggregate,
  Provenance,
} from "@/efos/domain";

import { EVIDENCE_ENGINE_CONSTANTS } from "./evidence.constants";
import type { EvidenceDraft } from "./evidence.types";

/**
 * Mapper do Evidence Engine. Responsavel exclusivamente por converter
 * os rascunhos produzidos pelo builder (evidence.builder.ts) no
 * contrato oficial de saida (EvidenceAggregate, efos/domain) — nenhuma
 * regra de deteccao acontece aqui.
 */

function buildProvenance(source: string): Provenance {
  // Confianca fixa nesta fase: o Engine aplica regras deterministicas
  // sobre dados ja calculados, nao avalia a qualidade do dado de
  // entrada. Distinta de `Evidence.confidence` (EvidenceConfidence),
  // que descreve o quao fundamentado o fato em si esta — ver
  // evidence.builder.ts e docs/DECISIONS.md D-007.
  return { source, confidence: { value: 100, level: "very_high" } };
}

function buildAuditTrail(timestamp: string): AuditTrail {
  return { createdAt: timestamp, updatedAt: timestamp, version: 1 };
}

function buildEvidenceId(financialModelId: string, key: string): string {
  return `${EVIDENCE_ENGINE_CONSTANTS.idPrefix}-${financialModelId}-${key}`;
}

export function mapDraftsToAggregate(
  companyId: string,
  financialModelId: string,
  drafts: readonly EvidenceDraft[]
): EvidenceAggregate {
  const timestamp = new Date().toISOString();
  const provenance = buildProvenance(EVIDENCE_ENGINE_CONSTANTS.name);
  const audit = buildAuditTrail(timestamp);

  const evidences: Evidence[] = drafts.map((draft) => ({
    id: buildEvidenceId(financialModelId, draft.key),
    companyId,
    type: draft.type,
    category: draft.category,
    severity: draft.severity,
    confidence: draft.confidence,
    title: draft.title,
    description: draft.description,
    supportingData: draft.supportingData,
    sources: draft.sources,
    provenance,
    audit,
    ...(draft.observedPeriod ? { observedPeriod: draft.observedPeriod } : {}),
  }));

  return { companyId, financialModelId, evidences };
}
