import type {
  EvidenceSource,
  FinancialKnowledgeGraphAggregate,
  FinancialModelAggregate,
  Indicator,
  IndicatorsAggregate,
} from "@/efos/domain";
import { NODE_ID_PREFIXES } from "@/efos/engines/financial-knowledge-graph";

import {
  CURRENT_LIQUIDITY_MINIMUM,
  OPERATING_CASH_INFLOW_EVENT_TYPES,
  OPERATING_CASH_OUTFLOW_EVENT_TYPES,
  OVERALL_INDEBTEDNESS_EQUITY_BREAKEVEN,
  RECOGNIZED_INDICATOR_NAMES,
} from "./evidence.constants";
import type { EvidenceDraft } from "./evidence.types";

/**
 * Builder do Evidence Engine. Centraliza toda regra de deteccao de
 * fatos — nenhuma regra vive em evidence.engine.ts. Cada funcao
 * `detect*` le dados ja calculados (Indicator, FinancialEvent) e, se o
 * fato for material, produz um `EvidenceDraft`; caso contrario retorna
 * `[]`. Nunca interpreta causa, nunca recomenda, nunca preve — apenas
 * compara valores ja calculados contra limiares deterministicos
 * (evidence.constants.ts). Nao usa IA sob nenhuma circunstancia.
 *
 * Cobre os fatos de docs/ARCHITECTURE.md/Mission 009 que sao
 * computaveis a partir de uma unica execucao do pipeline (sem serie
 * historica): liquidez abaixo do minimo, margem negativa, capital de
 * giro insuficiente, patrimonio liquido negativo (Mission 104), fluxo
 * de caixa operacional negativo. "Receita crescente" e "despesas
 * aumentaram" exigem comparar dois periodos — nao implementados nesta
 * fase (ver README.md, "Limitacoes").
 */

/** Exportada para reuso por `evidence.temporal.builder.ts` (Mission 166, D-087) — nenhuma segunda implementação de busca por nome. */
export function findIndicatorByName(
  indicators: IndicatorsAggregate,
  name: string
): Indicator | undefined {
  return indicators.indicators.find((indicator) => indicator.name === name);
}

/**
 * Fonte de um Indicator, com a aresta correspondente no grafo quando
 * ela existe (o Financial Knowledge Graph Engine usa o mesmo esquema
 * de id deterministico — `NODE_ID_PREFIXES`, publico via
 * @/efos/engines/financial-knowledge-graph — para nomear seus nos;
 * este Engine nunca inventa um id de no que nao esteja de fato presente
 * no grafo recebido).
 */
/** Exportada para reuso por `evidence.temporal.builder.ts` (Mission 166, D-087). */
export function sourcesForIndicator(
  indicator: Indicator,
  graph: FinancialKnowledgeGraphAggregate
): EvidenceSource[] {
  const sources: EvidenceSource[] = [
    { type: "indicator", id: indicator.id },
  ];

  const expectedNodeId = `${NODE_ID_PREFIXES.indicator}-${indicator.id}`;
  const node = graph.nodes.find((n) => n.id === expectedNodeId);
  if (node) {
    sources.push({ type: "graph_node", id: node.id });
  }

  return sources;
}

/** Exportada para reuso por `evidence.temporal.builder.ts` (Mission 166, D-087). */
export function sourcesForEvents(
  events: FinancialModelAggregate["events"],
  graph: FinancialKnowledgeGraphAggregate
): EvidenceSource[] {
  const sources: EvidenceSource[] = [];

  for (const event of events) {
    sources.push({ type: "financial_event", id: event.id });

    const expectedNodeId = `${NODE_ID_PREFIXES.financial_event}-${event.id}`;
    const node = graph.nodes.find((n) => n.id === expectedNodeId);
    if (node) {
      sources.push({ type: "graph_node", id: node.id });
    }
  }

  return sources;
}

function severityForLiquidity(value: number): EvidenceDraft["severity"] {
  if (value < 0.5) return "critical";
  if (value < 0.8) return "high";
  return "medium";
}

