import type { ScenarioType } from "../enums";
import type { DomainEntity } from "./base";

/**
 * Cenario — resultado de uma simulacao de decisao futura (Camada 6 da
 * Ontologia: Expandir, Reduzir equipe, Buscar credito, Comprar
 * maquinas, Abrir filial, Aumentar preco, Lancar produto).
 */
export interface Scenario extends DomainEntity {
  readonly companyId: string;
  readonly type: ScenarioType;
  readonly assumptions: readonly string[];
  readonly basedOnHypothesisIds: readonly string[];
}
