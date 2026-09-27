"use server";

import { isUuid } from "@/lib/identifiers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/auth/services/auth.service";
import {
  COMPANY_PURGE_FAILURE_MESSAGES,
  logOffboardingUnexpected,
  runCompanyPurge,
  type CompanyPurgeFailure,
} from "@/modules/companies/lib/company-offboarding";
import {
  OFFBOARDING_REGISTRATION_MESSAGES,
  registerOffboardingRequest,
  type OffboardingRegistrationRefusal,
  type OperatorPurgePreview,
} from "@/modules/companies/lib/operator-offboarding";
import {
  createOffboardingRegistrationPort,
  createOperatorOffboardingPorts,
  isOffboardingOperator,
  previewForOperator,
} from "@/modules/companies/services/operator-offboarding.service";

/**
 * Mission 202B (D-131) — entrada executável da autoridade de offboarding
 * do operador NEXO, sempre com a sessão do próprio operador (nunca
 * `service_role`). Quem não é operador recebe a mesma resposta de uma
 * empresa inexistente; identificador malformado nunca chega ao banco
 * (D-128); erro inesperado nunca devolve texto interno (D-129).
 */

export type OperatorPreviewActionResult =
  | { readonly ok: true; readonly preview: Extract<OperatorPurgePreview, { found: true }> }
  | { readonly ok: false; readonly message: string };

export type OperatorRegisterActionResult =
  | { readonly ok: true; readonly closedNow: boolean; readonly alreadyRegistered: boolean }
  | { readonly ok: false; readonly reason: OffboardingRegistrationRefusal | "auth" | "unexpected"; readonly message: string };

export type OperatorPurgeActionResult =
  | {
      readonly ok: true;
      readonly storageObjectsRemoved: number;
      readonly deleted: Readonly<Record<string, number>>;
    }
  | { readonly ok: false; readonly reason: CompanyPurgeFailure | "auth" | "unexpected"; readonly message: string };

const SESSION_EXPIRED = "Sessão expirada. Faça login novamente.";
const UNEXPECTED = "Erro inesperado. Nada além do que já foi confirmado foi alterado; tente novamente.";
const NOT_FOUND = OFFBOARDING_REGISTRATION_MESSAGES.not_found;

export async function previewOperatorOffboardingAction(companyId: string): Promise<OperatorPreviewActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  if (!isUuid(companyId)) return { ok: false, message: NOT_FOUND };

  try {
    const supabase = await createClient();
    if (!(await isOffboardingOperator(supabase))) return { ok: false, message: NOT_FOUND };
    const preview = await previewForOperator(supabase, companyId);
    if (!preview.found) return { ok: false, message: NOT_FOUND };
    return { ok: true, preview };
  } catch (error) {
    logOffboardingUnexpected("operator-preview", error);
    return { ok: false, message: UNEXPECTED };
  }
}

export async function registerOffboardingRequestAction(input: {
  readonly companyId: string;
  readonly reference: string;
  readonly confirmation: string;
}): Promise<OperatorRegisterActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth", message: SESSION_EXPIRED };

  try {
    const supabase = await createClient();
    if (!(await isOffboardingOperator(supabase))) return { ok: false, reason: "not_found", message: NOT_FOUND };
    const result = await registerOffboardingRequest(createOffboardingRegistrationPort(supabase), {
      companyId: input?.companyId,
      reference: input?.reference,
      confirmation: input?.confirmation,
    });
    if (!result.ok) return { ok: false, reason: result.reason, message: OFFBOARDING_REGISTRATION_MESSAGES[result.reason] };
    return { ok: true, closedNow: result.closedNow, alreadyRegistered: result.alreadyRegistered };
  } catch (error) {
    logOffboardingUnexpected("operator-register", error);
    return { ok: false, reason: "unexpected", message: UNEXPECTED };
  }
}

export async function operatorPurgeClosedCompanyAction(input: {
  readonly companyId: string;
  readonly confirmation: string;
}): Promise<OperatorPurgeActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth", message: SESSION_EXPIRED };

  try {
    const supabase = await createClient();
    if (!(await isOffboardingOperator(supabase))) {
      return { ok: false, reason: "not_found", message: COMPANY_PURGE_FAILURE_MESSAGES.not_found };
    }
    const outcome = await runCompanyPurge(createOperatorOffboardingPorts(supabase), {
      companyId: input?.companyId,
      confirmation: input?.confirmation,
    });

    if (!outcome.ok) {
      if (outcome.reason === "database_failed" || outcome.reason === "verification_failed") {
        logOffboardingUnexpected(`operator-${outcome.reason}`, null);
      }
      return { ok: false, reason: outcome.reason, message: COMPANY_PURGE_FAILURE_MESSAGES[outcome.reason] };
    }

    return { ok: true, storageObjectsRemoved: outcome.storageObjectsRemoved, deleted: outcome.deleted };
  } catch (error) {
    logOffboardingUnexpected("operator-purge", error);
    return { ok: false, reason: "unexpected", message: UNEXPECTED };
  }
}
