"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/modules/auth/services/auth.service";
import { getCompanyById } from "@/modules/companies/services/company.service";
import {
  deriveKnowledgeCandidates,
  buildKnowledgeForCandidate,
  deriveKnowledgeCandidatePreviews,
  MINIMUM_DISTINCT_DECISIONS_FOR_KNOWLEDGE,
  type KnowledgeCandidatePreview,
} from "@/efos/application/knowledge-formation";
import type { Knowledge } from "@/efos/domain";
import { getLearningRecordsByCompany } from "@/modules/decisions/services/learning-record-persistence.service";
import { getKnowledgeByCompany, saveKnowledge } from "@/modules/decisions/services/knowledge-persistence.service";

/**
 * Mission 141 — Knowledge Formation & Cross-Decision Learning. Mesmo
 * padrão exato de `learning-derivation.actions.ts` (Mission 140):
 * Client → Server Action → resolve usuário autenticado
 * (`getCurrentUser()`) → verifica acesso à Company (`getCompanyById()`,
 * RLS-scoped) → busca TODOS os `LearningRecord`s reais da empresa
 * (`getLearningRecordsByCompany()`, cross-Decision, não escopado a uma
 * única Decision) → chama a função pura de composição
 * (`buildKnowledgeForCandidate()`, Mission 187 Closure — extraída de
 * `buildKnowledgeFromLearningRecords()`) → persiste cada `Knowledge`
 * formado (idempotente) → `revalidatePath()`. `formedBy` nunca é
 * aceito do client — sempre `user.id` resolvido aqui.
 *
 * **Determinístico, nunca a IA**: esta Server Action nunca importa
 * nada de `efos/infrastructure/executive-ai/` — a formação é
 * inteiramente baseada em `LearningRecord`s já persistidos, acionada
 * por um clique humano explícito, nunca automática.
 *
 * **Mission 187 Closure — Governed Knowledge Synthesis.** Um
 * `KnowledgeCandidate` recorrente que carrega interpretação executiva
 * (`humanInterpretedCount > 0`, D-101) NUNCA é auto-formado por esta
 * ação — é devolvido em `pendingReview` (com as interpretações
 * verbatim, D-102) para que um humano confirme/edite o `statement`
 * organizacional final através de `formGovernedKnowledgeAction()`
 * abaixo, antes de qualquer persistência. Candidatos sem interpretação
 * (`humanInterpretedCount === 0`) continuam sendo formados exatamente
 * como antes desta missão — **Knowledge histórico/ordinário
 * permanece 100% retrocompatível** (Seção 21/17 da missão de
 * fechamento).
 */

export interface FormKnowledgeInput {
  readonly companyId: string;
}

export type FormKnowledgeResult =
  | { readonly success: true; readonly knowledge: readonly Knowledge[]; readonly pendingReview: readonly KnowledgeCandidatePreview[] }
  | { readonly success: false; readonly code: string; readonly message: string; readonly errors?: readonly string[] };

export async function formKnowledgeAction(input: FormKnowledgeInput): Promise<FormKnowledgeResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, code: "AUTH_REQUIRED", message: "Sessão expirada. Faça login novamente." };
  }

  const company = await getCompanyById(input.companyId);
  if (!company) {
    return { success: false, code: "COMPANY_ACCESS_DENIED", message: "Empresa não encontrada ou sem acesso." };
  }

  const [learningRecords, existingKnowledge] = await Promise.all([
    getLearningRecordsByCompany(input.companyId),
    getKnowledgeByCompany(input.companyId),
  ]);
  const existingIds = new Set(existingKnowledge.map((k) => k.id));

  const recurring = deriveKnowledgeCandidates(learningRecords).filter(
    (candidate) => candidate.decisionIds.length >= MINIMUM_DISTINCT_DECISIONS_FOR_KNOWLEDGE
  );

  if (recurring.length === 0) {
    return {
      success: false,
      code: "NO_SUFFICIENT_RECURRING_LEARNING",
      message: `Nenhum grupo de LearningRecords comparáveis atinge o mínimo de ${MINIMUM_DISTINCT_DECISIONS_FOR_KNOWLEDGE} Decisions independentes — nenhum Knowledge é fabricado a partir de evidência insuficiente.`,
    };
  }

  const now = new Date().toISOString();
  // Mission 187 Closure — candidatos com interpretação executiva
  // (`humanInterpretedCount > 0`, D-101) NUNCA são auto-formados aqui —
  // `deriveKnowledgeCandidatePreviews()` os exclui deste laço; eles só
  // se tornam Knowledge através de `formGovernedKnowledgeAction()`
  // abaixo, com um `statement` explicitamente confirmado por um humano.
  const toPersist: Knowledge[] = [];
  const allErrors: string[] = [];

  for (const candidate of recurring.filter((c) => c.humanInterpretedCount === 0)) {
    const built = buildKnowledgeForCandidate(candidate, now);
    if (!built.success) {
      if (built.error.code === "INVALID_KNOWLEDGE") allErrors.push(...built.error.errors);
      continue;
    }
    if (existingIds.has(built.value.id)) continue; // já formado — nada a repetir
    toPersist.push(built.value);
  }

  if (allErrors.length > 0) {
    return { success: false, code: "INVALID_KNOWLEDGE", message: "Conhecimento inválido.", errors: allErrors };
  }

  const persisted = await Promise.all(toPersist.map((knowledge) => saveKnowledge(knowledge, user.id)));
  if (persisted.length > 0) {
    revalidatePath(`/companies/${input.companyId}`);
  }

  const pendingReview = deriveKnowledgeCandidatePreviews(learningRecords, existingIds, now);
  return { success: true, knowledge: persisted, pendingReview };
}

