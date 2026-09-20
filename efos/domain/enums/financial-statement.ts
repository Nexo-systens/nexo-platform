/**
 * Taxonomia de demonstrativo financeiro (Camada de Demonstrações,
 * Mission 192 — Canonical Financial Statement Ingestion & Period
 * Semantics). Vocabulario FECHADO e proprio — nunca reaproveita
 * `FinancialEventType`/`ResourceType` (Camadas 1-2, transacao/saldo),
 * porque uma linha de demonstrativo agregada por periodo (ex.: "Receita
 * Liquida: R$ 480.000,00" cobrindo Julho/2026 inteiro) nao e nem uma
 * transacao datada nem um saldo pontual — e uma terceira forma
 * economica, com semantica propria (ver docs/DECISIONS.md D-106).
 *
 * Categorias derivadas diretamente do que `extractFinancialStatementInputs`
 * (efos/engines/indicators/indicators.calculator.ts) ja consome hoje via
 * soma de eventos (D-004) — nunca inventadas: cada uma mapeia
 * exatamente para um bucket ja existente (`revenue`/`costOfGoodsSold`/
 * `operatingExpenses`/`interestExpense`) ou para um campo hoje sempre
 * fixo em `0` por falta de dado (`taxes`), documentado como limitacao
 * ja conhecida (ver `deriveIncomeStatementResults()`).
 */
export const STATEMENT_LINE_CATEGORIES = [
  "gross_revenue",
  "revenue_deductions",
  "net_revenue",
  "cost_of_goods_services",
  "gross_profit",
  "operating_expense",
  // Mission 192 Closure — Complete Statement Economics & Balance-Date
  // Semantics, D-110: `financial_result` sozinha não podia representar
  // corretamente um DRE que declara "Receitas Financeiras" E "Despesas
  // Financeiras" como linhas SEPARADAS — as duas mapeavam para a mesma
  // categoria e eram somadas como magnitudes (nunca subtraídas),
  // dobrando o efeito de uma delas em vez de calcular o líquido.
  // `financial_income`/`financial_expense` são a extensão mínima
  // (Seção 7 da missão): cada uma é somada como magnitude, como
  // qualquer outra categoria — o Indicators Engine é quem as subtrai
  // (`financialIncome - financialExpense`) para obter o resultado
  // financeiro líquido. `financial_result` permanece — reservada para
  // o caso mais raro de uma única linha JÁ NETADA pelo documento (ex.:
  // "Resultado Financeiro: -80.000,00") — nesse caso o valor É lido com
  // sinal (nunca `Math.abs()`), porque a linha já É o líquido.
  "financial_income",
  "financial_expense",
  "financial_result",
  "taxes",
  "net_income",
] as const;
export type StatementCategory = (typeof STATEMENT_LINE_CATEGORIES)[number];

/**
 * Tipo de demonstrativo de origem de uma `StatementLine` — puramente
 * descritivo/proveniencia, nunca usado para uma segunda classificacao
 * (a classificacao real e `StatementCategory`). Fechado aos dois tipos
 * que `DefaultFinancialStatementClassifier` (Mission 192) reconhece
 * hoje; `balance_sheet` reservado para uma extensao futura de
 * Balancete/Balanco caso ele venha a precisar do mesmo primitivo de
 * agregado por periodo (hoje Balancete continua mapeado como
 * `Resource`, ver docs/DECISIONS.md D-106, Secao 19 da Mission 192).
 */
export const STATEMENT_TYPES = ["income_statement"] as const;
export type StatementType = (typeof STATEMENT_TYPES)[number];
