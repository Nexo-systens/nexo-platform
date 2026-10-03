import type { ExecutiveFinancialContext } from "@/efos/application/executive-context";
import type { MetricComparison } from "@/efos/application/history";
import type { Evidence, Indicator, IndicatorUnit } from "@/efos/domain";

/**
 * Mission 206 — contextos financeiros SINTÉTICOS para testar a governança
 * de saída da Executive AI sem rede, sem banco e sem dado real. A forma é
 * a de `ExecutiveFinancialContext` (D-058) como os Engines a produzem;
 * valores e textos de evidência seguem o padrão real (pt-BR). Ids são
 * rótulos legíveis de teste, nunca UUIDs reais.
 */

const COMPANY = "empresa-sintetica-m206";
const PERIOD = { startDate: "2026-08-01T00:00:00.000Z", endDate: "2026-08-31T23:59:59.000Z" };
const AUDIT = { createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", version: 1 };
const PROVENANCE = { source: "efos-engine", confidence: { value: 90, level: "high" as const } };

type IndicatorSpec = readonly [id: string, name: string, value: number | null, unit: IndicatorUnit];

function indicator([id, name, value, unit]: IndicatorSpec): Indicator {
  return {
    id,
    provenance: PROVENANCE,
    audit: AUDIT,
    companyId: COMPANY,
    financialModelId: "modelo-sintetico",
    name,
    category: "profitability",
    unit,
    period: PERIOD,
    result: value === null ? { status: "unavailable" } : { status: "available", value },
    formula: "regra sintética",
  } as Indicator;
}

function evidence(
  id: string,
  title: string,
  description: string,
  severity: "low" | "medium" | "high",
  indicatorIds: readonly string[],
  type: "positive" | "negative" | "warning" = "negative"
): Evidence {
  return {
    id,
    provenance: PROVENANCE,
    audit: AUDIT,
    companyId: COMPANY,
    type,
    category: "profitability",
    severity,
    confidence: "high",
    title,
    description,
    supportingData: {},
    sources: indicatorIds.map((indicatorId) => ({ type: "indicator", id: indicatorId })),
    observedPeriod: PERIOD,
  } as Evidence;
}

function context(
  indicators: readonly IndicatorSpec[],
  evidenceList: readonly Evidence[],
  comparison?: readonly MetricComparison[]
): ExecutiveFinancialContext {
  const built = indicators.map(indicator);
  return {
    identity: { companyId: COMPANY },
    period: PERIOD,
    financialTruth: { indicators: built },
    evidence: evidenceList,
    deterministicIntelligence: { contexts: [], reasoning: [], recommendations: [] },
    ...(comparison
      ? {
          historicalIntelligence: {
            comparison: { companyId: COMPANY, previousExecutionId: "execucao-anterior", currentExecutionId: "execucao-atual", metrics: comparison },
          },
        }
      : {}),
    sourceTraceability: { sourceRecordIds: [] },
    unknowns: built
      .filter((item) => item.result.status === "unavailable")
      .map((item) => ({ subject: item.name, reason: "UNKNOWN_CAUSE" as const, impact: `${item.name} indisponível nesta execução.` })),
    conflicts: [],
  };
}

export const NET_MARGIN = "ind-margem-liquida";
export const GROSS_MARGIN = "ind-margem-bruta";
export const CURRENT_LIQUIDITY = "ind-liquidez-corrente";
export const IMMEDIATE_LIQUIDITY = "ind-liquidez-imediata";
export const DEBT = "ind-endividamento-geral";
export const RECEIPT_PERIOD = "ind-prazo-recebimento";
export const EBITDA = "ind-ebitda";
export const ROI = "ind-roi";
export const INTEREST_COVERAGE = "ind-cobertura-juros";
export const QUICK_LIQUIDITY = "ind-liquidez-seca";

/** Empresa saudável: margens positivas e em melhora, liquidez folgada, sem evidência adversa. */
export const HEALTHY = context(
  [
    [NET_MARGIN, "Margem Líquida", 12.4, "percentage"],
    [GROSS_MARGIN, "Margem Bruta", 41.8, "percentage"],
    [CURRENT_LIQUIDITY, "Liquidez Corrente", 2.15, "ratio"],
    [DEBT, "Endividamento Geral", 38.5, "percentage"],
    [EBITDA, "EBITDA", 182400, "currency"],
  ],
  [evidence("evd-melhora-margem", "Melhora sustentada de Margem Líquida", "Margem Líquida apresenta melhora em 3 períodos consecutivos.", "low", [NET_MARGIN], "positive")],
  [
    { metricName: "Margem Líquida", previousValue: 11.1, currentValue: 12.4, absoluteChange: 1.3, direction: "increased", unit: "percentage" },
    { metricName: "Liquidez Corrente", previousValue: 2.02, currentValue: 2.15, absoluteChange: 0.13, direction: "increased", unit: "ratio" },
  ]
);

/** Margem deteriorando: margem líquida negativa e em queda há 4 períodos (comparação com o mês anterior presente). */
export const MARGIN_DETERIORATING = context(
  [
    [NET_MARGIN, "Margem Líquida", -4.26, "percentage"],
    [GROSS_MARGIN, "Margem Bruta", 27.35, "percentage"],
    [CURRENT_LIQUIDITY, "Liquidez Corrente", 1.85, "ratio"],
    [DEBT, "Endividamento Geral", 76.25, "percentage"],
    [EBITDA, "EBITDA", 33100, "currency"],
  ],
  [
    evidence(
      "evd-declinio-margem-liquida",
      "Declínio sustentado de Margem Líquida",
      "Margem Líquida apresenta queda desfavorável em 4 períodos consecutivos, de 01/05/2026 a 31/08/2026.",
      "high",
      [NET_MARGIN]
    ),
    evidence("evd-margem-negativa", "Margem Líquida negativa", "A Margem Líquida (-4,26%) está negativa neste período.", "medium", [NET_MARGIN]),
  ],
  [
    { metricName: "Margem Líquida", previousValue: 1.43, currentValue: -4.26, absoluteChange: -5.69, direction: "decreased", unit: "percentage" },
    { metricName: "Margem Bruta", previousValue: 31.2, currentValue: 27.35, absoluteChange: -3.85, direction: "decreased", unit: "percentage" },
  ]
);

/** Caixa pressionado: liquidez imediata baixa e fluxo operacional negativo, sem comparação temporal. */
export const CASH_PRESSURED = context(
  [
    [NET_MARGIN, "Margem Líquida", 3.1, "percentage"],
    [CURRENT_LIQUIDITY, "Liquidez Corrente", 0.92, "ratio"],
    [IMMEDIATE_LIQUIDITY, "Liquidez Imediata", 0.09, "ratio"],
    [DEBT, "Endividamento Geral", 81.4, "percentage"],
  ],
  [
    evidence(
      "evd-caixa-operacional",
      "Fluxo de caixa operacional negativo",
      "As saídas de caixa operacional (505.000,00) superaram as entradas (390.000,00) neste período.",
      "high",
      [IMMEDIATE_LIQUIDITY]
    ),
    evidence("evd-liquidez-corrente", "Liquidez Corrente abaixo de 1", "A Liquidez Corrente (0,92) está abaixo de 1 neste período.", "medium", [CURRENT_LIQUIDITY]),
  ]
);

/** Receita crescendo com recebimento piorando: crescimento na evidência, prazo de recebimento subindo na comparação. */
export const REVENUE_UP_RECEIVABLES_WORSE = context(
  [
    [NET_MARGIN, "Margem Líquida", 8.2, "percentage"],
    [RECEIPT_PERIOD, "Prazo Médio de Recebimento", 48, "days"],
    [CURRENT_LIQUIDITY, "Liquidez Corrente", 1.42, "ratio"],
  ],
  [
    evidence(
      "evd-crescimento-receita",
      "Crescimento de receita",
      "A receita líquida foi de R$ 1.240.000,00 neste período, contra R$ 1.050.000,00 no período anterior.",
      "low",
      [NET_MARGIN],
      "positive"
    ),
    evidence("evd-prazo-recebimento", "Aumento do prazo médio de recebimento", "O Prazo Médio de Recebimento subiu para 48 dias.", "medium", [RECEIPT_PERIOD], "warning"),
  ],
  [
    { metricName: "Prazo Médio de Recebimento", previousValue: 31, currentValue: 48, absoluteChange: 17, direction: "increased", unit: "days" },
    { metricName: "Margem Líquida", previousValue: 7.5, currentValue: 8.2, absoluteChange: 0.7, direction: "increased", unit: "percentage" },
  ]
);

/** Dado insuficiente: a maior parte dos indicadores indisponível, nenhuma evidência. */
export const INSUFFICIENT_DATA = context(
  [
    [NET_MARGIN, "Margem Líquida", 5.6, "percentage"],
    [ROI, "ROI", null, "percentage"],
    [INTEREST_COVERAGE, "Cobertura de Juros", null, "ratio"],
    [QUICK_LIQUIDITY, "Liquidez Seca", null, "ratio"],
    [CURRENT_LIQUIDITY, "Liquidez Corrente", null, "ratio"],
  ],
  []
);

/** Ausência de indicador: um indicador-chave (Endividamento Geral) indisponível, o resto disponível. */
export const MISSING_INDICATOR = context(
  [
    [NET_MARGIN, "Margem Líquida", 9.8, "percentage"],
    [GROSS_MARGIN, "Margem Bruta", 35.2, "percentage"],
    [CURRENT_LIQUIDITY, "Liquidez Corrente", 1.6, "ratio"],
    [DEBT, "Endividamento Geral", null, "percentage"],
  ],
  [evidence("evd-margem-estavel", "Margem Líquida positiva", "A Margem Líquida (9,80%) está positiva neste período.", "low", [NET_MARGIN], "positive")]
);

export const FIXTURES = {
  HEALTHY,
  MARGIN_DETERIORATING,
  CASH_PRESSURED,
  REVENUE_UP_RECEIVABLES_WORSE,
  INSUFFICIENT_DATA,
  MISSING_INDICATOR,
} as const;
