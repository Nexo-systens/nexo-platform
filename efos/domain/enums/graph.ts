/**
 * Vocabulario do Financial Knowledge Graph (Mission 008). Tipos de no e
 * de relacao sao um conjunto fechado — qualquer no/aresta fora deste
 * vocabulario nao e um Financial Knowledge Graph valido.
 */

export const GRAPH_NODE_TYPES = [
  "company",
  "period",
  "account",
  "resource",
  "financial_event",
  "indicator",
] as const;
export type GraphNodeType = (typeof GRAPH_NODE_TYPES)[number];

export const GRAPH_EDGE_RELATIONS = [
  "HAS_RESOURCE",
  "GENERATED",
  "BELONGS_TO",
  "AFFECTS",
  "MEASURED_BY",
  "PART_OF",
  "DERIVED_FROM",
  "CALCULATED_FROM",
  "RELATED_TO",
] as const;
export type GraphEdgeRelation = (typeof GRAPH_EDGE_RELATIONS)[number];
