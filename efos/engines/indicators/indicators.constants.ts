/**
 * Constantes do Indicators Engine — id/nome/categoria/unidade de cada
 * indicador suportado, e mensagens de validacao. Nenhuma formula e
 * nenhum calculo aqui (isso pertence a indicators.calculator.ts).
 */

import type { FinancialStateCategory, IndicatorUnit } from "@/efos/domain";

export const INDICATORS_ENGINE_CONSTANTS = {
  id: "indicators",
  name: "Indicators Engine",
  version: "0.1.0",
  /** Prefixo do id deterministico de cada Indicator (ver indicators.mapper.ts). */
  idPrefix: "indicator",
  /** Dias assumidos por periodo quando o Financial Model nao permite derivar um intervalo real (ver README.md, "Limitacoes"). */
  defaultPeriodInDays: 365,
} as const;

export const INDICATORS_ENGINE_MESSAGES = {
  invalidInput: "Entrada invalida para o Indicators Engine.",
  missingCompanyId: "companyId e obrigatorio.",
  missingFinancialModel: "financialModel e obrigatorio.",
  missingFinancialModelRoot: "financialModel.root e obrigatorio.",
  financialModelCompanyMismatch:
    "financialModel.root.companyId nao corresponde ao companyId informado.",
  // Mission 192 — Canonical Financial Statement Ingestion & Period
  // Semantics, D-107: nenhum periodo genuino de referencia pode ser
  // determinado (nem StatementLine.period de um demonstrativo, nem
  // >=2 FinancialEvent com data) — falha explicita, nunca um periodo
  // fabricado a partir do relogio de execucao.
  periodUnavailable:
    "Nao foi possivel determinar o periodo financeiro real dos documentos enviados — nenhuma data de evento nem periodo de demonstrativo pode ser identificado.",
} as const;

/** Slugs estaveis de cada indicador — usados para compor o id deterministico do Indicator. */
export const INDICATOR_SLUGS = {
  currentLiquidity: "liquidez-corrente",
  quickLiquidity: "liquidez-seca",
  immediateLiquidity: "liquidez-imediata",
  workingCapital: "capital-de-giro",
  grossMargin: "margem-bruta",
  operatingMargin: "margem-operacional",
  netMargin: "margem-liquida",
  ebitda: "ebitda",
  ebit: "ebit",
  roi: "roi",
  roe: "roe",
  roa: "roa",
  assetTurnover: "giro-do-ativo",
  overallIndebtedness: "endividamento-geral",
  debtComposition: "composicao-do-endividamento",
  interestCoverage: "cobertura-de-juros",
  financialCycle: "ciclo-financeiro",
  averageReceiptPeriod: "prazo-medio-de-recebimento",
  averagePaymentPeriod: "prazo-medio-de-pagamento",
  averageInventoryPeriod: "prazo-medio-de-estoque",
} as const;

/**
 * Mission 183 — Executive Scenario Comparison (D-093).
 *
 * Direção de favorabilidade de um indicador — "maior é melhor" ou
 * "menor é melhor". Mesmo vocabulário de duas palavras já usado por
 * `MetricDirectionality` (`efos/engines/evidence/evidence.temporal.builder.ts`,
 * D-087) — nunca importado de lá (Evidence é downstream de Indicators
 * na cadeia principal do pipeline; Indicators nunca depende de Evidence)
 * — reafirmado aqui, de forma independente, como o mesmo conceito
 * aplicado ao dicionário canônico completo de 20 indicadores, não
 * apenas aos 8 que D-087 usa para Evidence temporal.
 */
export type IndicatorDirectionality = "higher_is_favorable" | "lower_is_favorable";

interface IndicatorDefinition {
  readonly slug: string;
  readonly name: string;
  readonly category: FinancialStateCategory;
  readonly unit: IndicatorUnit;
  /**
   * Ausente quando o domínio não tem uma interpretação universalmente
   * segura de "maior/menor é melhor" para este indicador — nunca
   * adivinhado. Confirma explicitamente, para os 4 indicadores já
   * cobertos por D-087 (`grossMargin`/`operatingMargin`/`netMargin`/
   * `currentLiquidity`/`quickLiquidity`/`immediateLiquidity`/
   * `averageReceiptPeriod` — 7 dos 8, `operating-cash-flow` do D-087
   * não corresponde a nenhum indicador deste dicionário), o MESMO
   * valor que D-087 já usa — nunca um segundo julgamento divergente
   * para o mesmo conceito. `workingCapital`/`assetTurnover`/
   * `overallIndebtedness`/`debtComposition`/`averagePaymentPeriod`/
   * `averageInventoryPeriod`/`financialCycle` permanecem
   * deliberadamente SEM direção — o mesmo padrão de cautela que D-087
   * já aplicou a `workingCapital`/`overallIndebtedness`/
   * `debtComposition`/`averagePaymentPeriod` (ex.: pagar fornecedores
   * mais tarde melhora caixa mas pode prejudicar a relação comercial —
   * genuinamente ambíguo, nunca resolvido por suposição).
   */
  readonly directionality?: IndicatorDirectionality;
}

/** Metadados fixos (nome/categoria/unidade) de cada indicador calculado por este Engine. */
export const INDICATOR_DEFINITIONS: Record<
  keyof typeof INDICATOR_SLUGS,
  IndicatorDefinition
