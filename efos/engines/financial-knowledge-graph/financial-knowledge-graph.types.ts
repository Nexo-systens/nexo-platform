import type {
  FinancialKnowledgeGraphAggregate,
  FinancialModelAggregate,
  GraphEdge,
  GraphNode,
  IndicatorsAggregate,
} from "@/efos/domain";

/**
 * Entrada do Financial Knowledge Graph Engine: o Financial Model e os
 * Indicadores de uma mesma empresa, ambos ja calculados pelos Engines
 * anteriores do pipeline. Este Engine nunca chama
 * `FinancialModelEngine.execute()` nem `IndicatorsEngine.execute()` —
 * recebe os dois agregados prontos (D-002).
 */
export interface FinancialKnowledgeGraphEngineInput {
  readonly companyId: string;
  readonly financialModel: FinancialModelAggregate;
  readonly indicators: IndicatorsAggregate;
}

export type FinancialKnowledgeGraphEngineOutput = FinancialKnowledgeGraphAggregate;

/** Resultado intermediario do builder — nos e arestas antes de virar o contrato oficial. */
export interface BuiltGraph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}
