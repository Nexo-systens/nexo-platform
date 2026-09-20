import type {
  ContextSeverity,
  Evidence,
  EvidenceAggregate,
  EvidenceCategory,
  EvidenceConfidence,
} from "@/efos/domain";

import {
  ADVERSE_EVIDENCE_TYPES,
  CASH_PRESSURE_EVIDENCE_CATEGORIES,
  CONFIDENCE_SCALE,
  MINIMUM_EVIDENCES_FOR_CONTEXT,
  PROFITABILITY_EVIDENCE_CATEGORIES,
  SEVERITY_SCALE,
} from "./context.constants";
import type { ContextDraft } from "./context.types";

/**
 * Builder do Context Engine. Centraliza toda regra de agrupamento —
 * nenhuma regra vive em context.engine.ts. Cada funcao `detect*` lê
 * `EvidenceAggregate` (o único agregado do qual as regras atuais
 * precisam — categoria e tipo de Evidence já bastam para identificar
 * as situações compostas cobertas nesta fase) e, se um número
 * suficiente de Evidences relacionadas estiver presente, produz um
 * `ContextDraft`; caso contrário retorna `[]`. Nunca interpreta causa,
 * nunca infere, nunca prevê, nunca recomenda — apenas agrupa
 * Evidences já produzidas por categoria/tipo. Não usa IA sob nenhuma
 * circunstância.
 *
 * As regras casam por `Evidence.category` (`EvidenceCategory`,
 * contrato oficial do Domain — `efos/domain/enums/evidence.ts`), nunca
 * pelo id interno de cada Evidence (esquema privado do Evidence
 * Engine, `evidence.mapper.ts`) — evita acoplamento com detalhes de
 * implementação de outro Engine (D-002).
 */

function severityRank(severity: ContextSeverity): number {
  return SEVERITY_SCALE.indexOf(severity);
}

function confidenceRank(confidence: EvidenceConfidence): number {
  return CONFIDENCE_SCALE.indexOf(confidence);
}

/** Severidade mais grave entre as Evidences agrupadas — a situação composta é, no mínimo, tão grave quanto seu sintoma mais grave. */
function consolidateSeverity(evidences: readonly Evidence[]): ContextSeverity {
  const maxRank = Math.max(...evidences.map((e) => severityRank(e.severity)));
  return SEVERITY_SCALE[maxRank];
}

/** Confiança mais fraca entre as Evidences agrupadas — o "elo mais fraco" determina o quão fundamentada a situação composta está. */
function consolidateConfidence(
  evidences: readonly Evidence[]
): EvidenceConfidence {
  const minRank = Math.min(
    ...evidences.map((e) => confidenceRank(e.confidence))
  );
  return CONFIDENCE_SCALE[minRank];
}

function findAdverseEvidencesByCategory(
  evidenceAggregate: EvidenceAggregate,
  categories: readonly EvidenceCategory[]
): Evidence[] {
  return evidenceAggregate.evidences.filter(
    (evidence) =>
      categories.includes(evidence.category) &&
      (ADVERSE_EVIDENCE_TYPES as readonly string[]).includes(evidence.type)
  );
}

export function detectCashPressure(
  evidenceAggregate: EvidenceAggregate
): ContextDraft[] {
  const matched = findAdverseEvidencesByCategory(
    evidenceAggregate,
    CASH_PRESSURE_EVIDENCE_CATEGORIES
  );
  if (matched.length < MINIMUM_EVIDENCES_FOR_CONTEXT) return [];

  return [
    {
      key: "cash-pressure",
      type: "cash_pressure",
      severity: consolidateSeverity(matched),
      confidence: consolidateConfidence(matched),
      title: "Pressão de caixa",
      description: `${matched.length} evidências relacionadas a liquidez, capital de giro e fluxo de caixa apontam pressão de caixa: ${matched.map((e) => e.title).join("; ")}.`,
      evidenceIds: matched.map((e) => e.id),
      supportingData: {
        evidenceCount: matched.length,
        categories: [...new Set(matched.map((e) => e.category))],
        minimumRequired: MINIMUM_EVIDENCES_FOR_CONTEXT,
      },
    },
  ];
}

export function detectProfitabilityPressure(
  evidenceAggregate: EvidenceAggregate
): ContextDraft[] {
  const matched = findAdverseEvidencesByCategory(
    evidenceAggregate,
    PROFITABILITY_EVIDENCE_CATEGORIES
  );
  if (matched.length < MINIMUM_EVIDENCES_FOR_CONTEXT) return [];

  return [
    {
      key: "profitability-pressure",
      type: "profitability",
      severity: consolidateSeverity(matched),
      confidence: consolidateConfidence(matched),
      title: "Rentabilidade comprometida",
      description: `${matched.length} margens negativas simultâneas apontam rentabilidade comprometida: ${matched.map((e) => e.title).join("; ")}.`,
      evidenceIds: matched.map((e) => e.id),
      supportingData: {
        evidenceCount: matched.length,
        categories: [...new Set(matched.map((e) => e.category))],
        minimumRequired: MINIMUM_EVIDENCES_FOR_CONTEXT,
      },
    },
  ];
}

export function detectContexts(
  evidenceAggregate: EvidenceAggregate
): ContextDraft[] {
  return [
    ...detectCashPressure(evidenceAggregate),
    ...detectProfitabilityPressure(evidenceAggregate),
  ];
}
