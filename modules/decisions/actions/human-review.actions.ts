"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/modules/auth/services/auth.service";
import { getCompanyById } from "@/modules/companies/services/company.service";
import { buildDiagnosisReview, type BuildDiagnosisReviewInput } from "@/modules/decisions/lib/buildDiagnosisReview";
import {
  saveDiagnosisReview,
  verifyDiagnosisBelongsToCompany,
  type PersistedDiagnosisReview,
} from "@/modules/decisions/services/diagnosis-review-persistence.service";
import {
  saveHumanDecision,
  verifyReviewBelongsToCompany,
  type PersistedDecision,
} from "@/modules/decisions/services/decision-persistence.service";
import { getExecutiveDiagnosisById } from "@/modules/decisions/services/executive-diagnosis-persistence.service";
import { createHumanDecision } from "@/efos/application/decision-lifecycle/createHumanDecision";
import type { CreateHumanDecisionCommand } from "@/efos/application/decision-lifecycle/CreateHumanDecisionCommand";
import { traceRecommendationReference } from "@/efos/application/executive-diagnosis";
import type { DecisionType, RecommendationConfidence, RecommendationPriority } from "@/efos/domain";

/**
 * Mission 125/126 — Human Decision Lifecycle Activation & Persistence.
 * Primeira conexão real entre o contrato `ExecutiveDiagnosis →
 * DiagnosisReview → createHumanDecision()` (Missions 115/123/124) e
 * persistência real (`public.executive_diagnoses`/`diagnosis_reviews`/
 * `decisions`, D-066), sem alterar as fronteiras de D-011/D-059/D-060/
 * D-063/D-064/D-065.
 *
 * **Fluxo obrigatório (Mission 126, Etapa 6/7)**: Client → Server
 * Action → resolve usuário autenticado → valida `DiagnosisReview` →
 * verifica acesso à Company → persiste → devolve resultado persistido.
 * Nunca: Client → insert direto no Supabase (nenhum client-side
 * Supabase é usado por esta ativação).
 *
 * **Identidade humana (D-065)**: `reviewedBy`/`humanActorId` nunca são
 * aceitos do client — sempre resolvidos aqui via `getCurrentUser()`.
 * **Autorização (Etapa 8)**: toda chamada verifica acesso à Company
 * (`getCompanyById()`, já filtrado por RLS — `null` = sem acesso) antes
 * de qualquer escrita; `diagnosisId`/`reviewId` fornecidos são sempre
 * confirmados como pertencentes à mesma Company, nunca tratados como
 * autorização por si só.
 */

export interface SubmitDiagnosisReviewInput extends BuildDiagnosisReviewInput {
  readonly companyId: string;
}

export type SubmitDiagnosisReviewResult =
  | { readonly success: true; readonly review: PersistedDiagnosisReview }
  | { readonly success: false; readonly error: string; readonly errors?: readonly string[] };

/**
 * `submitDiagnosisReviewAction()` — cria e persiste um
 * `DiagnosisReview` real a partir do julgamento explícito de um humano
 * autenticado, com acesso confirmado à empresa dona do diagnóstico.
 */
export async function submitDiagnosisReviewAction(
  input: SubmitDiagnosisReviewInput
): Promise<SubmitDiagnosisReviewResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login novamente." };
  }

  const built = buildDiagnosisReview(input, user.id, randomUUID(), new Date().toISOString());
  if (!built.success) {
    return { success: false, error: "Revisão inválida.", errors: built.error.errors };
  }

  const company = await getCompanyById(input.companyId);
  if (!company) {
    return { success: false, error: "Empresa não encontrada ou sem acesso." };
  }

  const diagnosisError = await verifyDiagnosisBelongsToCompany(input.diagnosisId, input.companyId);
  if (diagnosisError) {
    return { success: false, error: diagnosisError.message };
  }

  const persisted = await saveDiagnosisReview(built.value, input.companyId, user.id);
  // Mission 127, Etapa 8: "recarregar estado canônico" — revalida a
  // página da empresa para que a próxima leitura (Server Component)
  // busque a revisão real do banco, nunca confiando só no estado local
  // do client. Mesmo padrão já usado por `modules/documents/actions/`.
  revalidatePath(`/companies/${input.companyId}`);
  return { success: true, review: persisted };
}

