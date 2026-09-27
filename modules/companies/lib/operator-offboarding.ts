import { isUuid } from "@/lib/identifiers";
import { parseCompanyPurgePreview, type CompanyPurgeResource } from "@/modules/companies/lib/company-offboarding";

/**
 * Mission 202B — Governed Operator Offboarding Authority (D-131).
 *
 * O operador de offboarding (autoridade explícita no banco, nunca uma
 * flag do cliente) tem só dois atos próprios:
 *
 *   1. registrar a solicitação de encerramento recebida pelo canal
 *      acordado — encerrando a empresa se ela ainda estiver aberta;
 *   2. concluir a purga de uma empresa encerrada E registrada — pela
 *      MESMA orquestração do dono (`runCompanyPurge`), com as portas do
 *      operador.
 *
 * Nada aqui dá acesso a dados: a prévia traz só estado, frases e
 * contagens. A referência aponta para o registro privado do operador e
 * tem formato restrito (sem espaço nem `@`: nunca e-mail ou texto livre).
 */

export const OFFBOARDING_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,63}$/;

export function isOffboardingReference(value: unknown): value is string {
  return typeof value === "string" && OFFBOARDING_REFERENCE_PATTERN.test(value);
}

export type OperatorPurgePreview =
  | { readonly found: false }
  | {
      readonly found: true;
      readonly closed: boolean;
      readonly registered: boolean;
      readonly confirmation: string;
      readonly closureConfirmation: string;
      readonly counts: Readonly<Record<CompanyPurgeResource, number>>;
    };

/** Lê o JSON de `operator_preview_company_purge`; forma inesperada vira "não encontrada". */
export function parseOperatorPurgePreview(raw: unknown): OperatorPurgePreview {
  const base = parseCompanyPurgePreview(raw);
  if (!base.found) return { found: false };
  const closureConfirmation = (raw as { closure_confirmation?: unknown }).closure_confirmation;
  if (typeof base.registered !== "boolean" || typeof closureConfirmation !== "string") return { found: false };
  return {
    found: true,
    closed: base.closed,
    registered: base.registered,
    confirmation: base.confirmation,
    closureConfirmation,
    counts: base.counts,
  };
}

export type OffboardingRegistrationRefusal = "not_found" | "invalid_reference" | "confirmation_mismatch";

export type OffboardingRegistrationResult =
  | { readonly ok: true; readonly closedNow: boolean; readonly alreadyRegistered: boolean }
  | { readonly ok: false; readonly reason: OffboardingRegistrationRefusal };

const REGISTRATION_REFUSALS: readonly OffboardingRegistrationRefusal[] = [
  "not_found",
  "invalid_reference",
  "confirmation_mismatch",
];

/** Lê o JSON de `operator_register_offboarding`; forma inesperada é falha do banco. */
export function parseOffboardingRegistrationResult(raw: unknown): OffboardingRegistrationResult {
  if (typeof raw !== "object" || raw === null) throw new Error("unexpected registration result");
  const value = raw as { ok?: unknown; reason?: unknown; closed_now?: unknown; already_registered?: unknown };
  if (value.ok === true && typeof value.closed_now === "boolean" && typeof value.already_registered === "boolean") {
    return { ok: true, closedNow: value.closed_now, alreadyRegistered: value.already_registered };
  }
  if (value.ok === false && REGISTRATION_REFUSALS.includes(value.reason as OffboardingRegistrationRefusal)) {
    return { ok: false, reason: value.reason as OffboardingRegistrationRefusal };
  }
  throw new Error("unexpected registration result");
}

export interface OffboardingRegistrationPort {
  register(companyId: string, reference: string, confirmation: string): Promise<OffboardingRegistrationResult>;
}

/** Valida a entrada antes do banco (D-128): identificador malformado nunca chega à RPC. */
export async function registerOffboardingRequest(
  port: OffboardingRegistrationPort,
  input: { readonly companyId: unknown; readonly reference: unknown; readonly confirmation: unknown }
): Promise<OffboardingRegistrationResult> {
  if (!isUuid(input.companyId)) return { ok: false, reason: "not_found" };
  if (!isOffboardingReference(input.reference)) return { ok: false, reason: "invalid_reference" };
  if (typeof input.confirmation !== "string" || input.confirmation.length === 0) {
    return { ok: false, reason: "confirmation_mismatch" };
  }
  return port.register(input.companyId, input.reference, input.confirmation);
}

export const OFFBOARDING_REGISTRATION_MESSAGES: Readonly<Record<OffboardingRegistrationRefusal, string>> = {
  not_found: "Empresa não encontrada ou sem autoridade de offboarding.",
  invalid_reference:
    "Referência inválida. Use o código do registro privado do operador (letras, números e . _ : / -, sem espaços nem e-mail).",
  confirmation_mismatch: "A confirmação não confere. Digite exatamente a frase indicada.",
};
