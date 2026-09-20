import type { FinancialKnowledgeGraphAggregate } from "@/efos/domain";

import type { BuiltGraph } from "./financial-knowledge-graph.types";

/**
 * Mapper do Financial Knowledge Graph Engine. Responsavel
 * exclusivamente por converter o resultado interno do builder
 * (financial-knowledge-graph.builder.ts) no contrato oficial de saida
 * (FinancialKnowledgeGraphAggregate, efos/domain) — nenhuma logica de
 * construcao de grafo acontece aqui.
 */
export function mapBuiltGraphToAggregate(
  companyId: string,
  financialModelId: string,
  graph: BuiltGraph
): FinancialKnowledgeGraphAggregate {
  return {
    companyId,
    financialModelId,
    nodes: graph.nodes,
    edges: graph.edges,
  };
}
