import type {
  PossibleActionKind,
  RecommendationReferenceCategory,
  RiskAssessmentType,
} from "@/efos/application/executive-diagnosis";
import type { DecisionType, RecommendationPriority } from "@/efos/domain";

/**
 * Mission 151 — Recommendation Outcome Learning & Cross-Decision
 * Pattern Engine.
 *
 * **Achado da auditoria obrigatória (Etapa 3/4)**: "Recommendations
 * estruturalmente semelhantes" não pode significar similaridade de
 * texto/semântica (embeddings/IA, explicitamente proibidos) — precisa
 * ser um conjunto FECHADO de atributos já presentes no modelo atual,
 * nunca inventados. `InterpretationBasis` (D-059, estendida por D-080)
 * já expõe exatamente essa estrutura: 5 categorias fechadas de
 * referência (`indicatorIds`/`evidenceIds`/`contextIds`/`conflictIds`/
 * `knowledgeIds`) — o que uma Recommendation cita, nunca O QUE ela cita
 * especificamente (nenhum id individual entra na fingerprint, só QUAIS
 * categorias estão presentes). Combinado com a categoria do próprio
 * item (`RecommendationReferenceCategory`, D-082), seu vocabulário
 * fechado específico (`PossibleActionKind`/`RiskAssessmentType`,
 * D-059) quando aplicável, e o `type`/`priority` da `Decision` humana
 * que a escolheu (`DecisionType`/`RecommendationPriority`, D-011) — uma
 * "forma estrutural" completa, sem nenhum texto livre, sem nenhum
 * valor financeiro específico, sem nenhum id de empresa/Decision/
 * timestamp/id aleatório (todos explicitamente proibidos pela Etapa 3).
 */
export const BASIS_REFERENCE_CATEGORIES = ["indicator", "evidence", "context", "conflict", "knowledge"] as const;
export type BasisReferenceCategory = (typeof BASIS_REFERENCE_CATEGORIES)[number];

/**
 * Forma estrutural normalizada de uma Recommendation, pronta para
 * hash (`deriveRecommendationFingerprint()`). `basisCategories` é
 * sempre ordenado (nunca depende da ordem em que os 5 campos de
 * `InterpretationBasis` foram preenchidos). `possibleActionKind`/
 * `riskType` são mutuamente exclusivos por construção — apenas um
 * dos dois (ou nenhum) é preenchido, dependendo de
 * `recommendationCategory`.
 */
export interface RecommendationStructuralShape {
  readonly recommendationCategory: RecommendationReferenceCategory;
  readonly possibleActionKind?: PossibleActionKind;
  readonly riskType?: RiskAssessmentType;
  readonly basisCategories: readonly BasisReferenceCategory[];
  readonly decisionType: DecisionType;
  readonly decisionPriority: RecommendationPriority;
}
