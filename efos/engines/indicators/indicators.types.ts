import type {
  FinancialModelAggregate,
  IndicatorResult,
  IndicatorsAggregate,
} from "@/efos/domain";

/**
 * Entrada do Indicators Engine: o Financial Model completo de uma
 * empresa (raiz + recursos + eventos), produzido pelo Financial Model
 * Engine. Este Engine nunca chama `FinancialModelEngine.execute()` —
 * recebe o agregado ja pronto (D-002).
 */
export interface IndicatorsEngineInput {
  readonly companyId: string;
  readonly financialModel: FinancialModelAggregate;
}

export type IndicatorsEngineOutput = IndicatorsAggregate;

/**
 * Inputs contabeis estruturados, extraidos de `FinancialModelAggregate`
 * por `indicators.mapper.ts` antes de qualquer calculo. `Resource`/
 * `FinancialEvent` sao genericos (Camadas 1-2 da Ontologia); esta
 * estrutura e o resultado de uma convencao de classificacao explicita
 * e documentada — ver docs/DECISIONS.md D-004 e README.md,
 * "Limitações".
 */
export interface FinancialStatementInputs {
  readonly cash: number;
  readonly accountsReceivable: number;
  readonly inventory: number;
  readonly currentAssets: number;
  readonly nonCurrentAssets: number;
  readonly totalAssets: number;
  readonly accountsPayable: number;
  readonly loans: number;
  readonly currentLiabilities: number;
  readonly totalLiabilities: number;
  readonly equity: number;
  readonly totalInvestment: number;
  readonly revenue: number;
  readonly costOfGoodsSold: number;
  readonly operatingExpenses: number;
  readonly grossProfit: number;
  readonly ebitda: number;
  readonly ebit: number;
  readonly netIncome: number;
  readonly interestExpense: number;
  /**
   * Resultado financeiro líquido JÁ RESOLVIDO (Mission 192 Closure —
   * Complete Statement Economics & Balance-Date Semantics, D-110):
   * `financial_income − financial_expense` declarados por um DRE
   * quando existem, ou o valor já netado de uma linha `financial_result`
   * quando é a única fonte, ou `-interestExpense` (comportamento
   * herdado, pré-Mission-192-Closure) quando nenhuma `StatementLine`
   * de demonstrativo existe no `FinancialModel` (caminho puramente
   * transacional/extrato). Alimenta `netIncome` — nunca somado com
   * `interestExpense` (que permanece exclusivo de `interestCoverage`).
   */
  readonly financialResult: number;
  /** Impostos sobre o lucro já resolvidos (magnitude) — `0` quando não declarados. */
  readonly taxes: number;
  /**
   * `false` quando `netIncome` não pôde ser derivado com confiança
   * (DRE incompleto — sem `financial_result`/`taxes` declarados E sem
   * `net_income` explícito para usar como fallback, Seção 11 da
   * missão) — "ausente" nunca é silenciosamente tratado como "zero"
   * aqui; `calculateIndicators()` força `unavailable` em todo indicador
   * que dependa de `netIncome` quando esta flag é `false`, mesmo que
   * `netIncome` em si carregue um número (best-effort, nunca exposto).
   */
  readonly netIncomeAvailable: boolean;
  /** Proveniência da fonte de `netIncome` — nunca exposta como Indicator, apenas para auditoria/teste. */
  readonly netIncomeSource: "derived" | "declared" | "legacy" | "unavailable";
  /**
   * `false` quando um `StatementConflict` de escopo `"income_statement"`
   * existe no `FinancialModel` (Mission 192 Closure B — Deterministic
   * Statement Conflict Governance, D-113): duas ou mais DREs do MESMO
   * período divergiram materialmente e nenhuma foi aceita — as
   * `StatementLine`s conflitantes nunca chegaram a este agregado
   * (`app/api/efos/_shared/resolveStatementConflicts.ts`), então
   * `statementLines` para aquele período está genuinamente vazio, o
   * que SEM esta flag seria indistinguível de "nenhuma DRE jamais
   * existiu" — reabrindo o fallback para soma de eventos (D-109) como
   * se o conflito nunca tivesse acontecido. Quando `false`,
   * `calculateIndicators()` força `unavailable` em `grossMargin`/
   * `operatingMargin`/`ebitda`/`ebit`/`interestCoverage` e, por
   * composição, em qualquer indicador que dependa de `netIncome`
   * (`netIncomeAvailable` também é forçado `false` neste caso) —
   * "conflito" nunca vira "zero" (Seção 18 da missão).
   */
  readonly incomeStatementAvailable: boolean;
  /**
   * `false` quando um `StatementConflict` de escopo `"balance"` existe
   * (dois Balancetes da MESMA data-base divergiram materialmente) —
   * mesmo princípio de `incomeStatementAvailable`, para
   * `cash`/`accountsReceivable`/`inventory`/`accountsPayable`/`loans`/
   * `nonCurrentAssets`/`totalInvestment` (todos genuinamente `0` neste
   * agregado, nunca porque a empresa não tem saldo, mas porque a
   * declaração ficou sem resolução). `calculateIndicators()` força
   * `unavailable` em todo indicador de liquidez/endividamento e, por
   * composição, em qualquer indicador que combine saldo com receita/
   * CMV (ROI/ROE/ROA, giro de ativo, prazos médios).
   */
  readonly balanceAvailable: boolean;
  /**
   * `false` quando o período do DRE e a data-base do Balancete
   * presentes no MESMO `FinancialModel` são genuinamente incompatíveis
   * (`validatePeriodCompatibility()` reporta pelo menos um problema) —
   * Mission 192 Closure B, Seção 14/15/28: DRE Julho + Balancete
   * 31/08, por exemplo. Nunca "último documento vence" entre os dois
   * (são dimensões diferentes de demonstrativo, nunca uma competição) —
   * ambos permanecem no modelo, mas nenhum indicador que MISTURE os
   * dois (ROI/ROE/ROA, giro de ativo, prazos médios) pode ser
   * apresentado como se descrevesse um único recorte temporal
   * coerente. Indicadores puramente de DRE (`grossMargin`/
   * `operatingMargin`/`netMargin`) ou puramente de Balancete
   * (liquidez/endividamento) permanecem inalterados por esta flag —
   * cada um já descreve apenas UMA dimensão temporal.
   */
  readonly crossSourcePeriodCompatible: boolean;
  readonly periodInDays: number;
}

