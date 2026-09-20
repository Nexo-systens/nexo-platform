"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/modules/auth/services/auth.service";
import { getCompanyById } from "@/modules/companies/services/company.service";
import { evaluateKnowledgeAgainstLearning } from "@/efos/application/knowledge-evaluation";
import type { KnowledgeEvaluationResult } from "@/efos/application/knowledge-evaluation";
import { getLearningRecordsByCompany } from "@/modules/decisions/services/learning-record-persistence.service";
import { getKnowledgeByCompany } from "@/modules/decisions/services/knowledge-persistence.service";
import { saveKnowledgeEvaluation } from "@/modules/decisions/services/knowledge-evaluation-persistence.service";

/**
 * Mission 145 — Knowledge-Driven Continuous Improvement. Mesmo padrão
 * exato de `knowledge-accumulation.actions.ts` (Mission 144): Client →
 * Server Action → resolve usuário autenticado (`getCurrentUser()`) →
 * verifica acesso à Company (`getCompanyById()`, RLS-scoped) → busca
 * TODOS os `Knowledge`s e `LearningRecord`s reais da empresa → avalia
 * CADA `Knowledge` contra o mesmo conjunto de `LearningRecord`s
 * (função pura `evaluateKnowledgeAgainstLearning()`) → persiste cada
 * resultado como evento imutável → `revalidatePath()`. `evaluatedBy`
 * nunca é aceito do client — sempre `user.id` resolvido aqui.
 *
 * **Determinístico, nunca a IA**: nunca importa nada de
 * `efos/infrastructure/executive-ai/`.
 *
 * **Explicitamente separada de `accumulateKnowledgeAction()`
 * (Etapa 10 da missão)**: nunca chamada de dentro dela — quem
 * orquestra as 2 é sempre o chamador (client). Se esta Server Action
 * falhar depois de `accumulateKnowledgeAction()` já ter persistido um
 * novo `Knowledge`, nada é perdido — `evaluateKnowledgeAction()` pode
 * ser chamada novamente mais tarde.
 */

export interface EvaluateKnowledgeInput {
  readonly companyId: string;
}

export type EvaluateKnowledgeResult =
  | { readonly success: true; readonly results: readonly KnowledgeEvaluationResult[] }
  | { readonly success: false; readonly code: string; readonly message: string };

export async function evaluateKnowledgeAction(
  input: EvaluateKnowledgeInput
): Promise<EvaluateKnowledgeResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, code: "AUTH_REQUIRED", message: "Sessão expirada. Faça login novamente." };
  }

  const company = await getCompanyById(input.companyId);
  if (!company) {
    return { success: false, code: "COMPANY_ACCESS_DENIED", message: "Empresa não encontrada ou sem acesso." };
  }

  const [knowledgeRecords, learningRecords] = await Promise.all([
    getKnowledgeByCompany(input.companyId),
    getLearningRecordsByCompany(input.companyId),
  ]);

  const evaluatedAt = new Date().toISOString();

  const results = await Promise.all(
    knowledgeRecords.map(async (knowledge) => {
      const computed = evaluateKnowledgeAgainstLearning(knowledge, learningRecords, evaluatedAt);
      return saveKnowledgeEvaluation(computed, input.companyId, user.id, evaluatedAt);
    })
  );

  if (results.length > 0) {
    revalidatePath(`/companies/${input.companyId}`);
  }

  return { success: true, results };
}
