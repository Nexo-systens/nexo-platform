import type { DomainEntity } from "./base";

/**
 * Integracao — conexao permanente com uma fonte de dado externa (Banco,
 * ERP, CRM, API, Contabilidade, Folha, Receita, Open Finance —
 * docs/01_ARCHITECTURE/04_DOMAIN MODEL.md, "Integracao").
 */
export interface Integration extends DomainEntity {
  readonly companyId: string;
  readonly provider: string;
  readonly active: boolean;
}
