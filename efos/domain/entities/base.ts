import type { AuditTrail, Provenance } from "../value-objects";

/**
 * Contrato comum a toda entidade do dominio EFOS. Implementa
 * estruturalmente a "Regra Fundamental" de
 * docs/01_ARCHITECTURE/04_DOMAIN MODEL.md: identificador unico, origem,
 * historico, rastreabilidade, auditabilidade, versionamento.
 */
export interface DomainEntity {
  readonly id: string;
  readonly provenance: Provenance;
  readonly audit: AuditTrail;
}
