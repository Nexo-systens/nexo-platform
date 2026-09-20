import type { DomainEntity } from "./base";

/**
 * Modelo Financeiro — representacao unica e viva da realidade financeira
 * de uma empresa. Nao existe um modelo por documento; existe um unico
 * modelo por empresa, que evolui continuamente
 * (docs/01_ARCHITECTURE/06_EFOS CORE.md, secao 2).
 */
export interface FinancialModel extends DomainEntity {
  readonly companyId: string;
}
