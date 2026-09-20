/**
 * Classificacoes das Camadas 1-3 da Ontologia
 * (docs/00_FUNDACION/EXECUTIVE FINANCIAL ONTOLOGY.md).
 */

// Camada 1 — Recursos
export const RESOURCE_TYPES = [
  "cash",
  "client",
  "employee",
  "supplier",
  "product",
  "service",
  "contract",
  "inventory",
  "loan",
  "investment",
  "asset",
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

// Camada 2 — Eventos
export const FINANCIAL_EVENT_TYPES = [
  "sale",
  "purchase",
  "payment",
  "receipt",
  "hiring",
  "termination",
  "investment",
  "financing",
  "renegotiation",
  "delinquency",
  // Mission 111 — Interest Expense & Interest Coverage Intelligence,
  // D-057: representa exclusivamente despesa de juros (nunca principal
  // de empréstimo, nunca tarifa/encargo financeiro genérico — Etapa 4
  // da missão exige distinguir os dois, nunca assumir "pagamento de
  // empréstimo = juros"). Sem este tipo, `Cobertura de Juros`
  // (`EBIT / Despesa com Juros`) era estruturalmente sempre
  // `unavailable` — o único dos 20 indicadores oficiais sem
  // representação de dado alguma no Domain.
  "interest_expense",
] as const;
export type FinancialEventType = (typeof FINANCIAL_EVENT_TYPES)[number];

// Camada 3 — Estados (usado para categorizar Indicadores)
export const FINANCIAL_STATE_CATEGORIES = [
  "liquidity",
  "profitability",
  "solvency",
  "debt",
  "efficiency",
  "growth",
  "risk",
  "competitiveness",
] as const;
export type FinancialStateCategory = (typeof FINANCIAL_STATE_CATEGORIES)[number];

/**
 * Unidade de medida de um Indicador (Mission 007 — Indicators Engine).
 * Puramente descritivo — nao implica nenhum calculo ou formatacao.
 */
export const INDICATOR_UNITS = ["ratio", "percentage", "currency", "days"] as const;
export type IndicatorUnit = (typeof INDICATOR_UNITS)[number];
