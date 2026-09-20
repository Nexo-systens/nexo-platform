/**
 * Constantes do Financial Knowledge Graph Engine — prefixos de id por
 * tipo de no, descricoes semanticas de cada tipo de no/relacao, e
 * mensagens de validacao. O vocabulario fechado (`GraphNodeType`,
 * `GraphEdgeRelation`) vive no dominio (`efos/domain/enums/graph.ts`) —
 * este arquivo apenas centraliza como o Engine usa esse vocabulario.
 */

import type { GraphEdgeRelation, GraphNodeType } from "@/efos/domain";

export const FINANCIAL_KNOWLEDGE_GRAPH_ENGINE_CONSTANTS = {
  id: "financial-knowledge-graph",
  name: "Financial Knowledge Graph Engine",
  version: "0.1.0",
} as const;

export const FINANCIAL_KNOWLEDGE_GRAPH_ENGINE_MESSAGES = {
  invalidInput: "Entrada invalida para o Financial Knowledge Graph Engine.",
  missingCompanyId: "companyId e obrigatorio.",
  missingFinancialModel: "financialModel e obrigatorio.",
  missingFinancialModelRoot: "financialModel.root e obrigatorio.",
  missingIndicators: "indicators e obrigatorio.",
  financialModelCompanyMismatch:
    "financialModel.root.companyId nao corresponde ao companyId informado.",
  indicatorsCompanyMismatch:
    "indicators.companyId nao corresponde ao companyId informado.",
  indicatorsFinancialModelMismatch:
    "indicators.financialModelId nao corresponde ao financialModel.root.id.",
} as const;

/** Prefixo de id determinístico por tipo de no — ver financial-knowledge-graph.builder.ts. */
export const NODE_ID_PREFIXES: Record<GraphNodeType, string> = {
  company: "node-company",
  period: "node-period",
  account: "node-account",
  resource: "node-resource",
  financial_event: "node-event",
  indicator: "node-indicator",
};

/** Prefixo de id determinístico de aresta — sempre `edge-{relation}-{source}-{target}`. */
export const EDGE_ID_PREFIX = "edge";

/** Descrição semântica de cada tipo de nó — apenas documentação, sem uso em cálculo. */
export const NODE_TYPE_DESCRIPTIONS: Record<GraphNodeType, string> = {
  company: "A empresa dona do Financial Model.",
  period: "Intervalo temporal de referência dos indicadores calculados.",
  account: "Categoria/agrupamento contábil-semântico (FinancialStateCategory) ao qual indicadores pertencem.",
  resource: "Um Resource do Financial Model (Camada 1 da Ontologia).",
  financial_event: "Um FinancialEvent do Financial Model (Camada 2 da Ontologia).",
  indicator: "Um Indicator calculado pelo Indicators Engine.",
};

/** Descrição semântica de cada relação — apenas documentação, sem uso em cálculo. */
export const EDGE_RELATION_DESCRIPTIONS: Record<GraphEdgeRelation, string> = {
  HAS_RESOURCE: "Company → Resource: a empresa possui este recurso.",
  GENERATED: "Company → FinancialEvent: a empresa gerou este evento financeiro.",
  BELONGS_TO: "Period/Account → Company: o nó pertence ao escopo desta empresa.",
  AFFECTS: "FinancialEvent → Resource: o evento afeta este recurso.",
  MEASURED_BY: "Account → Indicator: a categoria é medida por este indicador.",
  PART_OF: "Indicator → Account: o indicador é parte desta categoria.",
  DERIVED_FROM: "Reservado para lineage granular (Resource/FinancialEvent → Indicator) — não produzido por este Engine nesta fase (ver README, Limitações).",
  CALCULATED_FROM: "Indicator → Company: o indicador foi calculado a partir do Financial Model desta empresa.",
  RELATED_TO: "Reservado para relações genéricas adicionadas por Engines futuros (ex.: Reasoning) — não produzido por este Engine.",
};
