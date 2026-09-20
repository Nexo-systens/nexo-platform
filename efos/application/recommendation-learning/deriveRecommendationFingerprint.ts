import { createHash } from "node:crypto";

import type { RecommendationStructuralShape } from "./RecommendationStructuralShape";

/**
 * Deriva um `fingerprint` determinístico a partir da forma estrutural
 * de uma Recommendation (Etapa 3/4) — mesmo princípio exato de
 * `deriveKnowledgeId()` (D-073, `efos/application/knowledge-formation/`):
 * hash SHA-256 de conteúdo canônico, nunca `crypto.randomUUID()`. A
 * MESMA forma estrutural produz sempre o MESMO fingerprint,
 * independentemente de empresa, Decision, ou momento no tempo — a
 * fingerprint representa ESTRUTURA, nunca IDENTIDADE (Etapa 3: "nunca
 * texto livre, valores financeiros, IDs de empresa, IDs de Decision,
 * timestamps, IDs aleatórios").
 *
 * **Company boundary (Etapa 8)**: deliberadamente, `companyId` NUNCA
 * entra no hash — o fingerprint é intencionalmente company-agnostic,
 * para que duas Recommendations estruturalmente idênticas em empresas
 * diferentes produzam o MESMO fingerprint (comprovado pelo cenário Y
 * do teste) — mas os POOLS de evidência permanecem sempre separados,
 * porque `deriveRecommendationOutcomePattern()` (abaixo, neste módulo)
 * sempre exige `companyId` como parâmetro explícito e separado, nunca
 * embutido na fingerprint. Isso deixa claro, na própria assinatura das
 * funções, onde uma futura camada de cross-company learning poderia
 * existir (reaproveitando a MESMA fingerprint através de empresas) —
 * sem implementá-la nesta missão (Etapa 8, proibição explícita).
 *
 * `basisCategories` é ordenado pelo chamador
 * (`resolveRecommendationStructuralShape()`) antes de chegar aqui —
 * esta função nunca reordena, apenas serializa o que recebe (mas o
 * `JSON.stringify` de um array preserva a ordem de entrada, então a
 * ordenação upstream é o que garante que o mesmo CONJUNTO de
 * categorias sempre produz a mesma string canônica).
 */
export function deriveRecommendationFingerprint(shape: RecommendationStructuralShape): string {
  const canonical = JSON.stringify({
    recommendationCategory: shape.recommendationCategory,
    possibleActionKind: shape.possibleActionKind ?? null,
    riskType: shape.riskType ?? null,
    basisCategories: shape.basisCategories,
    decisionType: shape.decisionType,
    decisionPriority: shape.decisionPriority,
  });

  const hex = createHash("sha256").update(canonical).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