function severityForNegativeMargin(value: number): EvidenceDraft["severity"] {
  if (value < -20) return "critical";
  if (value < -10) return "high";
  return "medium";
}

/**
 * `Liquidez Corrente = Ativo Circulante / Passivo Circulante`
 * (`indicators.calculator.ts`, `safeDivide`) e `unavailable` quando o
 * Passivo Circulante e 0 (sem dado, divisor 0) — o `IndicatorResult`
 * (Mission 098, D-052) ja distingue esse caso de um resultado
 * genuinamente baixo, entao esta funcao so precisa checar
 * `result.status`. O guard ad hoc `hasCurrentLiabilityData()` (Mission
 * 097, D-051) resolvia o mesmo problema por fora do tipo e foi
 * removido — redundante com o novo contrato.
 */
export function detectLiquidityBelowMinimum(
  indicators: IndicatorsAggregate,
  graph: FinancialKnowledgeGraphAggregate
): EvidenceDraft[] {
  const indicator = findIndicatorByName(
    indicators,
    RECOGNIZED_INDICATOR_NAMES.currentLiquidity
  );
  if (!indicator || indicator.result.status !== "available") return [];
  if (indicator.result.value >= CURRENT_LIQUIDITY_MINIMUM) return [];

  const { value } = indicator.result;

  return [
    {
      key: "liquidity-below-minimum",
      type: "negative",
      category: "liquidity",
      severity: severityForLiquidity(value),
      confidence: "verified",
      title: "Liquidez abaixo do mínimo",
      description: `A Liquidez Corrente (${value.toFixed(2)}) está abaixo do mínimo saudável (${CURRENT_LIQUIDITY_MINIMUM}) — o Ativo Circulante não cobre integralmente o Passivo Circulante.`,
      supportingData: {
        indicatorName: indicator.name,
        value,
        threshold: CURRENT_LIQUIDITY_MINIMUM,
        unit: indicator.unit,
      },
      sources: sourcesForIndicator(indicator, graph),
    },
  ];
}

const NEGATIVE_MARGIN_INDICATORS: ReadonlyArray<{
  readonly key: string;
  readonly name: string;
  readonly label: string;
}> = [
  {
    key: "gross-margin-negative",
    name: RECOGNIZED_INDICATOR_NAMES.grossMargin,
    label: "Margem Bruta",
  },
  {
    key: "operating-margin-negative",
    name: RECOGNIZED_INDICATOR_NAMES.operatingMargin,
    label: "Margem Operacional",
  },
  {
    key: "net-margin-negative",
    name: RECOGNIZED_INDICATOR_NAMES.netMargin,
    label: "Margem Líquida",
  },
];

export function detectNegativeMargins(
  indicators: IndicatorsAggregate,
  graph: FinancialKnowledgeGraphAggregate
): EvidenceDraft[] {
  const drafts: EvidenceDraft[] = [];

  for (const { key, name, label } of NEGATIVE_MARGIN_INDICATORS) {
    const indicator = findIndicatorByName(indicators, name);
    if (!indicator || indicator.result.status !== "available") continue;
    if (indicator.result.value >= 0) continue;

    const { value } = indicator.result;

    drafts.push({
      key,
      type: "negative",
      category: "profitability",
      severity: severityForNegativeMargin(value),
      confidence: "verified",
      title: `${label} negativa`,
      description: `A ${label} (${value.toFixed(2)}%) está negativa neste período.`,
      supportingData: {
        indicatorName: indicator.name,
        value,
        unit: indicator.unit,
      },
      sources: sourcesForIndicator(indicator, graph),
    });
  }

  return drafts;
}

