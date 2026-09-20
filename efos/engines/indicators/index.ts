// Indicators Engine — ponto de entrada. Ver README.md deste diretorio.
export * from "./indicators.constants";
export * from "./indicators.engine";
export * from "./indicators.types";
// Mission 180 — Scenario Intelligence Foundation: `extractFinancialStatementInputs`/
// `extractFinancialStatementInputSources`/`calculateIndicators`/
// `deriveIncomeStatementResults` (indicators.calculator.ts) passam a ser
// reaproveitáveis por composições da Application Layer (ex.: Simulation) —
// primeiro consumidor externo a este Engine, nenhuma segunda implementação.
export * from "./indicators.calculator";