export interface CreateHumanDecisionInput {
  readonly companyId: string;
  readonly type: DecisionType;
  readonly priority: RecommendationPriority;
  readonly confidence: RecommendationConfidence;
  readonly title: string;
  readonly description: string;
  readonly rationale: string;
  readonly diagnosisId?: string;
  readonly reviewId?: string;
  readonly recommendationId?: string;
  readonly recommendations?: readonly string[];
  readonly reasonings?: readonly string[];
  readonly contexts?: readonly string[];
  readonly evidences?: readonly string[];
  readonly supportingData?: Readonly<Record<string, unknown>>;
}

export type CreateHumanDecisionResult =
  | { readonly success: true; readonly decision: PersistedDecision }
  | { readonly success: false; readonly error: string; readonly errors?: readonly string[] };

/**
 * `createHumanDecisionAction()` — único ponto de aplicação real
 * autorizado a produzir e persistir uma `Decision` humana.
 * `humanActorId` nunca vem do `input` do cliente — é sempre `user.id`
 * resolvido pela sessão server-side.
 */
export async function createHumanDecisionAction(
  input: CreateHumanDecisionInput
): Promise<CreateHumanDecisionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login novamente." };
  }

  const company = await getCompanyById(input.companyId);
  if (!company) {
    return { success: false, error: "Empresa não encontrada ou sem acesso." };
  }

  if (input.diagnosisId) {
    const diagnosisError = await verifyDiagnosisBelongsToCompany(input.diagnosisId, input.companyId);
    if (diagnosisError) {
      return { success: false, error: diagnosisError.message };
    }
  }

  if (input.reviewId) {
    const reviewError = await verifyReviewBelongsToCompany(input.reviewId, input.companyId);
    if (reviewError) {
      return { success: false, error: reviewError.message };
    }
  }

  // Mission 150 — Executive Recommendation → Human Decision
  // Traceability (D-082). `recommendationId` nunca é aceito sem
  // `diagnosisId` (não há como verificar a que diagnóstico pertence);
  // quando presente, o diagnóstico real é buscado (nunca confiando só
  // no id fornecido pelo client) e `traceRecommendationReference()`
  // (D-082) confirma que o id realmente existe entre os itens desse
  // diagnóstico — o mesmo padrão de `validateKnowledgeReferences()`
  // (D-081, Mission 149) aplicado à nova referência.
  if (input.recommendationId) {
    if (!input.diagnosisId) {
      return {
        success: false,
        error: "recommendationId informado sem diagnosisId — não é possível verificar a que diagnóstico a recomendação pertence.",
      };
    }
    const diagnosis = await getExecutiveDiagnosisById(input.diagnosisId);
    if (!diagnosis || diagnosis.companyId !== input.companyId) {
      return { success: false, error: "O diagnóstico informado não existe ou não pertence a esta empresa." };
    }
    const trace = traceRecommendationReference(diagnosis.diagnosis, input.recommendationId);
    if (!trace) {
      return {
        success: false,
        error: "recommendationId informado não corresponde a nenhum item real do diagnóstico — nenhuma referência inventada é aceita.",
      };
    }
  }

  const command: CreateHumanDecisionCommand = {
    humanActorId: user.id,
    diagnosisId: input.diagnosisId,
    reviewId: input.reviewId,
    recommendationId: input.recommendationId,
    companyId: input.companyId,
    type: input.type,
    priority: input.priority,
    confidence: input.confidence,
    title: input.title,
    description: input.description,
    rationale: input.rationale,
    recommendations: input.recommendations,
    reasonings: input.reasonings,
    contexts: input.contexts,
    evidences: input.evidences,
    supportingData: input.supportingData,
  };

  const result = createHumanDecision(command, randomUUID(), new Date().toISOString());
  if (!result.success) {
    return { success: false, error: "Comando de decisão inválido.", errors: result.error.errors };
  }

  const persisted = await saveHumanDecision(result.value);
  revalidatePath(`/companies/${input.companyId}`);
  return { success: true, decision: persisted };
}
