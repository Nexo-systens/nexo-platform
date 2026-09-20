import type { FinancialKnowledgeGraphAggregate } from "@/efos/domain";
import type {
  EfosEngine,
  EfosEngineContext,
  EfosEngineResult,
} from "@/efos/interfaces";

import { buildFinancialKnowledgeGraph } from "./financial-knowledge-graph.builder";
import {
  FINANCIAL_KNOWLEDGE_GRAPH_ENGINE_CONSTANTS,
  FINANCIAL_KNOWLEDGE_GRAPH_ENGINE_MESSAGES,
} from "./financial-knowledge-graph.constants";
import { mapBuiltGraphToAggregate } from "./financial-knowledge-graph.mapper";
import type { FinancialKnowledgeGraphEngineInput } from "./financial-knowledge-graph.types";
import { validateFinancialKnowledgeGraphEngineInput } from "./financial-knowledge-graph.validator";

/**
 * Financial Knowledge Graph Engine — terceiro estagio do pipeline
 * oficial (efos/types/pipeline.ts; docs/ARCHITECTURE.md,
 * "Responsabilidade de cada Engine"). Recebe o Financial Model e os
 * Indicadores de uma empresa, valida a consistencia entre os dois
 * agregados, constroi um grafo semantico (nos e arestas tipados) e
 * retorna um FinancialKnowledgeGraphAggregate.
 *
 * Nao interpreta, nao toma decisao, nao gera recomendacao, nao usa IA,
 * nao persiste, nao chama outro Engine. Apenas organiza conhecimento
 * financeiro em estrutura navegavel. Ver README.md, "Limitacoes".
 */
export class FinancialKnowledgeGraphEngine
  implements
    EfosEngine<
      FinancialKnowledgeGraphEngineInput,
      EfosEngineResult<FinancialKnowledgeGraphAggregate>
    >
{
  readonly id = FINANCIAL_KNOWLEDGE_GRAPH_ENGINE_CONSTANTS.id;

  // Parametro `context` exigido pelo contrato comum (efos/interfaces),
  // ainda nao utilizado nesta fase (sem persistencia, sem orquestracao
  // de pipeline).
  async execute(
    input: FinancialKnowledgeGraphEngineInput,
    context: EfosEngineContext // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<EfosEngineResult<FinancialKnowledgeGraphAggregate>> {
    const validation = validateFinancialKnowledgeGraphEngineInput(input);

    if (!validation.valid) {
      return {
        status: "failed",
        error: [
          FINANCIAL_KNOWLEDGE_GRAPH_ENGINE_MESSAGES.invalidInput,
          ...validation.errors,
        ].join(" "),
      };
    }

    const graph = buildFinancialKnowledgeGraph(
      input.financialModel,
      input.indicators
    );

    const aggregate = mapBuiltGraphToAggregate(
      input.companyId,
      input.financialModel.root.id,
      graph
    );

    return {
      status: "completed",
      output: aggregate,
    };
  }
}
