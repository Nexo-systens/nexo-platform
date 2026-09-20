import type { DomainEntity } from "./base";

/**
 * Documento — qualquer informacao recebida pela empresa (DRE, Fluxo de
 * Caixa, Extrato, Contrato, NF, Balancete, Planilha, PDF, Imagem, XML —
 * docs/01_ARCHITECTURE/04_DOMAIN MODEL.md, "Documento").
 */
export interface Document extends DomainEntity {
  readonly companyId: string;
  readonly kind: string;
  readonly originalName: string;
}