/**
 * Rastreabilidade de `FinancialStatementInputs` (Mission 110 —
 * Indicator Source Traceability): para cada campo monetário de
 * `FinancialStatementInputs`, a lista de `id`s de `Resource`/
 * `FinancialEvent` que genuinamente contribuíram para aquele valor —
 * construída pela **mesma** classificação (D-004) usada por
 * `extractFinancialStatementInputs()`, nunca uma reconstrução
 * posterior/heurística. Campos derivados (`currentAssets`,
 * `totalAssets`, `grossProfit`, `ebitda`, `ebit`, `netIncome`, etc.)
 * carregam a união dos `id`s dos campos que os compõem — espelha
 * exatamente a mesma árvore de derivação aritmética de
 * `extractFinancialStatementInputs()`, nunca uma árvore paralela
 * divergente. `periodInDays` não tem fonte monetária (não é somado a
 * partir de `Resource`/`FinancialEvent`) — omitido de propósito.
 */
export interface FinancialStatementInputSources {
  readonly cash: readonly string[];
  readonly accountsReceivable: readonly string[];
  readonly inventory: readonly string[];
  readonly currentAssets: readonly string[];
  readonly nonCurrentAssets: readonly string[];
  readonly totalAssets: readonly string[];
  readonly accountsPayable: readonly string[];
  readonly loans: readonly string[];
  readonly currentLiabilities: readonly string[];
  readonly totalLiabilities: readonly string[];
  readonly equity: readonly string[];
  readonly totalInvestment: readonly string[];
  readonly revenue: readonly string[];
  readonly costOfGoodsSold: readonly string[];
  readonly operatingExpenses: readonly string[];
  readonly grossProfit: readonly string[];
  readonly ebitda: readonly string[];
  readonly ebit: readonly string[];
  readonly netIncome: readonly string[];
  /**
   * `id`s dos `FinancialEvent`s do tipo `interest_expense` (Mission 111
   * — Interest Expense & Interest Coverage Intelligence, D-057) —
   * nunca eventos `payment` genéricos, nunca eventos de dívida/
   * financiamento (Etapa 4 da missão: principal nunca é confundido com
   * juros).
   */
  readonly interestExpense: readonly string[];
  /** Mission 192 Closure, D-110 — `id`s de `StatementLine` que compõem `financialResult` (nunca `interestExpense`'s ids, fontes distintas). */
  readonly financialResult: readonly string[];
  /** Mission 192 Closure, D-110 — `id`s de `StatementLine` de categoria `taxes`. */
  readonly taxes: readonly string[];
}

/**
 * Resultado bruto de uma formula, antes de virar um `Indicator` de
 * dominio. `sourceRecordIds` (Mission 110) só é preenchido quando
 * `result.status === "available"` — um indicador `unavailable` não tem
 * "origem de um valor" para carregar (D-052 preservado: os dois
 * estados continuam semanticamente distintos). `interestCoverage`
 * (Mission 111, D-057) permanece `unavailable` sempre que nenhum
 * evento `interest_expense` existir — `safeDivide` já trata divisor 0
 * como indisponibilidade, sem nenhum caso especial novo.
 */
export interface CalculatedIndicator {
  readonly key: string;
  readonly result: IndicatorResult;
  readonly formula: string;
  readonly sourceRecordIds?: readonly string[];
}