/**
 * `formGovernedKnowledgeAction()` (Mission 187 Closure — Governed
 * Knowledge Synthesis). Único ponto de composição autorizado para um
 * humano confirmar/fornecer o `statement` organizacional final de um
 * `KnowledgeCandidate` que carrega interpretação executiva.
 *
 * **Fronteira cliente/servidor (Seção 11/12/28 da missão)**: o client
 * fornece exatamente 2 valores de intenção — `candidateId` (uma CHAVE
 * de busca, nunca um dado confiado às cegas) e `organizationalStatement?`
 * (a ÚNICA informação verdadeiramente autoral que o client pode
 * fornecer). Tudo o mais é sempre recomputado/verificado aqui:
 * `companyId` contra `getCompanyById()`, os candidatos inteiros
 * recalculados a partir de `getLearningRecordsByCompany()` (nunca uma
 * lista de IDs de origem aceita do client), o ator sempre `user.id`. Se
 * `candidateId` não corresponder a nenhum candidato recém-recalculado
 * (composição mudou, ou nunca existiu), a submissão é recusada —
 * nenhum `Knowledge` é fabricado a partir de uma referência que o
 * servidor não conseguiu reproduzir de forma independente.
 *
 * **Imutabilidade preservada (Seção 29)**: se este candidato já tem um
 * `Knowledge` persistido (`deriveKnowledgeId()` já é determinístico,
 * D-073), a submissão nunca sobrescreve — devolve o `Knowledge` já
 * existente com `alreadyApproved: true`, nunca uma segunda gravação.
 */
export interface FormGovernedKnowledgeInput {
  readonly companyId: string;
  readonly candidateId: string;
  readonly organizationalStatement?: string;
}

export type FormGovernedKnowledgeResult =
  | { readonly success: true; readonly knowledge: Knowledge; readonly alreadyApproved: boolean }
  | { readonly success: false; readonly code: string; readonly message: string; readonly errors?: readonly string[] };

export async function formGovernedKnowledgeAction(
  input: FormGovernedKnowledgeInput
): Promise<FormGovernedKnowledgeResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, code: "AUTH_REQUIRED", message: "Sessão expirada. Faça login novamente." };
  }

  const company = await getCompanyById(input.companyId);
  if (!company) {
    return { success: false, code: "COMPANY_ACCESS_DENIED", message: "Empresa não encontrada ou sem acesso." };
  }

  const [learningRecords, existingKnowledge] = await Promise.all([
    getLearningRecordsByCompany(input.companyId),
    getKnowledgeByCompany(input.companyId),
  ]);

  const now = new Date().toISOString();
  const recurring = deriveKnowledgeCandidates(learningRecords).filter(
    (candidate) => candidate.decisionIds.length >= MINIMUM_DISTINCT_DECISIONS_FOR_KNOWLEDGE
  );

  let matchedCandidate;
  for (const candidate of recurring) {
    const defaultBuilt = buildKnowledgeForCandidate(candidate, now);
    if (defaultBuilt.success && defaultBuilt.value.id === input.candidateId) {
      matchedCandidate = candidate;
      break;
    }
  }

  if (!matchedCandidate) {
    return {
      success: false,
      code: "CANDIDATE_NOT_FOUND",
      message: "Este padrão não existe mais (a composição de LearningRecords mudou) ou nunca existiu — atualize a página e tente novamente.",
    };
  }

  const existing = existingKnowledge.find((k) => k.id === input.candidateId);
  if (existing) {
    return { success: true, knowledge: existing, alreadyApproved: true };
  }

  const built = buildKnowledgeForCandidate(matchedCandidate, now, input.organizationalStatement);
  if (!built.success) {
    return {
      success: false,
      code: built.error.code,
      message: "Conhecimento inválido.",
      errors: built.error.code === "INVALID_KNOWLEDGE" ? built.error.errors : undefined,
    };
  }

  const persisted = await saveKnowledge(built.value, user.id);
  revalidatePath(`/companies/${input.companyId}`);
  return { success: true, knowledge: persisted, alreadyApproved: false };
}
