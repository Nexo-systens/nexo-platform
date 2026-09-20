import type { DomainEntity } from "./base";

/**
 * Usuario — pessoa autorizada a atuar sobre uma empresa (CEO, CFO,
 * Contador, Consultor, Gestor Financeiro —
 * docs/01_ARCHITECTURE/04_DOMAIN MODEL.md, "Usuario").
 */
export interface User extends DomainEntity {
  readonly companyId: string;
  readonly name: string;
  readonly role: string;
}
