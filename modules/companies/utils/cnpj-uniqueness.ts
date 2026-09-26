/**
 * Mission 199B Security Closure — CNPJ Cross-Tenant Enumeration (D-126).
 *
 * A unicidade de `companies.cnpj` é escopada ao dono
 * (`companies_user_id_cnpj_key`, Migration 016), nunca global. Uma
 * violação dessa constraint só pode significar "o PRÓPRIO usuário já
 * tem uma empresa com este CNPJ" — por isso é a única violação que
 * autoriza a mensagem específica de CNPJ duplicado.
 *
 * Qualquer outro 23505 (em especial a antiga unicidade global
 * `companies_document_key`, enquanto um ambiente ainda não aplicou a
 * Migration 016) cai na mensagem genérica: nunca afirmar ao usuário
 * que um CNPJ "já existe" com base em linhas que ele não pode ver.
 */
export const TENANT_SCOPED_CNPJ_CONSTRAINT = "companies_user_id_cnpj_key";

export function isTenantScopedCnpjViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const { code, message } = error as { code?: unknown; message?: unknown };

  return (
    code === "23505" &&
    typeof message === "string" &&
    message.includes(`"${TENANT_SCOPED_CNPJ_CONSTRAINT}"`)
  );
}

export const OWN_DUPLICATE_CNPJ_MESSAGE = "Você já tem uma empresa cadastrada com este CNPJ.";
