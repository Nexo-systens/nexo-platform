import type { ConfidenceScore } from "./ConfidenceScore";

/**
 * Origem de um dado ou conclusao — de onde veio, com que confianca.
 * Todo DomainEntity carrega uma Provenance
 * (docs/01_ARCHITECTURE/04_DOMAIN MODEL.md, "Regra Fundamental": toda
 * entidade possui origem).
 */
export interface Provenance {
  readonly source: string;
  readonly confidence: ConfidenceScore;
}

/**
 * Rastro de auditoria de uma entidade — historico e versionamento
 * (Regra Fundamental: historico, rastreabilidade, auditabilidade,
 * versionamento).
 */
export interface AuditTrail {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}
