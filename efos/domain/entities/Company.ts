import type { DomainEntity } from "./base";

/**
 * Empresa — entidade raiz do dominio EFOS. Toda informacao pertence a
 * uma empresa; nada existe isoladamente
 * (docs/01_ARCHITECTURE/04_DOMAIN MODEL.md, "Entidade Central").
 */
export interface Company extends DomainEntity {
  readonly legalName: string;
  readonly tradeName?: string;
  readonly segment?: string;
  readonly size?: string;
}
