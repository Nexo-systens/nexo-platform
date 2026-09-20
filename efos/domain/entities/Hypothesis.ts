import type { HypothesisStatus } from "../enums";
import type { DomainEntity } from "./base";

/**
 * Hipotese — explicacao possivel para um conjunto de evidencias
 * (Camada 5 da Ontologia). Pode existir mais de uma hipotese concorrente
 * para o mesmo conjunto de evidencias.
 */
export interface Hypothesis extends DomainEntity {
  readonly companyId: string;
  readonly statement: string;
  readonly status: HypothesisStatus;
  readonly supportingEvidenceIds: readonly string[];
  readonly contradictingEvidenceIds: readonly string[];
}
