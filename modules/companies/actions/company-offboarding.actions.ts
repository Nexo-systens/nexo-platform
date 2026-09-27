"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/auth/services/auth.service";
import {
  COMPANY_PURGE_FAILURE_MESSAGES,
  logOffboardingUnexpected as logUnexpected,
  previewCompanyPurge,
  runCompanyPurge,
  type CompanyPurgePreview,
  type CompanyPurgeFailure,
} from "@/modules/companies/lib/company-offboarding";
import { createCompanyOffboardingPorts } from "@/modules/companies/services/company-offboarding.service";

/**
 * Mission 202 (D-130) — entrada executável da purga definitiva, sempre
 * com a sessão do próprio usuário. Identificador malformado nunca chega
 * ao banco (D-128); erro inesperado nunca devolve texto interno (D-129).
 */

export type PreviewCompanyPurgeActionResult =
  | { readonly ok: true; readonly preview: Extract<CompanyPurgePreview, { found: true }> }
  | { readonly ok: false; readonly message: string };

export type PurgeClosedCompanyActionResult =
  | {
      readonly ok: true;
      readonly storageObjectsRemoved: number;
      readonly deleted: Readonly<Record<string, number>>;
    }
  | { readonly ok: false; readonly reason: CompanyPurgeFailure | "auth" | "unexpected"; readonly message: string };

const SESSION_EXPIRED = "Sessão expirada. Faça login novamente.";
const UNEXPECTED = "Erro inesperado. Nada além do que já foi confirmado foi alterado; tente novamente.";

export async function previewCompanyPurgeAction(companyId: string): Promise<PreviewCompanyPurgeActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };

  try {
    const supabase = await createClient();
    const preview = await previewCompanyPurge(createCompanyOffboardingPorts(supabase), companyId);
    if (!preview.found) return { ok: false, message: COMPANY_PURGE_FAILURE_MESSAGES.not_found };
    return { ok: true, preview };
  } catch (error) {
    logUnexpected("preview", error);
    return { ok: false, message: UNEXPECTED };
  }
}

export async function purgeClosedCompanyAction(input: {
  readonly companyId: string;
  readonly confirmation: string;
}): Promise<PurgeClosedCompanyActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth", message: SESSION_EXPIRED };

  try {
    const supabase = await createClient();
    const outcome = await runCompanyPurge(createCompanyOffboardingPorts(supabase), {
      companyId: input?.companyId,
      confirmation: input?.confirmation,
    });

    if (!outcome.ok) {
      if (outcome.reason === "database_failed" || outcome.reason === "verification_failed") {
        logUnexpected(outcome.reason, null);
      }
      return { ok: false, reason: outcome.reason, message: COMPANY_PURGE_FAILURE_MESSAGES[outcome.reason] };
    }

    revalidatePath("/companies/closed");
    revalidatePath("/companies");
    return { ok: true, storageObjectsRemoved: outcome.storageObjectsRemoved, deleted: outcome.deleted };
  } catch (error) {
    logUnexpected("purge", error);
    return { ok: false, reason: "unexpected", message: UNEXPECTED };
  }
}
