"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/modules/auth/services/auth.service";
import { getCompanyById } from "@/modules/companies/services/company.service";
import { accumulateKnowledge } from "@/efos/application/knowledge-accumulation";
import type { KnowledgeAccumulationResult } from "@/efos/application/knowledge-accumulation";
import { getLearningRecordsByCompany } from "@/modules/decisions/services/learning-record-persistence.service";
import { getKnowledgeByCompany, saveKnowledge } from "@/modules/decisions/services/knowledge-persistence.service";

/**
 * Mission 144 — Knowledge Accumulation & Historical Pattern Formation.
 * Mesmo padrão exato de `knowledge-formation.actions.ts` (Mission
 * 141): Client → Server Action → resolve usuário autenticado
 * (`getCurrentUser()`) → verifica acesso à Company (`getCompanyById()`,
 * RLS-scoped) → busca TODOS os `LearningRecord`s e `Knowledge`s já
 * reais da empresa → chama a função pura de orquestração
 * (`accumulateKnowledge()`) → persiste só o que é genuinamente novo
 * (`result.created`, nunca `result.existing` — já persistido) →
 * `revalidatePath()`. `formedBy` nunca é aceito do client — sempre
 * `user.id` resolvido aqui.
 *
 * **Determinístico, nunca a IA**: esta Server Action nunca importa
 * nada de `efos/infrastructure/executive-ai/` — a acumulação é
 * inteiramente baseada em dados já persistidos.
 *
 * **Explicitamente separada de `deriveLearningRecordAction()`
 * (Etapa 8/9 da missão)**: esta função nunca é chamada de dentro de
 * `saveLearningRecord()`/`deriveLearningRecordAction()` — quem
 * orquestra as 2 é sempre o chamador (client), nunca um acoplamento
 * silencioso. Se esta Server Action falhar depois que um
 * `LearningRecord` já foi persistido com sucesso por outra chamada,
 * nenhum dado é perdido — `accumulateKnowledgeAction()` pode ser
 * chamada novamente mais tarde (full recomputation, sempre segura).
 */

export interface AccumulateKnowledgeInput {
  readonly companyId: string;
}

export type AccumulateKnowledgeResult =
  | { readonly success: true; readonly result: KnowledgeAccumulationResult }
  | { readonly success: false; readonly code: string; readonly message: string };

export async function accumulateKnowledgeAction(
  input: AccumulateKnowledgeInput
): Promise<AccumulateKnowledgeResult> {
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

  const computed = accumulateKnowledge(
    input.companyId,
    learningRecords,
    existingKnowledge,
    new Date().toISOString()
  );

  const persistedCreated = await Promise.all(
    computed.created.map((knowledge) => saveKnowledge(knowledge, user.id))
  );

  const result: KnowledgeAccumulationResult = { ...computed, created: persistedCreated };

  if (persistedCreated.length > 0) {
    revalidatePath(`/companies/${input.companyId}`);
  }

  return { success: true, result };
}
