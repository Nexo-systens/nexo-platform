import type { MetricComparison } from "@/efos/application/history";
import type { ScenarioMetricComparison } from "@/efos/application/scenario-simulation";

/**
 * Mission 205 — dados dos quadros de produto da página institucional.
 *
 * Todos fictícios. Os valores repetem o que a própria NEXO produziu sobre
 * a fixture sintética local da Mission 204 (`scripts/visual-fixtures/
 * seed-local.ts`): indicadores, variações, evidências e o cenário de
 * redução de despesas saíram dos Engines, não de uma planilha de
 * marketing. Os nomes são genéricos de propósito ("… Exemplo") para não
 * se parecerem com nenhuma empresa real. Nenhum id, CNPJ ou documento.
 */

export const DEMO_COMPANY = "Distribuidora Exemplo";
export const DEMO_PERIOD = { long: "agosto de 2026", short: "ago/2026", previousLong: "julho de 2026" } as const;

const PCT = "percentage" as const;

/** Métricas de manchete (Visão geral), período atual × anterior. */
export const DEMO_HEADLINE: readonly MetricComparison[] = [
  { metricName: "Margem Líquida", previousValue: 1.43, currentValue: -4.26, absoluteChange: -5.69, direction: "decreased", unit: PCT },
  { metricName: "Margem Bruta", previousValue: 31.2, currentValue: 27.35, absoluteChange: -3.85, direction: "decreased", unit: PCT },
  { metricName: "Liquidez Corrente", previousValue: 1.99, currentValue: 1.85, absoluteChange: -0.14, direction: "decreased", unit: "ratio" },
  { metricName: "Endividamento Geral", previousValue: 69.71, currentValue: 76.25, absoluteChange: 6.54, direction: "increased", unit: PCT },
];

export const DEMO_SIGNALS = [
  {
    title: "Declínio sustentado de Margem Líquida",
    detail: "Queda desfavorável em 4 períodos consecutivos, de 01/05/2026 a 31/08/2026.",
    severity: { label: "Severidade alta", tone: "warning" as const },
  },
  {
    title: "Margem Líquida negativa",
    detail: "A Margem Líquida (-4,26%) está negativa neste período.",
    severity: { label: "Severidade média", tone: "info" as const },
  },
  {
    title: "Fluxo de caixa operacional negativo",
    detail: "Saídas operacionais (505.000,00) acima das entradas (390.000,00).",
    severity: { label: "Severidade média", tone: "info" as const },
  },
] as const;

export const DEMO_PENDING_DECISIONS = 6;

export const DEMO_TRAJECTORY = [
  { metric: "Margem Bruta", range: "Observado em jul/2026 – ago/2026 · 4 períodos analisados", state: "Deterioração financeira persistente", tone: "negative" as const },
  { metric: "Margem Líquida", range: "Observado em jul/2026 – ago/2026 · 4 períodos analisados", state: "Deterioração financeira persistente", tone: "negative" as const },
  { metric: "Liquidez Corrente", range: "Observado em mai/2026 – ago/2026 · 4 períodos analisados", state: "Tendência ainda inconclusiva", tone: "neutral" as const },
];

/** Portfólio (Visão executiva): três empresas fictícias em estágios diferentes. */
export const DEMO_PORTFOLIO = [
  {
    company: "Serviços Exemplo",
    stage: "Análise disponível",
    period: "ago/2026",
    netMargin: { metricName: "Margem Líquida", previousValue: 29.24, currentValue: 32.72, absoluteChange: 3.48, direction: "increased", unit: PCT } satisfies MetricComparison,
    trend: { label: "Melhorando", tone: "positive" as const },
    pending: undefined,
    next: "Gerar diagnóstico",
  },
  {
    company: DEMO_COMPANY,
    stage: "Diagnóstico disponível",
    period: "ago/2026",
    netMargin: DEMO_HEADLINE[0],
    trend: { label: "Piorando", tone: "negative" as const },
    pending: DEMO_PENDING_DECISIONS,
    next: "Abrir decisões",
  },
  {
    company: "Participações Exemplo",
    stage: "Aguardando documentos",
    period: undefined,
    netMargin: undefined,
    trend: { label: "Sem comparação", tone: "neutral" as const },
    pending: undefined,
    next: "Enviar documentos",
  },
] as const;

/** Scenario Lab: reduzir despesas operacionais em R$ 60.000 (projeção do Scenario Engine). */
export const DEMO_SCENARIO_ASSUMPTION =
  "Reduzir despesas operacionais em R$ 60.000, mantendo o restante do modelo financeiro (receita, custos, balanço) inalterado.";

export const DEMO_SCENARIO_KEYS = ["ebitda", "ebit", "operatingMargin", "netMargin"] as const;

export const DEMO_SCENARIO: Readonly<Record<(typeof DEMO_SCENARIO_KEYS)[number], ScenarioMetricComparison>> = {
  ebitda: { metricKey: "ebitda", label: "EBITDA", unit: "currency", status: "compared", baselineValue: 33100, projectedValue: 93100, delta: 60000, impact: "favorable" },
  ebit: { metricKey: "ebit", label: "EBIT", unit: "currency", status: "compared", baselineValue: 33100, projectedValue: 93100, delta: 60000, impact: "favorable" },
  operatingMargin: { metricKey: "operatingMargin", label: "Margem Operacional", unit: PCT, status: "compared", baselineValue: 3.01, projectedValue: 8.46, delta: 5.45, impact: "favorable" },
  netMargin: { metricKey: "netMargin", label: "Margem Líquida", unit: PCT, status: "compared", baselineValue: -4.26, projectedValue: 1.19, delta: 5.45, impact: "favorable" },
};
