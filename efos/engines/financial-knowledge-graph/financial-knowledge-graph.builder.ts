import type {
  FinancialModelAggregate,
  GraphEdge,
  GraphNode,
  Indicator,
  IndicatorsAggregate,
  Period,
} from "@/efos/domain";

import {
  EDGE_ID_PREFIX,
  NODE_ID_PREFIXES,
} from "./financial-knowledge-graph.constants";
import type { BuiltGraph } from "./financial-knowledge-graph.types";

/**
 * Builder do Financial Knowledge Graph Engine. Centraliza toda a lógica
 * de construção do grafo — nenhuma regra estrutural (formato de id,
 * quais nós/arestas existem) vive em financial-knowledge-graph.engine.ts.
 *
 * Constrói nós para Company, Period, Account (categoria de indicador),
 * Resource, FinancialEvent e Indicator, e arestas tipadas conectando-os
 * (vocabulário fechado em efos/domain/enums/graph.ts). Não interpreta,
 * não infere relação nova além do que os agregados de entrada já
 * expressam estruturalmente — ver README.md, "Limitações".
 */

function buildCompanyNode(companyId: string): GraphNode {
  return {
    id: `${NODE_ID_PREFIXES.company}-${companyId}`,
    type: "company",
    label: companyId,
    metadata: {},
  };
}

function buildPeriodNode(period: Period): GraphNode {
  return {
    id: `${NODE_ID_PREFIXES.period}-${period.startDate}-${period.endDate}`,
    type: "period",
    label: `${period.startDate} — ${period.endDate}`,
    metadata: { startDate: period.startDate, endDate: period.endDate },
  };
}

function buildAccountNode(category: Indicator["category"]): GraphNode {
  return {
    id: `${NODE_ID_PREFIXES.account}-${category}`,
    type: "account",
    label: category,
    metadata: { category },
  };
}

function buildResourceNode(
  resource: FinancialModelAggregate["resources"][number]
): GraphNode {
  return {
    id: `${NODE_ID_PREFIXES.resource}-${resource.id}`,
    type: "resource",
    label: resource.label,
    metadata: {
      resourceType: resource.type,
      value: resource.value,
    },
  };
}

function buildEventNode(
  event: FinancialModelAggregate["events"][number]
): GraphNode {
  return {
    id: `${NODE_ID_PREFIXES.financial_event}-${event.id}`,
    type: "financial_event",
    label: event.type,
    metadata: {
      eventType: event.type,
      amount: event.amount,
      occurredAt: event.occurredAt,
    },
  };
}

function buildIndicatorNode(indicator: Indicator): GraphNode {
  return {
    id: `${NODE_ID_PREFIXES.indicator}-${indicator.id}`,
    type: "indicator",
    label: indicator.name,
    metadata: {
      category: indicator.category,
      unit: indicator.unit,
      result: indicator.result,
      formula: indicator.formula,
    },
  };
}

function buildEdge(
  relation: GraphEdge["relation"],
  source: GraphNode,
  target: GraphNode,
  metadata: Readonly<Record<string, unknown>> = {}
): GraphEdge {
  return {
    id: `${EDGE_ID_PREFIX}-${relation}-${source.id}-${target.id}`,
    source: source.id,
    target: target.id,
    relation,
    metadata,
  };
}

export function buildFinancialKnowledgeGraph(
  financialModel: FinancialModelAggregate,
  indicatorsAggregate: IndicatorsAggregate
): BuiltGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const companyNode = buildCompanyNode(financialModel.root.companyId);
  nodes.push(companyNode);

  // Resources — Company -[HAS_RESOURCE]-> Resource
  const resourceNodesById = new Map<string, GraphNode>();
  for (const resource of financialModel.resources) {
    const resourceNode = buildResourceNode(resource);
    resourceNodesById.set(resource.id, resourceNode);
    nodes.push(resourceNode);
    edges.push(buildEdge("HAS_RESOURCE", companyNode, resourceNode));
  }

  // Events — Company -[GENERATED]-> FinancialEvent; FinancialEvent -[AFFECTS]-> Resource
  for (const event of financialModel.events) {
    const eventNode = buildEventNode(event);
    nodes.push(eventNode);
    edges.push(buildEdge("GENERATED", companyNode, eventNode));

    for (const relatedResourceId of event.relatedResourceIds ?? []) {
      const resourceNode = resourceNodesById.get(relatedResourceId);
      if (resourceNode) {
        edges.push(buildEdge("AFFECTS", eventNode, resourceNode));
      }
    }
  }

  // Period — um unico no, derivado do periodo compartilhado pelos
  // indicadores desta execucao (todos calculados no mesmo ciclo).
  // Period -[BELONGS_TO]-> Company
  const firstIndicator = indicatorsAggregate.indicators[0];
  const periodNode = firstIndicator
    ? buildPeriodNode(firstIndicator.period)
    : undefined;
  if (periodNode) {
    nodes.push(periodNode);
    edges.push(buildEdge("BELONGS_TO", periodNode, companyNode));
  }

  // Accounts (categorias de indicador) — um no por categoria distinta
  // presente nos indicadores recebidos. Account -[BELONGS_TO]-> Company
  const accountNodesByCategory = new Map<string, GraphNode>();
  for (const indicator of indicatorsAggregate.indicators) {
    if (!accountNodesByCategory.has(indicator.category)) {
      const accountNode = buildAccountNode(indicator.category);
      accountNodesByCategory.set(indicator.category, accountNode);
      nodes.push(accountNode);
      edges.push(buildEdge("BELONGS_TO", accountNode, companyNode));
    }
  }

  // Indicators — Indicator -[PART_OF]-> Account; Account -[MEASURED_BY]-> Indicator;
  // Indicator -[BELONGS_TO]-> Period; Indicator -[CALCULATED_FROM]-> Company.
  for (const indicator of indicatorsAggregate.indicators) {
    const indicatorNode = buildIndicatorNode(indicator);
    nodes.push(indicatorNode);

    const accountNode = accountNodesByCategory.get(indicator.category);
    if (accountNode) {
      edges.push(buildEdge("PART_OF", indicatorNode, accountNode));
      edges.push(buildEdge("MEASURED_BY", accountNode, indicatorNode));
    }

    if (periodNode) {
      edges.push(buildEdge("BELONGS_TO", indicatorNode, periodNode));
    }

    edges.push(buildEdge("CALCULATED_FROM", indicatorNode, companyNode));
  }

  return { nodes, edges };
}
