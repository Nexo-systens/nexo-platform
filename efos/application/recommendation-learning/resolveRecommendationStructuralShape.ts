import {
  RECOMMENDATION_REFERENCE_CATEGORIES,
  type ExecutiveDiagnosis,
  type InterpretationBasis,
  type PossibleActionKind,
  type RiskAssessmentType,
} from "@/efos/application/executive-diagnosis";
import type { DecisionType, RecommendationPriority } from "@/efos/domain";

import type { BasisReferenceCategory, RecommendationStructuralShape } from "./RecommendationStructuralShape";

function basisCategoriesOf(basis: InterpretationBasis | undefined): readonly BasisReferenceCategory[] {
  if (!basis) return [];
  const present: BasisReferenceCategory[] = [];
  if ((basis.indicatorIds?.length ?? 0) > 0) present.push("indicator");
  if ((basis.evidenceIds?.length ?? 0) > 0) present.push("evidence");
  if ((basis.contextIds?.length ?? 0) > 0) present.push("context");
  if ((basis.conflictIds?.length ?? 0) > 0) present.push("conflict");
  if ((basis.knowledgeIds?.length ?? 0) > 0) present.push("knowledge");
  return present;
}

/**
 * Localiza um `recommendationId` dentro de um `ExecutiveDiagnosis` real
 * (mesmo mecanismo de `traceRecommendationReference()`, D-082 — reusa
 * `RECOMMENDATION_REFERENCE_CATEGORIES`, nunca uma segunda lista de
 * categorias) e extrai sua forma estrutural — `undefined` honesto
 * quando o id não pertence ao diagnóstico, mesmo princípio de todo
 * `trace*()` desta série (D-081/D-082). Pura, determinística, nenhum
 * acesso a Supabase/banco/relógio, nenhuma IA.
 *
 * `basisCategories` nunca inclui os próprios ids referenciados — só
 * QUAIS das 5 categorias de `InterpretationBasis` (D-080) estão
 * presentes, ordenadas (`BASIS_REFERENCE_CATEGORIES`, construção
 * incremental já em ordem fixa — `.push()` na mesma sequência sempre,
 * nunca precisa de `.sort()` adicional).
 */
export function resolveRecommendationStructuralShape(
  diagnosis: ExecutiveDiagnosis,
  recommendationId: string,
  decisionType: DecisionType,
  decisionPriority: RecommendationPriority
): RecommendationStructuralShape | undefined {
  for (const category of RECOMMENDATION_REFERENCE_CATEGORIES) {
    const items = diagnosis[category] as readonly {
      readonly id: string;
      readonly basis?: InterpretationBasis;
      readonly kind?: PossibleActionKind;
      readonly type?: RiskAssessmentType;
    }[];
    const item = items.find((candidate) => candidate.id === recommendationId);
    if (!item) continue;

    return {
      recommendationCategory: category,
      possibleActionKind: category === "possibleActions" ? item.kind : undefined,
      riskType: category === "risks" ? item.type : undefined,
      basisCategories: basisCategoriesOf(item.basis),
      decisionType,
      decisionPriority,
    };
  }

  return undefined;
}
