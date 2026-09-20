"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/modules/auth/services/auth.service";
import { getCompanyById } from "@/modules/companies/services/company.service";
import { buildLearningRecord } from "@/efos/application/learning-derivation";
import { deriveExpectedActualLearningEligibility } from "@/efos/application/expected-actual-learning";
import type { LearningRecord } from "@/efos/domain";
import { createClient } from "@/lib/supabase/server";
import { SupabaseExecutionRepository } from "@/efos/infrastructure/repositories";
import { SupabasePersistenceClient } from "@/efos/infrastructure/providers";
import { DefaultHistoricalExecutionService } from "@/efos/application/history";
import { resolveExpectedActualComparison } from "@/modules/decisions/lib/resolveExpectedActualComparison";
import { verifyDecisionBelongsToCompany, getOutcomesByDecision } from "@/modules/decisions/services/decision-execution-persistence.service";
import { getDecisionById } from "@/modules/decisions/services/decision-persistence.service";
import { getFinancialObservationsByDecision } from "@/modules/decisions/services/financial-observation-persistence.service";
import { saveLearningRecord } from "@/modules/decisions/services/learning-record-persistence.service";

/**
 * Mission 140 — EFOS Continuous Financial Intelligence & Learning
 * Loop. Mesmo padrão exato de `financial-observation.actions.ts`
 * (Mission 139): Client → Server Action → resolve usuário autenticado
 * (`getCurrentUser()`) → verifica acesso à Company (`getCompanyById()`,
 * RLS-scoped) → verifica pertencimento da Decision → monta os insumos
 * reais (Outcomes + FinancialOutcomeObservations já persistidos) →
 * chama a função pura de composição (`buildLearningRecord()`) →
 * persiste só em caso de sucesso → `revalidatePath()`. `derivedBy`
 * nunca é aceito do client — sempre `user.id` resolvido aqui.
 *
 * **Determinístico, nunca a IA**: esta Server Action nunca importa
 * nada de `efos/infrastructure/executive-ai/` — o aprendizado é
 * inteiramente derivado de dados já persistidos, acionado por um
 * clique humano explícito, nunca automático.
 *
 * **Mission 186 — Decision Learning from Expected vs Observed.**
 * Reaproveita `resolveExpectedActualComparison()` (Mission 185/185
 * Closure) EXATAMENTE como `DecisionExecutionSection.tsx` já faz —
 * mesma composição de `SupabasePersistenceClient`/
 * `SupabaseExecutionRepository`/`DefaultHistoricalExecutionService`,
 * nunca uma segunda implementação de leitura de histórico. O resultado
 * (`ExpectedActualComparisonBundle`) é passado a
 * `deriveExpectedActualLearningEligibility()`
 * (`efos/application/expected-actual-learning/`), que NUNCA lê
 * `bundle.live` — apenas `bundle.formal` (Seção 5/31 da missão: uma
 * comparação `"live"` nunca pode fundamentar um `LearningRecord`
 * durável). Quando elegível, o contexto determinístico resultante é
 * passado a `buildLearningRecord()` como snapshot imutável; quando não
 * elegível (Decision sem cenário, sem observação formal, ou sem
 * métrica comparável), `buildLearningRecord()` continua sendo chamada
 * exatamente como antes desta missão — o caminho de aprendizado
 * genérico (evidência humana/observação financeira) nunca é bloqueado
 * (Seção 7: "Mission 186 is additive").
 *
 * **Mission 186 Closure — Human Learning Statement & Governance.**
 * `humanStatement?` é a ÚNICA informação de interpretação que o client
 * pode fornecer — nunca um valor financeiro (`expected`/`observed`/
 * `distance`/`observationExecutionId`), sempre recomputados/resolvidos
 * aqui, nunca aceitos do browser (Seção 10/11/26). Quando a elegibilidade
 * E-v-O resolvida aqui (nunca a do client) é positiva,
 * `buildLearningRecord()` exige `humanStatement` não-vazio
 * (`HUMAN_STATEMENT_REQUIRED` caso contrário) — nenhum aprendizado é
 * persistido apenas porque o formulário foi aberto.
 */

export interface DeriveLearningRecordInput {
  readonly companyId: string;
  readonly decisionId: string;
  readonly humanStatement?: string;
}

export type DeriveLearningRecordResult =
  | { readonly success: true; readonly record: LearningRecord }
  | { readonly success: false; readonly code: string; readonly message: string; readonly errors?: readonly string[] };

export async function deriveLearningRecordAction(
  input: DeriveLearningRecordInput
): Promise<DeriveLearningRecordResult> {
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

  const [outcomes, financialObservations] = await Promise.all([
    getOutcomesByDecision(input.decisionId),
    getFinancialObservationsByDecision(input.decisionId),
  ]);

  // Mission 186 — mesma composição de `DecisionExecutionSection.tsx`
  // (Mission 185/185 Closure), nunca uma segunda implementação de
  // leitura de histórico. `history` é escopado por `input.companyId`
  // (já verificado acima por `getCompanyById()`/
  // `verifyDecisionBelongsToCompany()`), e `resolveExpectedActualComparison()`
  // reafirma o isolamento de empresa internamente (Seção 23).
  const supabaseClient = await createClient();
  const persistenceClient = new SupabasePersistenceClient(supabaseClient);
  const executionRepository = new SupabaseExecutionRepository(persistenceClient);
  const historicalExecutionService = new DefaultHistoricalExecutionService(executionRepository);
  const history = await historicalExecutionService.getHistory(input.companyId);

  const expectedActualBundle = resolveExpectedActualComparison(decision.decision, history, financialObservations);
  const eligibility = deriveExpectedActualLearningEligibility(expectedActualBundle);

  const built = buildLearningRecord(
    { id: decision.id, companyId: decision.companyId, title: decision.decision.title },
    outcomes,
    financialObservations,
    randomUUID(),
    new Date().toISOString(),
    eligibility.eligible ? eligibility.context : undefined,
    input.humanStatement
  );

  if (!built.success) {
    if (built.error.code === "INVALID_RECORD") {
      return { success: false, code: built.error.code, message: "Aprendizado inválido.", errors: built.error.errors };
    }
    return { success: false, code: built.error.code, message: built.error.message };
  }

  const persisted = await saveLearningRecord(built.value, user.id);
  revalidatePath(`/companies/${input.companyId}`);
  return { success: true, record: persisted };
}
