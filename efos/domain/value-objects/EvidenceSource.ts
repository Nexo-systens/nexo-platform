import type { EvidenceSourceType } from "../enums";

/**
 * Referencia de rastreabilidade de uma Evidence ate o elemento que a
 * originou (Mission 009 — Evidence Engine). Value object — sem
 * `provenance`/`audit` proprios, pois e apenas um ponteiro tipado para
 * uma entidade/no/aresta que ja carrega sua propria origem em outro
 * lugar do dominio. Nenhuma Evidence pode existir sem pelo menos uma
 * `EvidenceSource`.
 */
export interface EvidenceSource {
  readonly type: EvidenceSourceType;
  readonly id: string;
}
