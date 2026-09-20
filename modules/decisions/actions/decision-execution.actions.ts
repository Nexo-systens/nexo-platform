"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/modules/auth/services/auth.service";
import { getCompanyById } from "@/modules/companies/services/company.service";
import type { DecisionExecutionStatus } from "@/efos/application/decision-execution/DecisionExecutionEvent";
import { deriveDecisionExecutionState } from "@/efos/application/decision-execution/deriveDecisionExecutionState";
import { buildDecisionExecutionEvent } from "@/modules/decisions/lib/buildDecisionExecutionEvent";
import { buildOutcome } from "@/modules/decisions/lib/buildOutcome";
import {
  verifyDecisionBelongsToCompany,
  saveDecisionExecutionEvent,
  getDecisionExecutionEventsByDecision,
  saveOutcome,
  type DecisionExecutionAuthorizationError,
} from "@/modules/decisions/services/decision-execution-persistence.service";
import type { DecisionExecutionEvent } from "@/efos/application/decision-execution/DecisionExecutionEvent";
import type { Outcome, OutcomeStatus } from "@/efos/domain";

/**
 * Mission 138 — Decision Execution & Outcome Feedback Loop. Mesmo
 * padrão exato de `human-review.actions.ts` (Mission 126/127):
 * Client → Server Action → resolve usuário autenticado (`getCurrentUser()`)
 * → verifica acesso à Company (`getCompanyById()`, RLS-scoped) →
 * verifica pertencimento da Decision referenciada → constrói e valida
 * (função pura) → persiste → `revalidatePath()`. `actorId`/
 * `recordedBy` nunca são aceitos do client — sempre `user.id`
 * resolvido aqui.
 *
 * **Nenhuma automação**: nenhuma destas duas Server Actions é chamada
 * por nenhum outro código de produção — nem pela ativação de
 * diagnóstico (`executive-diagnosis.actions.ts`), nem pela submissão
 * de review (`human-review.actions.ts`, `submitDiagnosisReviewAction()`
 * nunca importa nada deste arquivo). Toda mudança de estado de
 * execução ou todo Outcome só existe por um clique explícito.
 */

async function resolveCompanyAndPreviousStatus(
  companyId: string,
  decisionId: string
): Promise<
  | { readonly ok: true; readonly previousStatus: DecisionExecutionStatus | undefined }
  | { readonly ok: false; readonly error: string }
> {
  const company = await getCompanyById(companyId);
  if (!company) {
    return { ok: false, error: "Empresa não encontrada ou sem acesso." };
  }

  const decisionError: DecisionExecutionAuthorizationError | undefined = await verifyDecisionBelongsToCompany(
    decisionId,
    companyId
  );
  if (decisionError) {
    return { ok: false, error: decisionError.message };
  }

  const existingEvents = await getDecisionExecutionEventsByDecision(decisionId);
  const state = deriveDecisionExecutionState(existingEvents);
  return { ok: true, previousStatus: state.status === "NOT_STARTED" ? undefined : state.status };
}

export interface RecordDecisionExecutionEventInput {
  readonly companyId: string;
  readonly decisionId: string;
  readonly status: DecisionExecutionStatus;
  readonly targetDate?: string;
  readonly notes?: string;
}

export type RecordDecisionExecutionEventResult =
  | { readonly success: true; readonly event: DecisionExecutionEvent }
  | { readonly success: false; readonly error: string; readonly errors?: readonly string[] };

export async function recordDecisionExecutionEventAction(
  input: RecordDecisionExecutionEventInput
): Promise<RecordDecisionExecutionEventResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login novamente." };
  }

  const resolved = await resolveCompanyAndPreviousStatus(input.companyId, input.decisionId);
  if (!resolved.ok) {
    return { success: false, error: resolved.error };
  }

  const built = buildDecisionExecutionEvent(
    { decisionId: input.decisionId, companyId: input.companyId, status: input.status, targetDate: input.targetDate, notes: input.notes },
    user.id,
    randomUUID(),
    new Date().toISOString(),
    resolved.previousStatus
  );
  if (!built.success) {
    return { success: false, error: "Evento de execução inválido.", errors: built.error.errors };
  }

  const persisted = await saveDecisionExecutionEvent(built.value);
  revalidatePath(`/companies/${input.companyId}`);
  return { success: true, event: persisted };
}

export interface RecordOutcomeInput {
  readonly companyId: string;
  readonly decisionId: string;
  readonly status: OutcomeStatus;
  readonly observedAt: string;
  readonly description: string;
  readonly expectedResult?: string;
}

export type RecordOutcomeResult =
  | { readonly success: true; readonly outcome: Outcome }
  | { readonly success: false; readonly error: string; readonly errors?: readonly string[] };

export async function recordOutcomeAction(input: RecordOutcomeInput): Promise<RecordOutcomeResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login novamente." };
  }

  const company = await getCompanyById(input.companyId);
  if (!company) {
    return { success: false, error: "Empresa não encontrada ou sem acesso." };
  }

  const decisionError = await verifyDecisionBelongsToCompany(input.decisionId, input.companyId);
  if (decisionError) {
    return { success: false, error: decisionError.message };
  }

  const built = buildOutcome(
    {
      decisionId: input.decisionId,
      companyId: input.companyId,
      status: input.status,
      observedAt: input.observedAt,
      description: input.description,
      expectedResult: input.expectedResult,
    },
    user.id,
    randomUUID(),
    new Date().toISOString()
  );
  if (!built.success) {
    return { success: false, error: "Outcome inválido.", errors: built.error.errors };
  }

  const persisted = await saveOutcome(built.value);
  revalidatePath(`/companies/${input.companyId}`);
  return { success: true, outcome: persisted };
}
