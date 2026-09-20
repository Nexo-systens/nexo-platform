import type { ExecutiveDiagnosis, RecommendationReferenceCategory } from "@/efos/application/executive-diagnosis";
import { traceRecommendationReference } from "@/efos/application/executive-diagnosis";
import {
  resolveRecommendationReviewStatus,
  type DiagnosisReview,
  type RecommendationReviewStatusResult,
} from "@/efos/application/diagnosis-review";
import type { Decision } from "@/efos/domain";

import { resolveRecommendationStructuralShape } from "./resolveRecommendationStructuralShape";
import { deriveRecommendationFingerprint } from "./deriveRecommendationFingerprint";

/**
 * Mission 152 — Production Recommendation-to-Decision Learning Loop
 * (Etapa 3).
 *
 * **Achado da auditoria obrigatória**: reconstruir "de onde veio esta
 * Decision" hoje exige orquestrar manualmente 3 chamadas separadas —
 * `traceRecommendationReference()` (D-082), `resolveRecommendationStructuralShape()`
 * +`deriveRecommendationFingerprint()` (D-083), e opcionalmente
 * `resolveRecommendationReviewStatus()` (esta missão) — sempre na
 * mesma ordem, para o mesmo par `Decision`+`ExecutiveDiagnosis`. Esta
 * função é a composição pura dessas 3 chamadas — nunca uma segunda
 * implementação, apenas orquestração (Etapa 15 da missão: "não copiar
 * a estrutura automaticamente, derivar da auditoria").
 *
 * **Vocabulário fechado de `outcome`** — cada valor responde
 * honestamente por que a reconstrução foi ou não possível, nunca um
 * booleano opaco:
 * - `NO_RECOMMENDATION_CITED` — `decision.basedOnRecommendationId`
 *   ausente; uma `Decision` sem Recommendation citada continua
 *   completamente legítima (Etapa 1.I da missão).
 * - `DIAGNOSIS_UNAVAILABLE` — a `Decision` cita uma Recommendation,
 *   mas o `ExecutiveDiagnosis` correspondente não foi fornecido a esta
 *   função (o chamador é responsável por buscá-lo primeiro,
 *   `getExecutiveDiagnosisById()`, mesma disciplina de nunca acessar
 *   Supabase dentro de uma função pura).
 * - `DIAGNOSIS_MISMATCH` — o `ExecutiveDiagnosis` fornecido não é o
 *   mesmo referenciado por `decision.basedOnDiagnosisId` (Etapa 5 da
 *   missão: "Decision de Diagnosis A nunca pode apontar para
 *   Recommendation de Diagnosis B" — mesmo que, por coincidência, o
 *   MESMO `recommendationId` exista em ambos os diagnósticos, já que
 *   ids de item são gerados pelo modelo por diagnóstico, sem garantia
 *   de unicidade global). Esta função NUNCA confia silenciosamente no
 *   diagnóstico que o chamador passou — sempre revalida a identidade.
 * - `RECOMMENDATION_NOT_FOUND` — o diagnóstico correto foi fornecido, mas o id
 *   citado não corresponde a nenhum item real dele — nunca deveria
 *   acontecer para uma `Decision` real (a Server Action já valida
 *   isso na escrita, D-082), mas esta função RE-VERIFICA na leitura,
 *   nunca confia cegamente no que foi persistido.
 * - `TRACEABLE` — reconstrução completa e bem-sucedida.
 *
 * Pura — nenhum acesso a Supabase/banco/relógio, nenhuma IA, nenhum
 * embedding/scoring.
 */
export const DECISION_RECOMMENDATION_TRACE_OUTCOMES = [
  "NO_RECOMMENDATION_CITED",
  "DIAGNOSIS_UNAVAILABLE",
  "DIAGNOSIS_MISMATCH",
  "RECOMMENDATION_NOT_FOUND",
  "TRACEABLE",
] as const;
export type DecisionRecommendationTraceOutcome = (typeof DECISION_RECOMMENDATION_TRACE_OUTCOMES)[number];

export interface DecisionRecommendationTrace {
  readonly outcome: DecisionRecommendationTraceOutcome;
  readonly decisionId: string;
  readonly companyId: string;
  readonly recommendationId?: string;
  readonly diagnosisId?: string;
  readonly recommendationCategory?: RecommendationReferenceCategory;
  readonly recommendationStatement?: string;
  readonly fingerprint?: string;
  readonly reviewStatus?: RecommendationReviewStatusResult;
  readonly reason: string;
}

export function traceDecisionRecommendation(
  decision: Decision,
  diagnosis: ExecutiveDiagnosis | undefined,
  review?: DiagnosisReview
): DecisionRecommendationTrace {
  const base = { decisionId: decision.id, companyId: decision.companyId };

  if (!decision.basedOnRecommendationId) {
    return {
      ...base,
      outcome: "NO_RECOMMENDATION_CITED",
      reason: "Esta Decision não cita nenhuma Recommendation específica — julgamento humano independente, sempre uma origem legítima.",
    };
  }

  if (!diagnosis) {
    return {
      ...base,
      outcome: "DIAGNOSIS_UNAVAILABLE",
      recommendationId: decision.basedOnRecommendationId,
      diagnosisId: decision.basedOnDiagnosisId,
      reason: "A Decision cita uma Recommendation, mas o ExecutiveDiagnosis correspondente não foi fornecido para reconstrução.",
    };
  }

  if (decision.basedOnDiagnosisId !== undefined && diagnosis.id !== decision.basedOnDiagnosisId) {
    return {
      ...base,
      outcome: "DIAGNOSIS_MISMATCH",
      recommendationId: decision.basedOnRecommendationId,
      diagnosisId: decision.basedOnDiagnosisId,
      reason: `O ExecutiveDiagnosis fornecido ("${diagnosis.id}") não é o mesmo referenciado por esta Decision ("${decision.basedOnDiagnosisId}") — uma Recommendation de outro diagnóstico nunca é aceita como lineage válida, mesmo que o id coincida.`,
    };
  }

  const trace = traceRecommendationReference(diagnosis, decision.basedOnRecommendationId);
  if (!trace) {
    return {
      ...base,
      outcome: "RECOMMENDATION_NOT_FOUND",
      recommendationId: decision.basedOnRecommendationId,
      diagnosisId: decision.basedOnDiagnosisId,
      reason: "O recommendationId citado não corresponde a nenhum item real do diagnóstico fornecido — inconsistência nunca esperada para uma Decision real (a escrita já validou isso), mas nunca assumida silenciosamente na leitura.",
    };
  }

  const shape = resolveRecommendationStructuralShape(diagnosis, decision.basedOnRecommendationId, decision.type, decision.priority);
  const fingerprint = shape ? deriveRecommendationFingerprint(shape) : undefined;
  const reviewStatus = resolveRecommendationReviewStatus(decision.basedOnRecommendationId, review);

  return {
    ...base,
    outcome: "TRACEABLE",
    recommendationId: decision.basedOnRecommendationId,
    diagnosisId: decision.basedOnDiagnosisId,
    recommendationCategory: trace.category,
    recommendationStatement: trace.statement,
    fingerprint,
    reviewStatus,
    reason: "Lineage completo reconstruído: Decision → Recommendation real → fingerprint estrutural, sem nenhum dado fabricado.",
  };
}