> = {
  currentLiquidity: {
    slug: INDICATOR_SLUGS.currentLiquidity,
    name: "Liquidez Corrente",
    category: "liquidity",
    unit: "ratio",
    directionality: "higher_is_favorable", // D-087 ("current-liquidity")
  },
  quickLiquidity: {
    slug: INDICATOR_SLUGS.quickLiquidity,
    name: "Liquidez Seca",
    category: "liquidity",
    unit: "ratio",
    directionality: "higher_is_favorable", // D-087 ("quick-liquidity")
  },
  immediateLiquidity: {
    slug: INDICATOR_SLUGS.immediateLiquidity,
    name: "Liquidez Imediata",
    category: "liquidity",
    unit: "ratio",
    directionality: "higher_is_favorable", // D-087 ("immediate-liquidity")
  },
  workingCapital: {
    slug: INDICATOR_SLUGS.workingCapital,
    name: "Capital de Giro",
    category: "liquidity",
    unit: "currency",
    // Sem direção — D-087 já exclui workingCapital deliberadamente.
  },
  grossMargin: {
    slug: INDICATOR_SLUGS.grossMargin,
    name: "Margem Bruta",
    category: "profitability",
    unit: "percentage",
    directionality: "higher_is_favorable", // D-087 ("gross-margin")
  },
  operatingMargin: {
    slug: INDICATOR_SLUGS.operatingMargin,
    name: "Margem Operacional",
    category: "profitability",
    unit: "percentage",
    directionality: "higher_is_favorable", // D-087 ("operating-margin")
  },
  netMargin: {
    slug: INDICATOR_SLUGS.netMargin,
    name: "Margem Líquida",
    category: "profitability",
    unit: "percentage",
    directionality: "higher_is_favorable", // D-087 ("net-margin")
  },
  ebitda: {
    slug: INDICATOR_SLUGS.ebitda,
    name: "EBITDA",
    category: "profitability",
    unit: "currency",
    directionality: "higher_is_favorable", // mais lucro operacional é inequivocamente favorável
  },
  ebit: {
    slug: INDICATOR_SLUGS.ebit,
    name: "EBIT",
    category: "profitability",
    unit: "currency",
    directionality: "higher_is_favorable",
  },
  roi: {
    slug: INDICATOR_SLUGS.roi,
    name: "ROI",
    category: "profitability",
    unit: "percentage",
    directionality: "higher_is_favorable",
  },
  roe: {
    slug: INDICATOR_SLUGS.roe,
    name: "ROE",
    category: "profitability",
    unit: "percentage",
    directionality: "higher_is_favorable",
  },
  roa: {
    slug: INDICATOR_SLUGS.roa,
    name: "ROA",
    category: "profitability",
    unit: "percentage",
    directionality: "higher_is_favorable",
  },
  assetTurnover: {
    slug: INDICATOR_SLUGS.assetTurnover,
    name: "Giro do Ativo",
    category: "efficiency",
    unit: "ratio",
    // Sem direção — giro muito alto pode indicar subcapitalização, nunca avaliado com segurança.
  },
  overallIndebtedness: {
    slug: INDICATOR_SLUGS.overallIndebtedness,
    name: "Endividamento Geral",
    category: "debt",
    unit: "percentage",
    // Sem direção — mesmo padrão de cautela de D-087 (dívida pode ser alavancagem saudável ou risco).
  },
  debtComposition: {
    slug: INDICATOR_SLUGS.debtComposition,
    name: "Composição do Endividamento",
    category: "debt",
    unit: "percentage",
    // Sem direção — D-087 já exclui debtComposition deliberadamente.
  },
  interestCoverage: {
    slug: INDICATOR_SLUGS.interestCoverage,
    name: "Cobertura de Juros",
    category: "debt",
    unit: "ratio",
    directionality: "higher_is_favorable", // mais cobertura é inequivocamente mais seguro
  },
  financialCycle: {
    slug: INDICATOR_SLUGS.financialCycle,
    name: "Ciclo Financeiro",
    category: "efficiency",
    unit: "days",
    // Sem direção — composto por 3 prazos, um dos quais (pagamento) é ele mesmo ambíguo.
  },
  averageReceiptPeriod: {
    slug: INDICATOR_SLUGS.averageReceiptPeriod,
    name: "Prazo Médio de Recebimento",
    category: "efficiency",
    unit: "days",
    directionality: "lower_is_favorable", // D-087 ("average-receipt-period")
  },
  averagePaymentPeriod: {
    slug: INDICATOR_SLUGS.averagePaymentPeriod,
    name: "Prazo Médio de Pagamento",
    category: "efficiency",
    unit: "days",
    // Sem direção — D-087 já exclui averagePaymentPeriod deliberadamente (pagar mais tarde ajuda caixa, pode prejudicar relação comercial).
  },
  averageInventoryPeriod: {
    slug: INDICATOR_SLUGS.averageInventoryPeriod,
    name: "Prazo Médio de Estoque",
    category: "efficiency",
    unit: "days",
    // Sem direção — nunca avaliado por D-087, mesma ambiguidade potencial (estoque sazonal etc.).
  },
};
