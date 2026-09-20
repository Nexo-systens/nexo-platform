// EFOS Platform — Classifiers. Ver README.md deste diretorio.
// FinancialLineClassifier/DefaultFinancialLineClassifier (Mission 046)
// e o primeiro modulo de classificacao deterministica de linhas
// financeiras: RawFinancialDocument (linhas so com label) ->
// RawFinancialDocument (linhas enriquecidas com amount/currency/date/
// kindHint/resourceTypeHint/eventTypeHint, quando detectaveis).
export * from "./detectMonetaryAmount";
export * from "./FinancialLineClassifier";
export * from "./DefaultFinancialLineClassifier";
// FinancialStatementClassifier/DefaultFinancialStatementClassifier
// (Mission 192 — Canonical Financial Statement Ingestion & Period
// Semantics): interpreta demonstrativos agregados por período (DRE) —
// nunca usado no mesmo documento que FinancialLineClassifier (Seção 14
// da missão, Parser vs Interpreter; ver prepareFinancialDocuments.ts
// para o dispatch entre os dois).
export * from "./FinancialStatementClassifier";
export * from "./DefaultFinancialStatementClassifier";
// extractBalanceAsOfDate (Mission 192 Closure — Complete Statement
// Economics & Balance-Date Semantics, D-111): anota a data-base de um
// Balancete/Balanço em linhas já classificadas como recurso — nunca um
// terceiro classificador completo, apenas uma anotação de contexto de
// documento que DefaultFinancialLineClassifier (inalterado) não vê.
export * from "./extractBalanceAsOfDate";
