"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/modules/auth/services/auth.service";
import { getCompanyById } from "@/modules/companies/services/company.service";
import { createClient } from "@/lib/supabase/server";
import { SupabaseExecutionRepository } from "@/efos/infrastructure/repositories";
import { SupabasePersistenceClient } from "@/efos/infrastructure/providers";
import { DefaultHistoricalExecutionService } from "@/efos/application/history";
import { deriveDecisionExecutionState } from "@/efos/application/decision-execution";
import {
  buildFinancialOutcomeObservation,
  type FinancialOutcomeObservation,
} from "@/efos/application/financial-observation";
import {
  verifyDecisionBelongsToCompany,
  getDecisionExecutionEventsByDecision,
  getOutcomesByDecision,
} from "@/modules/decisions/services/decision-execution-persistence.service";
import { getDecisionById } from "@/modules/decisions/services/decision-persistence.service";
import { saveFinancialOutcomeObservation } from "@/modules/decisions/services/financial-observation-persistence.service";

/**
 * Mission 139 — Outcome Measurement & Financial Feedback Correlation.
 * Mesmo padrão exato de `decision-execution.actions.ts` (Mission 138):
 * Client → Server Action → resolve usuário autenticado
 * (`getCurrentUser()`) → verifica acesso à Company (`getCompanyById()`,
 * RLS-scoped) → verifica pertencimento da Decision → monta os
 * insumos reais (histórico de execuções + estado de execução
 * derivado) → chama a função pura de composição
 * (`buildFinancialOutcomeObservation()`) → persiste só em caso de
 * sucesso → `revalidatePath()`. `computedBy` nunca é aceito do
 * client — sempre `user.id` resolvido aqui.
 *
 * **Determinístico, nunca a IA**: esta Server Action nunca importa
 * nada de `efos/infrastructure/executive-ai/` — o cálculo é
 * inteiramente baseado em dados já persistidos (`Decision`,
 * `DecisionExecutionEvent`s, `ExecutionSnapshot`s reais), acionado por
 * um clique humano explícito, nunca automático.
 */

export interface ComputeFinancialOutcomeObservationInput {
  readonly companyId: string;
  readonly decisionId: string;
}

export type ComputeFinancialOutcomeObservationResult =
  | { readonly success: true; readonly observation: FinancialOutcomeObservation }
  | { readonly success: false; readonly code: string; readonly message: string; readonly errors?: readonly string[] };

export async function computeFinancialOutcomeObservationAction(
  input: ComputeFinancialOutcomeObservationInput
): Promise<ComputeFinancialOutcomeObservationResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, code: "AUTH_REQUIRED", message: "Sessão expirada. Faça login novamente." };
  }

  const company = await getCompanyById(input.companyId);
  if (!company) {
    return { success: false, code: "COMPANY_ACCESS_DENIED", message: "Empresa não encontrada ou sem acesso." };
  }

  const decisionError = await verifyDecisionBelongsToCompany(input.decisionId, input.companyId);
  if (decisionError) {
    return { success: false, code: decisionError.code, message: decisionError.message };
  }

  const decision = await getDecisionById(input.decisionId);
  if (!decision) {
    return { success: false, code: "DECISION_NOT_FOUND", message: "Decision não encontrada." };
  }

  const [executionEvents, outcomes] = await Promise.all([
    getDecisionExecutionEventsByDecision(input.decisionId),
    getOutcomesByDecision(input.decisionId),
  ]);
  const executionState = deriveDecisionExecutionState(executionEvents);

  const supabaseClient = await createClient();
  const persistenceClient = new SupabasePersistenceClient(supabaseClient);
  const executionRepository = new SupabaseExecutionRepository(persistenceClient);
  const historicalExecutionService = new DefaultHistoricalExecutionService(executionRepository);
  const history = await historicalExecutionService.getHistory(input.companyId);

  const built = buildFinancialOutcomeObservation(
    { id: decision.id, companyId: decision.companyId, createdAt: decision.createdAt },
    executionState,
    history,
    outcomes[0]?.id,
    user.id,
    randomUUID(),
    new Date().toISOString()
  );

  if (!built.success) {
    if (built.error.code === "INVALID_OBSERVATION") {
      return { success: false, code: built.error.code, message: "Observação financeira inválida.", errors: built.error.errors };
    }
    return { success: false, code: built.error.code, message: built.error.message };
  }

  const persisted = await saveFinancialOutcomeObservation(built.value);
  revalidatePath(`/companies/${input.companyId}`);
  return { success: true, observation: persisted };
}