export function detectInsufficientWorkingCapital(
  indicators: IndicatorsAggregate,
  graph: FinancialKnowledgeGraphAggregate
): EvidenceDraft[] {
  const indicator = findIndicatorByName(
    indicators,
    RECOGNIZED_INDICATOR_NAMES.workingCapital
  );
  if (!indicator || indicator.result.status !== "available") return [];
  if (indicator.result.value >= 0) return [];

  const { value } = indicator.result;

  return [
    {
      key: "working-capital-insufficient",
      type: "negative",
      category: "working_capital",
      severity: "high",
      confidence: "verified",
      title: "Capital de giro insuficiente",
      description: `O Capital de Giro (${value.toFixed(2)}) é negativo — o Ativo Circulante é menor que o Passivo Circulante.`,
      supportingData: {
        indicatorName: indicator.name,
        value,
        unit: indicator.unit,
      },
      sources: sourcesForIndicator(indicator, graph),
    },
  ];
}

/**
 * Endividamento Geral (`Passivo Total / Ativo Total × 100`,
 * `indicators.calculator.ts`) acima de `OVERALL_INDEBTEDNESS_EQUITY_BREAKEVEN`
 * (100) implica `equity = totalAssets - totalLiabilities < 0` por
 * identidade algébrica (D-004) — Patrimônio Líquido negativo. Esta
 * função afirma exclusivamente esse fato matemático (Mission 104,
 * "REGRA CRÍTICA": nunca conclui insolvência, falência, inadimplência
 * ou crise de liquidez — essas são interpretações que os dados
 * disponíveis não sustentam sozinhos). `category: "debt"` — nenhuma
 * regra de Context existente (`context.constants.ts`,
 * `CASH_PRESSURE_EVIDENCE_CATEGORIES`/`PROFITABILITY_EVIDENCE_CATEGORIES`)
 * reconhece essa categoria; a cadeia executiva para deliberadamente em
 * Evidence — nenhum Context/Reasoning/Recommendation/Decision novo foi
 * criado para forçar a cadeia adiante sem fundamento (Mission 104,
 * Etapa 11/19, GAP registrado em docs/ENGINEERING_LOG.md).
 *
 * `severity: "high"` é fixa (não uma escala graduada nova) — por
 * analogia estrutural com `detectInsufficientWorkingCapital` (mesma
 * classe de fato: passivo excede ativo; aqui em escopo total, não
 * apenas circulante, logo ao menos igualmente severo) — nunca um
 * limiar numérico inventado (Mission 103 confirmou que graduar
 * severidade por faixas exigiria um benchmark sem fonte documentada).
 * `confidence: "verified"` — lida diretamente de um `Indicator` já
 * calculado e validado, mesmo padrão de `detectLiquidityBelowMinimum`/
 * `detectNegativeMargins`/`detectInsufficientWorkingCapital`.
 */
export function detectNegativeEquity(
  indicators: IndicatorsAggregate,
  graph: FinancialKnowledgeGraphAggregate
): EvidenceDraft[] {
  const indicator = findIndicatorByName(
    indicators,
    RECOGNIZED_INDICATOR_NAMES.overallIndebtedness
  );
  if (!indicator || indicator.result.status !== "available") return [];
  if (indicator.result.value <= OVERALL_INDEBTEDNESS_EQUITY_BREAKEVEN) return [];

  const { value } = indicator.result;

  return [
    {
      key: "negative-equity",
      type: "negative",
      category: "debt",
      severity: "high",
      confidence: "verified",
      title: "Patrimônio líquido negativo",
      description: `O Endividamento Geral (${value.toFixed(2)}%) está acima de ${OVERALL_INDEBTEDNESS_EQUITY_BREAKEVEN}% — o passivo total supera o ativo total, resultando em patrimônio líquido negativo.`,
      supportingData: {
        indicatorName: indicator.name,
        value,
        threshold: OVERALL_INDEBTEDNESS_EQUITY_BREAKEVEN,
        unit: indicator.unit,
      },
      sources: sourcesForIndicator(indicator, graph),
    },
  ];
}

