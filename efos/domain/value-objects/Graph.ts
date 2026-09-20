import type { GraphEdgeRelation, GraphNodeType } from "../enums";

/**
 * No e aresta do Financial Knowledge Graph (Mission 008). Value objects,
 * nao `DomainEntity` — nao carregam `provenance`/`audit` proprios porque
 * representam uma projecao derivada de entidades que ja carregam essa
 * informacao (Resource, FinancialEvent, Indicator etc.); `metadata`
 * carrega o vinculo com a entidade de origem quando aplicavel.
 */
export interface GraphNode {
  readonly id: string;
  readonly type: GraphNodeType;
  readonly label: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface GraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly relation: GraphEdgeRelation;
  readonly metadata: Readonly<Record<string, unknown>>;
}
