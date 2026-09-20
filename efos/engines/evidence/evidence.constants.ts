/**
 * Constantes do Evidence Engine — id/versao, mensagens de validacao,
 * nomes de Indicator reconhecidos por regra, e os limiares
 * deterministicos usados para decidir se um fato e material o
 * suficiente para virar Evidence. Nenhuma logica de deteccao aqui
 * (isso pertence a evidence.builder.ts).
 */

export const EVIDENCE_ENGINE_CONSTANTS = {
  id: "evidence",
  name: "Evidence Engine",
  version: "0.1.0",
  /** Prefixo do id deterministico de cada Evidence (ver evidence.mapper.ts). */
  idPrefix: "evidence",
} as const;

export const EVIDENCE_ENGINE_MESSAGES = {
  invalidInput: "Entrada invalida para o Evidence Engine.",
  missingCompanyId: "companyId e obrigatorio.",
  missingFinancialModel: "financialModel e obrigatorio.",
  missingFinancialModelRoot: "financialModel.root e obrigatorio.",
  missingIndicators: "indicators e obrigatorio.",
  missingFinancialKnowledgeGraph: "financialKnowledgeGraph e obrigatorio.",
  financialModelCompanyMismatch:
    "financialModel.root.companyId nao corresponde ao companyId informado.",
  indicatorsCompanyMismatch:
    "indicators.companyId nao corresponde ao companyId informado.",
  indicatorsFinancialModelMismatch:
    "indicators.financialModelId nao corresponde ao financialModel.root.id.",
  graphCompanyMismatch:
    "financialKnowledgeGraph.companyId nao corresponde ao companyId informado.",
  graphFinancialModelMismatch:
    "financialKnowledgeGraph.financialModelId nao corresponde ao financialModel.root.id.",
  priorPeriodsCompanyMismatch:
    "priorPeriods contem um periodo de outra empresa — financialModel.root.companyId/indicators.companyId devem corresponder ao companyId informado.",
  priorPeriodsFinancialModelMismatch:
    "priorPeriods contem um periodo com financialModelId diferente do financial model atual — todo periodo da mesma empresa compartilha o mesmo financialModelId (D-001).",
  priorPeriodsDuplicate:
    "priorPeriods contem periodos duplicados (mesma data de inicio).",
  priorPeriodsNotStrictlyOrdered:
    "priorPeriods deve estar em ordem cronologica estritamente crescente (mais antigo primeiro).",
  priorPeriodsOverlap:
    "priorPeriods contem periodos sobrepostos entre si ou com o periodo atual.",
} as const;

/**
 * Nomes de Indicator (campo `Indicator.name`, efos/domain) que as
 * regras de deteccao reconhecem. `IndicatorsAggregate` nao expõe um
 * `slug`/`key` estavel — `name` (string em portugues, definida pelo
 * Indicators Engine em indicators.constants.ts) e o unico campo do
 * contrato oficial que identifica de forma legivel qual indicador e
 * qual. Se o Indicators Engine renomear um destes indicadores no
 * futuro, a regra correspondente deixa de disparar silenciosamente —
 * risco aceito nesta fase, documentado em README.md, "Limitacoes".
 */
export const RECOGNIZED_INDICATOR_NAMES = {
  currentLiquidity: "Liquidez Corrente",
  workingCapital: "Capital de Giro",
  grossMargin: "Margem Bruta",
  operatingMargin: "Margem Operacional",
  netMargin: "Margem Líquida",
  overallIndebtedness: "Endividamento Geral",
  // Mission 166 (D-087) — reconhecidos apenas pelas regras temporais
  // (evidence.temporal.builder.ts); nenhuma regra absoluta os usa.
  quickLiquidity: "Liquidez Seca",
  immediateLiquidity: "Liquidez Imediata",
  averageReceiptPeriod: "Prazo Médio de Recebimento",
} as const;

/** Abaixo deste valor, a Liquidez Corrente e considerada abaixo do minimo saudavel (1 = Ativo Circulante cobre exatamente o Passivo Circulante). */
export const CURRENT_LIQUIDITY_MINIMUM = 1;

/**
 * Acima deste valor, o Endividamento Geral (`Passivo Total / Ativo
 * Total × 100`, `indicators.calculator.ts`) implica Patrimônio Líquido
 * negativo — `equity = totalAssets - totalLiabilities` (D-004); se
 * `totalLiabilities > totalAssets`, `equity < 0` por identidade
 * algébrica, nunca uma suposição (Mission 104). `100` não é um
 * benchmark de mercado — é o ponto exato onde Passivo Total iguala
 * Ativo Total, mesma classe de raciocínio já usada por
 * `CURRENT_LIQUIDITY_MINIMUM`.
 */
export const OVERALL_INDEBTEDNESS_EQUITY_BREAKEVEN = 100;

/** Tipos de FinancialEvent tratados como entrada de caixa operacional, para o calculo de fluxo operacional (ver evidence.builder.ts). */
export const OPERATING_CASH_INFLOW_EVENT_TYPES = ["sale", "receipt"] as const;

/** Tipos de FinancialEvent tratados como saida de caixa operacional. */
export const OPERATING_CASH_OUTFLOW_EVENT_TYPES = ["purchase", "payment"] as const;

/**
 * Mission 166 — Temporal Evidence Detection (D-087). Numero minimo de
 * periodos (atual + anteriores) para que "declinio sustentado" seja
 * material o suficiente para virar Evidence — equivalente a 2
 * transicoes desfavoraveis consecutivas. Nao e um numero arbitrario: e
 * o menor tamanho de serie em que "consecutivo" tem significado (2
 * periodos so permitem 1 transicao, indistinguivel de ruido de um
 * unico evento; 3 e o primeiro tamanho que exige repeticao).
 */
export const MINIMUM_PERIODS_FOR_SUSTAINED_DETERIORATION = 3;