/**
 * Fluxo de caixa operacional de um único período — nao existe como
 * Indicator oficial (Indicators Engine nao o calcula). Convencao
 * propria deste Engine, mesmo espirito de docs/DECISIONS.md D-004:
 * `sale`/`receipt` sao entradas de caixa operacional, `purchase`/
 * `payment` sao saidas (`evidence.constants.ts`,
 * OPERATING_CASH_INFLOW_EVENT_TYPES/OPERATING_CASH_OUTFLOW_EVENT_TYPES).
 *
 * Extraída como função pura reutilizável (Mission 166 — Temporal
 * Evidence Detection, D-087, Etapa "Shared Calculation Extraction"):
 * `detectNegativeOperatingCashFlow()` (período único, abaixo) e a
 * regra temporal de fluxo de caixa (`evidence.temporal.builder.ts`)
 * chamam exatamente esta função sobre `FinancialModelAggregate.events`
 * — nunca uma segunda formula paralela. Comportamento idêntico ao
 * anterior a esta missão (mesmos `Math.abs()`, mesmos filtros).
 */
export function computeOperatingCashFlow(
  events: FinancialModelAggregate["events"]
): {
  readonly inflowEvents: FinancialModelAggregate["events"];
  readonly outflowEvents: FinancialModelAggregate["events"];
  readonly inflow: number;
  readonly outflow: number;
  readonly netOperatingCashFlow: number;
} {
  const inflowEvents = events.filter((event) =>
    (OPERATING_CASH_INFLOW_EVENT_TYPES as readonly string[]).includes(
      event.type
    )
  );
  const outflowEvents = events.filter((event) =>
    (OPERATING_CASH_OUTFLOW_EVENT_TYPES as readonly string[]).includes(
      event.type
    )
  );

  // `Math.abs()`: o sinal de `event.amount.amount` (Mission 095, D-050)
  // reflete o texto literal do documento (saida = negativo), mas esta
  // funcao ja trata direcao pelo `event.type` (inflow/outflow) e espera
  // magnitudes positivas para `inflow - outflow` fazer sentido — sem
  // isso, uma saida negativa jamais tornaria `netOperatingCashFlow`
  // negativo (achado da Mission 097, D-051).
  const inflow = inflowEvents.reduce(
    (total, event) => total + Math.abs(event.amount?.amount ?? 0),
    0
  );
  const outflow = outflowEvents.reduce(
    (total, event) => total + Math.abs(event.amount?.amount ?? 0),
    0
  );

  return {
    inflowEvents,
    outflowEvents,
    inflow,
    outflow,
    netOperatingCashFlow: inflow - outflow,
  };
}

export function detectNegativeOperatingCashFlow(
  financialModel: FinancialModelAggregate,
  graph: FinancialKnowledgeGraphAggregate
): EvidenceDraft[] {
  const { inflowEvents, outflowEvents, inflow, outflow, netOperatingCashFlow } =
    computeOperatingCashFlow(financialModel.events);

  if (
    (inflowEvents.length === 0 && outflowEvents.length === 0) ||
    netOperatingCashFlow >= 0
  ) {
    return [];
  }

  return [
    {
      key: "operating-cash-flow-negative",
      type: "negative",
      category: "cash_flow",
      severity: "medium",
      confidence: "high",
      title: "Fluxo de caixa operacional negativo",
      description: `As saídas de caixa operacional (${outflow.toFixed(2)}) superaram as entradas (${inflow.toFixed(2)}) neste período.`,
      supportingData: {
        inflow,
        outflow,
        netOperatingCashFlow,
        inflowEventTypes: OPERATING_CASH_INFLOW_EVENT_TYPES,
        outflowEventTypes: OPERATING_CASH_OUTFLOW_EVENT_TYPES,
      },
      sources: sourcesForEvents([...inflowEvents, ...outflowEvents], graph),
    },
  ];
}

export function detectEvidence(
  financialModel: FinancialModelAggregate,
  indicators: IndicatorsAggregate,
  graph: FinancialKnowledgeGraphAggregate
): EvidenceDraft[] {
  return [
    ...detectLiquidityBelowMinimum(indicators, graph),
    ...detectNegativeMargins(indicators, graph),
    ...detectInsufficientWorkingCapital(indicators, graph),
    ...detectNegativeEquity(indicators, graph),
    ...detectNegativeOperatingCashFlow(financialModel, graph),
  ];
}
