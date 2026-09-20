import type {
  FinancialModelAggregate,
  IndicatorResult,
  Period,
  StatementCategory,
  StatementLine,
} from "@/efos/domain";

import { INDICATORS_ENGINE_CONSTANTS } from "./indicators.constants";
import type {
  CalculatedIndicator,
  FinancialStatementInputs,
  FinancialStatementInputSources,
} from "./indicators.types";

/**
 * Calculadora do Indicators Engine. Centraliza toda formula e toda
 * classificacao de dados usada por elas — nenhum calculo financeiro
 * acontece em indicators.engine.ts.
 *
 * `Resource`/`FinancialEvent` (efos/domain) sao genericos por design
 * (Camadas 1-2 da Ontologia) e nao carregam rotulos contabeis
 * tradicionais (Ativo Circulante, Contas a Pagar, CMV etc.).
 * `extractFinancialStatementInputs` aplica uma convencao de
 * classificacao explicita e documentada (docs/DECISIONS.md D-004) para
 * derivar esses valores. Nenhum valor e inventado: onde o dominio nao
 * carrega o dado (ex.: depreciacao, juros, impostos), o input
 * correspondente e 0 e o indicador que depende dele fica documentado
 * como limitado (ver README.md).
 */

const UNAVAILABLE: IndicatorResult = { status: "unavailable" };

function available(value: number): IndicatorResult {
  return { status: "available", value };
}

/**
 * `denominator === 0` significa "sem dado suficiente para calcular",
 * nunca "resultado zero" (Mission 098, D-052) — nunca usa `0`, `null`
 * ou `NaN` como marcador de indisponibilidade.
 */
function safeDivide(numerator: number, denominator: number): IndicatorResult {
  if (denominator === 0) return UNAVAILABLE;
  return available(numerator / denominator);
}

/** Aplica um fator (ex.: ×100, ×periodInDays) preservando indisponibilidade. */
function scaleResult(result: IndicatorResult, factor: number): IndicatorResult {
  return result.status === "available"
    ? available(result.value * factor)
    : result;
}

/**
 * Soma/subtrai resultados ja calculados (com sinal). Indisponivel se
 * qualquer parcela for indisponivel — usado por indicadores que
 * combinam multiplas divisoes (ex.: Ciclo Financeiro).
 */
function combineResults(
  parts: ReadonlyArray<{ result: IndicatorResult; sign: 1 | -1 }>
): IndicatorResult {
  let total = 0;
  for (const { result, sign } of parts) {
    if (result.status === "unavailable") return UNAVAILABLE;
    total += sign * result.value;
  }
  return available(total);
}

function sumMoney(values: ReadonlyArray<{ amount: number } | undefined>): number {
  return values.reduce((total, money) => total + (money?.amount ?? 0), 0);
}

/**
 * `id`s dos registros de `records` cujo `amountOf(record)` genuinamente
 * carrega um valor (Mission 110) — a mesma condição que `sumMoney()`
 * soma (`money?.amount ?? 0`), mas aqui só um registro com `Money`
 * real conta como fonte; um registro do tipo certo mas sem `value`/
 * `amount` contribui `0` à soma e não é listado como origem de nada.
 */
function idsWithMoney<T extends { id: string }>(
  records: readonly T[],
  amountOf: (record: T) => { amount: number } | undefined
): readonly string[] {
  return records.filter((record) => amountOf(record) !== undefined).map((record) => record.id);
}

/** União sem duplicatas de listas de `id`, preservando a primeira ordem de aparição. */
function unionIds(...idLists: ReadonlyArray<readonly string[]>): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const ids of idLists) {
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
  }
  return result;
}

/**
 * `sourceRecordIds` de um `CalculatedIndicator` só existe quando o
 * resultado é `available` (D-052 preservado — `unavailable` não tem
 * "origem de um valor" para carregar).
 */
function sourcesForResult(
  result: IndicatorResult,
  ...idLists: ReadonlyArray<readonly string[]>
): readonly string[] | undefined {
  return result.status === "available" ? unionIds(...idLists) : undefined;
}

/**
 * Deriva o periodo financeiro de referencia — de duas fontes GENUINAS
 * possiveis, nunca do relogio de execucao (Mission 192 — Canonical
 * Financial Statement Ingestion & Period Semantics, D-107, aplicando a
 * D-088 — "cronologia de episodio e sempre ordenada por periodo
 * financeiro observado, nunca por tempo de execucao" — pela primeira
 * vez tambem ao proprio Indicators Engine, nao apenas a comparacao
 * historica):
 *
 * 1. `statementLines` (DRE) ja carregam um `period` proprio, declarado
 *    pelo documento (Secao 9/10 da missao) — sempre preferido quando
 *    presente, unido com quaisquer datas de evento genuinas.
 * 2. `events` com `occurredAt` genuino — menor ate o maior, quando
 *    existem pelo menos 2 (um unico ponto nao forma um intervalo real).
 *
 * Quando NENHUM dos dois existe, devolve `undefined` — nunca um
 * periodo fabricado a partir de `new Date()`. O chamador
 * (`IndicatorsEngine.execute()`) trata `undefined` como falha explicita
 * (`status: "failed"`), nunca como um periodo valido "recente".
 */
export function derivePeriod(
  events: FinancialModelAggregate["events"],
  statementLines: readonly StatementLine[] = [],
  resources: FinancialModelAggregate["resources"] = []
): Period | undefined {
  const eventDates = events
    .map((event) => new Date(event.occurredAt).getTime())
    .filter((timestamp) => !Number.isNaN(timestamp));

  const statementDates = statementLines.flatMap((line) => [
    new Date(line.period.startDate).getTime(),
    new Date(line.period.endDate).getTime(),
  ]).filter((timestamp) => !Number.isNaN(timestamp));

  // Mission 192 Closure — Complete Statement Economics & Balance-Date
  // Semantics, D-111: a data-base de um Balancete (`Resource.asOfDate`)
  // é um sinal de cronologia GENUÍNO, tão real quanto o período de um
  // DRE ou a data de um evento — sem ela, uma empresa cujo único
  // documento é um Balancete (nenhum DRE, nenhum evento datado) caía
  // exatamente no caso que D-107 corrigiu (Indicators Engine falhando
  // por "nenhum sinal"), quando na verdade um sinal genuíno sempre
  // existia, apenas não era lido.
  const resourceDates = resources
    .map((resource) => resource.asOfDate)
    .filter((date): date is string => date !== undefined)
    .map((date) => new Date(date).getTime())
    .filter((timestamp) => !Number.isNaN(timestamp));

  // Uma vez que QUALQUER sinal não-transacional existe (demonstrativo
  // OU saldo pontual), datas de evento genuínas — mesmo uma única —
  // são unidas com segurança (nunca fabricadas, apenas incorporadas);
  // a exigência de "pelo menos 2" existe somente para o caso em que
  // eventos são a ÚNICA fonte disponível (ver abaixo).
  if (statementDates.length > 0 || resourceDates.length > 0) {
    const allDates = [...statementDates, ...resourceDates, ...eventDates];
    return {
      startDate: new Date(Math.min(...allDates)).toISOString(),
      endDate: new Date(Math.max(...allDates)).toISOString(),
    };
  }

  if (eventDates.length >= 2) {
    return {
      startDate: new Date(Math.min(...eventDates)).toISOString(),
      endDate: new Date(Math.max(...eventDates)).toISOString(),
    };
  }

  return undefined;
}

function periodInDaysFrom(period: Period): number {
  const spanMs =
    new Date(period.endDate).getTime() - new Date(period.startDate).getTime();
  const spanDays = Math.round(spanMs / (1000 * 60 * 60 * 24));

  return spanDays > 0 ? spanDays : INDICATORS_ENGINE_CONSTANTS.defaultPeriodInDays;
}

/**
 * Resultado da DRE (Lucro Bruto, EBITDA, EBIT, Lucro Líquido) a partir
 * dos valores de entrada que os determinam. Extraída de dentro de
 * `extractFinancialStatementInputs()` (Mission 180 — Scenario
 * Intelligence Foundation) para ser a ÚNICA implementação desta árvore
 * de derivação, reaproveitável por qualquer composição que precise
 * recalcular a DRE a partir de valores hipotéticos (Simulation) sem
 * duplicar a fórmula — mesmo princípio de D-004 (uma única convenção de
 * classificação/cálculo, nunca uma segunda implementação paralela).
 *
 * `financialResult`/`taxes` (Mission 192 Closure — Complete Statement
 * Economics & Balance-Date Semantics, D-110) substituem o antigo
 * parâmetro `interestExpense` nesta fórmula — `interestExpense`
 * (evento `interest_expense`, D-057) permanece um input SEPARADO de
 * `FinancialStatementInputs`, usado exclusivamente por
 * `interestCoverage` (nunca por `netIncome`). O CHAMADOR
 * (`extractFinancialStatementInputs()`) é quem decide o valor já
 * RESOLVIDO de `financialResult`/`taxes` (declarado por um DRE, ou
 * `-interestExpense` como herança do comportamento pré-Mission-192-
 * Closure quando nenhuma `StatementLine` existe) — esta função
 * permanece pura aritmética, nunca decide proveniência.
 *
 * Depreciação/amortização permanece `0` fixo (mesma limitação
 * documentada — nenhum `ResourceType`/`FinancialEventType`/
 * `StatementCategory` a representa hoje).
 */
export function deriveIncomeStatementResults(
  revenue: number,
  costOfGoodsSold: number,
  operatingExpenses: number,
  financialResult: number,
  taxes: number
): {
  readonly grossProfit: number;
  readonly ebitda: number;
  readonly ebit: number;
  readonly netIncome: number;
} {
  const depreciationAndAmortization = 0;

  const grossProfit = revenue - costOfGoodsSold;
  const ebitda = grossProfit - operatingExpenses;
  const ebit = ebitda - depreciationAndAmortization;
  const netIncome = ebit + financialResult - Math.abs(taxes);

  return { grossProfit, ebitda, ebit, netIncome };
}

/**
 * Totais de balanço patrimonial (Ativo Circulante/Total, Passivo
 * Circulante/Total, Patrimônio Líquido) a partir dos 6 saldos de
 * `Resource` que os determinam. Extraída de dentro de
 * `extractFinancialStatementInputs()` (Mission 182 — Scenario Engine
 * Generalization) pelo mesmo motivo de `deriveIncomeStatementResults()`
 * (Mission 180): ser a ÚNICA implementação desta árvore de derivação,
 * reaproveitável por qualquer composição de Simulation que precise
 * recompor o balanço a partir de saldos hipotéticos (ex.: um saldo de
 * caixa/contas a receber projetado) sem duplicar a fórmula.
 *
 * `loan` é tratado como passivo não circulante nesta convenção — o
 * domínio não distingue prazo curto/longo (mesma limitação já
 * documentada, ver README.md).
 */
export function deriveBalanceSheetTotals(
  cash: number,
  accountsReceivable: number,
  inventory: number,
  nonCurrentAssets: number,
  accountsPayable: number,
  loans: number
): {
  readonly currentAssets: number;
  readonly totalAssets: number;
  readonly currentLiabilities: number;
  readonly totalLiabilities: number;
  readonly equity: number;
} {
  const currentAssets = cash + accountsReceivable + inventory;
  const totalAssets = currentAssets + nonCurrentAssets;
  const currentLiabilities = accountsPayable;
  const totalLiabilities = currentLiabilities + loans;
  const equity = totalAssets - totalLiabilities;

  return { currentAssets, totalAssets, currentLiabilities, totalLiabilities, equity };
}

/**
 * Seleciona, dentro de uma `category` de demonstrativo, as linhas que
 * devem efetivamente ser somadas (Mission 192, Secao 32 — "Duplicate
 * Totals"): quando o documento declara um total/subtotal explicito
 * para a categoria (`isTotalLine: true`), APENAS o(s) total(is) e
 * usado — os componentes individuais (ex.: "Despesas com Pessoal" +
 * "Despesas Administrativas") sao ignorados para fins de soma, nunca
 * somados junto do total que ja os inclui. Quando nenhum total
 * explicito existe, todos os componentes da categoria sao somados
 * (assume-se que sao itens distintos, nunca sobrepostos — a mesma
 * suposicao que qualquer DRE real exige do leitor humano).
 */
function selectStatementLinesForCategory(
  statementLines: readonly StatementLine[],
  category: StatementCategory
): readonly StatementLine[] {
  const matching = statementLines.filter((line) => line.category === category);
  if (matching.length === 0) return [];

  const totals = matching.filter((line) => line.isTotalLine);
  return totals.length > 0 ? totals : matching;
}

function sumStatementLines(lines: readonly StatementLine[]): number {
  return Math.abs(sumMoney(lines.map((line) => line.amount)));
}

/**
 * Receita para fins de margem/indicadores (Mission 192, Secao 18):
 * prefere Receita Liquida quando o documento a declara diretamente
 * (fonte, nunca derivada) — cai para Receita Bruta somente quando
 * Receita Liquida nao foi declarada. Nunca soma as duas (uma nunca e
 * independente da outra na mesma DRE).
 */
function selectRevenueStatementLines(
  statementLines: readonly StatementLine[]
): readonly StatementLine[] {
  const netRevenue = selectStatementLinesForCategory(statementLines, "net_revenue");
  if (netRevenue.length > 0) return netRevenue;
  return selectStatementLinesForCategory(statementLines, "gross_revenue");
}

/**
 * Categorias que só existem quando o Financial Model recebeu ao menos
 * um demonstrativo (DRE) real — usada para distinguir "nenhum DRE
 * existe" (caminho legado, puramente transacional/extrato, Mission
 * 192 Closure, Seção 11: comportamento pré-existente preservado) de
 * "um DRE existe mas está genuinamente incompleto" (resultado
 * financeiro/impostos ausentes exigem revisão — nunca tratados como
 * `0`).
 */
const INCOME_STATEMENT_CATEGORIES: ReadonlySet<StatementCategory> = new Set([
  "gross_revenue",
  "revenue_deductions",
  "net_revenue",
  "cost_of_goods_services",
  "gross_profit",
  "operating_expense",
  "financial_income",
  "financial_expense",
  "financial_result",
  "taxes",
  "net_income",
]);

/**
 * Resultado financeiro líquido já resolvido, com sinal (positivo =
 * receita financeira líquida, negativo = despesa financeira líquida) —
 * `undefined` quando genuinamente não declarado por nenhuma
 * `StatementLine` (Mission 192 Closure, D-110). Nunca `Math.abs()` —
 * este valor É o líquido, ao contrário de `revenue`/`costOfGoodsSold`/
 * `operatingExpenses` (magnitudes sempre subtraídas estruturalmente
 * pela fórmula, D-050/D-051).
 */
function resolveDeclaredFinancialResult(
  statementLines: readonly StatementLine[]
): number | undefined {
  const incomeLines = selectStatementLinesForCategory(statementLines, "financial_income");
  const expenseLines = selectStatementLinesForCategory(statementLines, "financial_expense");

  if (incomeLines.length > 0 || expenseLines.length > 0) {
    return sumStatementLines(incomeLines) - sumStatementLines(expenseLines);
  }

  const netLines = selectStatementLinesForCategory(statementLines, "financial_result");
  if (netLines.length > 0) {
    // Já é o líquido declarado pelo próprio documento — lido com sinal
    // literal (Mission 095/D-050), nunca `Math.abs()`.
    return sumMoney(netLines.map((line) => line.amount));
  }

  return undefined;
}

export function extractFinancialStatementInputs(
  financialModel: FinancialModelAggregate
): FinancialStatementInputs {
  const { resources, events } = financialModel;
  const statementLines = financialModel.statementLines ?? [];

  // Convencao de classificacao de Resources (D-004).
  const cash = sumMoney(
    resources.filter((r) => r.type === "cash").map((r) => r.value)
  );
  const accountsReceivable = sumMoney(
    resources.filter((r) => r.type === "client").map((r) => r.value)
  );
  const inventory = sumMoney(
    resources.filter((r) => r.type === "inventory").map((r) => r.value)
  );
  const accountsPayable = sumMoney(
    resources.filter((r) => r.type === "supplier").map((r) => r.value)
  );
  const loans = sumMoney(
    resources.filter((r) => r.type === "loan").map((r) => r.value)
  );
  const nonCurrentAssets = sumMoney(
    resources
      .filter((r) => r.type === "asset" || r.type === "investment")
      .map((r) => r.value)
  );
  const totalInvestment = sumMoney(
    resources.filter((r) => r.type === "investment").map((r) => r.value)
  );

  const { currentAssets, totalAssets, currentLiabilities, totalLiabilities, equity } =
    deriveBalanceSheetTotals(cash, accountsReceivable, inventory, nonCurrentAssets, accountsPayable, loans);

  // Convencao de classificacao de FinancialEvents (D-004) — "receipt"
  // inclui-se em receita pelo mesmo motivo que "sale": ambos ja sao
  // tratados como entrada de caixa operacional em
  // OPERATING_CASH_INFLOW_EVENT_TYPES (efos/engines/evidence) e como
  // grupo "revenue" por IncomeStatementBuilder (Mission 055) — esta
  // funcao estava inconsistente com as duas, contando apenas "sale" e
  // deixando receita de qualquer extrato sem vocabulario de "venda"
  // sempre em 0 (achado da Mission 097, D-051).
  //
  // `Math.abs()` em cada soma: o sinal de `amount` (Mission 095,
  // D-050) reflete o texto literal do documento (saida = negativo),
  // nao uma convencao contabil de magnitude — estas formulas (Lucro
  // Bruto = Receita - CMV; EBITDA = Lucro Bruto - Despesas
  // Operacionais) assumem magnitudes positivas subtraidas, igual a
  // qualquer DRE. Sem o `Math.abs()`, uma despesa negativa subtraida
  // vira soma (dois negativos), produzindo um "EBIT"/"EBITDA" que
  // reflete o total de saidas de caixa, nao lucro algum (achado da
  // Mission 097, D-051).
  // Mission 192 — Canonical Financial Statement Ingestion & Period
  // Semantics, D-106/D-109: quando o Financial Model carrega
  // `StatementLine`s (DRE) para uma categoria, elas SEMPRE têm
  // precedência sobre a soma de eventos para essa mesma categoria —
  // nunca somadas junto (Seção 26/27 da missão: receita de competência
  // — DRE — e recebimento de caixa — extrato — são bases contábeis
  // diferentes; somar as duas dobraria a receita real quando as duas
  // fontes descrevem o mesmo dinheiro por ângulos distintos). Um
  // extrato bancário sem nenhuma DRE continua funcionando exatamente
  // como antes (fallback para a soma de eventos, comportamento
  // preservado — Seção 21 da missão).
  const revenueStatementLines = selectRevenueStatementLines(statementLines);
  const costOfGoodsSoldStatementLines = selectStatementLinesForCategory(
    statementLines,
    "cost_of_goods_services"
  );
  const operatingExpenseStatementLines = selectStatementLinesForCategory(
    statementLines,
    "operating_expense"
  );

  const revenue =
    revenueStatementLines.length > 0
      ? sumStatementLines(revenueStatementLines)
      : Math.abs(
          sumMoney(
            events
              .filter((e) => e.type === "sale" || e.type === "receipt")
              .map((e) => e.amount)
          )
        );
  const costOfGoodsSold =
    costOfGoodsSoldStatementLines.length > 0
      ? sumStatementLines(costOfGoodsSoldStatementLines)
      : Math.abs(
          sumMoney(events.filter((e) => e.type === "purchase").map((e) => e.amount))
        );
  const operatingExpenses =
    operatingExpenseStatementLines.length > 0
      ? sumStatementLines(operatingExpenseStatementLines)
      : Math.abs(
          sumMoney(events.filter((e) => e.type === "payment").map((e) => e.amount))
        );

  // Juros (Mission 111 — Interest Expense & Interest Coverage
  // Intelligence, D-057): `interest_expense` e um FinancialEventType
  // proprio, deliberadamente separado de `payment` — nunca conta
  // dentro de `operatingExpenses` (filtro acima so aceita `"payment"`)
  // e nunca e confundido com pagamento de principal de divida (Etapa 4
  // da missao). Antes desta missao, `interestExpense` era sempre `0`
  // fixo — unico indicador (Cobertura de Juros) estruturalmente sempre
  // `unavailable`; agora reflete o total real de eventos classificados
  // como juros, quando existirem.
  const interestExpense = Math.abs(
    sumMoney(
      events.filter((e) => e.type === "interest_expense").map((e) => e.amount)
    )
  );

  // Mission 192 Closure — Complete Statement Economics & Balance-Date
  // Semantics, D-110. Três desfechos possíveis, nunca uma quarta opção
  // silenciosa:
  //
  // 1. `financial_income`/`financial_expense`/`financial_result` E
  //    `taxes` declarados → deriva `netIncome` inteiramente a partir
  //    dos componentes (fonte mais confiável — Seção 4/9 da missão).
  // 2. Nenhuma `StatementLine` de DRE existe no Financial Model
  //    (caminho puramente transacional/extrato) → preserva o
  //    comportamento EXATO de antes desta missão
  //    (`financialResult = -interestExpense`, `taxes = 0`, sempre
  //    disponível).
  // 3. Um DRE existe mas está genuinamente incompleto (ex.: declara
  //    Receita/CMV/Despesas/Lucro Líquido, mas nunca Resultado
  //    Financeiro/Impostos) → usa o `net_income` DECLARADO como fonte
  //    (Seção 11 — "explicit net income can be used as a source
  //    value"), nunca reconstrói os componentes ausentes.
  // 4. Nem os componentes nem um `net_income` declarado existem →
  //    `netIncomeAvailable: false` — "ausente" nunca vira "zero"
  //    (Seção 25).
  const financialResultDeclared = resolveDeclaredFinancialResult(statementLines);
  const taxesDeclared = declaredTotal(statementLines, "taxes");
  const netIncomeDeclared = declaredTotal(statementLines, "net_income");
  const hasIncomeStatementLines = statementLines.some((line) =>
    INCOME_STATEMENT_CATEGORIES.has(line.category)
  );

  // Mission 194 Closure — Canonical Missing-vs-Zero Financial
  // Semantics. `hasIncomeStatementLines` sozinho não bastava para
  // decidir se existe ALGUMA verdade de resultado no Financial Model:
  // quando NEM uma StatementLine NEM um evento de receita/custo/
  // despesa/juros existe (ex.: apenas um Balancete foi enviado), o
  // branch "legado" abaixo (`!hasIncomeStatementLines`) ainda calculava
  // `revenue`/`costOfGoodsSold`/`operatingExpenses` = 0 (soma de um
  // array de eventos vazio) e tratava esse zero como um resultado
  // GENUÍNO, disponível — o ponto exato onde "ausência" virava "zero"
  // (reproduzido em `tests/indicators-missing-vs-zero/` — Balanço
  // sozinho produzia ROA/EBITDA/EBIT/Capital de Giro `available` com
  // valor `0`, quando deveriam ser `unavailable`). `hasIncomeStatementData`
  // é a mesma pergunta de `hasIncomeStatementLines` (Seção 3 desta
  // missão: "não existe DRE" vs "DRE existe mas está incompleto"),
  // agora estendida para também reconhecer o caminho transacional
  // legítimo (extrato bancário sem DRE, Mission 192 Closure, Seção 11
  // — preservado byte a byte: `hasIncomeRelevantEvents` é `true`
  // sempre que há QUALQUER evento que hoje já alimenta `revenue`/
  // `costOfGoodsSold`/`operatingExpenses`/`interestExpense`).
  const hasIncomeRelevantEvents = events.some(
    (event) =>
      event.type === "sale" ||
      event.type === "receipt" ||
      event.type === "purchase" ||
      event.type === "payment" ||
      event.type === "interest_expense"
  );
  const hasIncomeStatementData = hasIncomeStatementLines || hasIncomeRelevantEvents;

  let financialResult: number;
  let taxes: number;
  let netIncome: number;
  let netIncomeAvailable: boolean;
  let netIncomeSource: FinancialStatementInputs["netIncomeSource"];

  if (financialResultDeclared !== undefined && taxesDeclared !== undefined) {
    financialResult = financialResultDeclared;
    taxes = Math.abs(taxesDeclared);
    netIncome = deriveIncomeStatementResults(
      revenue,
      costOfGoodsSold,
      operatingExpenses,
      financialResult,
      taxes
    ).netIncome;
    netIncomeAvailable = true;
    netIncomeSource = "derived";
  } else if (!hasIncomeStatementLines) {
    financialResult = -interestExpense;
    taxes = 0;
    netIncome = deriveIncomeStatementResults(
      revenue,
      costOfGoodsSold,
      operatingExpenses,
      financialResult,
      taxes
    ).netIncome;
    netIncomeAvailable = true;
    netIncomeSource = "legacy";
  } else if (netIncomeDeclared !== undefined) {
    financialResult = financialResultDeclared ?? 0;
    taxes = taxesDeclared !== undefined ? Math.abs(taxesDeclared) : 0;
    netIncome = netIncomeDeclared;
    netIncomeAvailable = true;
    netIncomeSource = "declared";
  } else {
    financialResult = financialResultDeclared ?? -interestExpense;
    taxes = taxesDeclared !== undefined ? Math.abs(taxesDeclared) : 0;
    netIncome = deriveIncomeStatementResults(
      revenue,
      costOfGoodsSold,
      operatingExpenses,
      financialResult,
      taxes
    ).netIncome;
    netIncomeAvailable = false;
    netIncomeSource = "unavailable";
  }

  // Mission 192 Closure B — Deterministic Statement Conflict
  // Governance, D-113: um `StatementConflict` de escopo
  // `"income_statement"` (duas DREs do MESMO período divergindo
  // materialmente, nenhuma aceita) já deixou `statementLines` vazio
  // para aquele período — indistinguível, sem este sinal, do caminho
  // legado "nenhuma DRE jamais existiu" (branch acima, `netIncomeSource
  // === "legacy"`). Esta checagem SEMPRE tem a palavra final,
  // independentemente de qual dos 4 ramos acima rodou: "conflito"
  // nunca vira "disponível" só porque a aritmética best-effort ainda
  // produziu um número (Seção 18 da missão — "conflict/missing does
  // not become zero", aplicado aqui a "não vira disponível").
  // Mission 194 Closure. `resources` de tipos que a convenção D-004 não
  // classifica em nenhum total de Balanço (`employee`/`contract`/
  // `product`/`service`) nunca contam como "há Balanço" — um Financial
  // Model com APENAS esses tipos teria `currentAssets`/`totalAssets`
  // sempre 0 de qualquer forma (nenhum deles entra em nenhuma soma de
  // `deriveBalanceSheetTotals()`), então tratá-los como "sem dado de
  // Balanço" é consistente com o que já é matematicamente verdade.
  const hasBalanceData = resources.some(
    (resource) =>
      resource.type === "cash" ||
      resource.type === "client" ||
      resource.type === "inventory" ||
      resource.type === "asset" ||
      resource.type === "investment" ||
      resource.type === "supplier" ||
      resource.type === "loan"
  );

  const statementConflicts = financialModel.statementConflicts ?? [];
  // Mission 194 Closure — Canonical Missing-vs-Zero Financial
  // Semantics. Antes: `incomeStatementAvailable`/`balanceAvailable`
  // significavam exclusivamente "sem conflito D-113" — um Financial
  // Model sem NENHUM dado de DRE (ou sem NENHUM dado de Balanço) nunca
  // tinha conflito algum (nada para conflitar), então ambos ficavam
  // `true` por omissão, mesmo quando a dimensão inteira estava
  // genuinamente ausente. Agora exigem também `hasIncomeStatementData`/
  // `hasBalanceData` — "disponível" nunca mais significa apenas
  // "não está em conflito", significa "existe E não está em conflito".
  // Isso corrige, na ORIGEM (D-052/D-110), toda cascata que dependia
  // destes dois flags: `netIncomeAvailable` (via o `if` abaixo),
  // `ebitda`/`ebit` (via `incomeStatementDependent()`,
  // `indicators.calculator.ts`) e `workingCapital` (via
  // `balanceDependent()`) — os únicos três indicadores que usavam
  // `available(...)` sem nenhuma divisão (logo, sem a proteção natural
  // de `safeDivide(x, 0) → unavailable` que já protegia todos os
  // demais indicadores contra este mesmo defeito).
  const incomeStatementAvailable =
    hasIncomeStatementData &&
    !statementConflicts.some((conflict) => conflict.scope === "income_statement");
  const balanceAvailable =
    hasBalanceData && !statementConflicts.some((conflict) => conflict.scope === "balance");

  if (!incomeStatementAvailable) {
    netIncomeAvailable = false;
    netIncomeSource = "unavailable";
  }

  const { grossProfit, ebitda, ebit } = deriveIncomeStatementResults(
    revenue,
    costOfGoodsSold,
    operatingExpenses,
    financialResult,
    taxes
  );

  // Mission 192, D-107 (estendida na Mission 192 Closure, D-111, para
  // incluir a data-base de Resources): `derivePeriod()` pode devolver
  // `undefined` quando nenhum sinal genuíno de cronologia existe — o
  // caminho canônico de produção (`IndicatorsEngine.execute()`) já
  // falha ANTES de chamar esta função nesse caso (nunca chega aqui sem
  // um período real). Este fallback permanece apenas para o outro
  // chamador desta função (`efos/application/scenario-simulation/`,
  // Missions 180-183) — que recalcula uma DRE HIPOTÉTICA sobre um
  // `financialModel` já validado, nunca forma verdade financeira nova;
  // `periodInDays` ali é apenas o multiplicador de uma razão
  // (`Contas a Receber / Receita × Dias no Período`), nunca uma data de
  // calendário exibida como se fosse real — nenhum `Period` fabricado
  // chega a `Indicator.period` por este caminho.
  const resolvedPeriod = derivePeriod(events, statementLines, resources);
  const periodInDays = resolvedPeriod
    ? periodInDaysFrom(resolvedPeriod)
    : INDICATORS_ENGINE_CONSTANTS.defaultPeriodInDays;

  // Mission 192 Closure B, Seção 14/15/28: compatibilidade entre o
  // período do DRE e a data-base do Balancete é uma restrição de
  // COERÊNCIA, nunca uma competição — os dois permanecem no modelo;
  // apenas indicadores que MISTURAM as duas dimensões (ver
  // `calculateIndicators()`) são afetados.
  const crossSourcePeriodCompatible =
    validatePeriodCompatibility(statementLines, resources).length === 0;

  return {
    cash,
    accountsReceivable,
    inventory,
    currentAssets,
    nonCurrentAssets,
    totalAssets,
    accountsPayable,
    loans,
    currentLiabilities,
    totalLiabilities,
    equity,
    totalInvestment,
    revenue,
    costOfGoodsSold,
    operatingExpenses,
    grossProfit,
    ebitda,
    ebit,
    netIncome,
    interestExpense,
    financialResult,
    taxes,
    netIncomeAvailable,
    netIncomeSource,
    incomeStatementAvailable,
    balanceAvailable,
    crossSourcePeriodCompatible,
    periodInDays,
  };
}

/**
 * Espelha `extractFinancialStatementInputs()` linha a linha — mesma
 * classificação de Resources/Events (D-004), mesma árvore de
 * derivação aritmética — mas coletando `id`s em vez de somar valores
 * (Mission 110 — Indicator Source Traceability). Nunca uma segunda
 * convenção de classificação: qualquer alteração em D-004 precisa
 * atualizar as duas funções igualmente, por construção deliberada
 * (nenhuma delas chama a outra, para que ambas permaneçam auditáveis
 * de forma independente, mas os filtros usados são sempre os mesmos).
 * `periodInDays` não tem entrada aqui — não é somado a partir de
 * nenhum `Resource`/`FinancialEvent`, é derivado de datas.
 */
export function extractFinancialStatementInputSources(
  financialModel: FinancialModelAggregate
): FinancialStatementInputSources {
  const { resources, events } = financialModel;
  const statementLines = financialModel.statementLines ?? [];

  const cash = idsWithMoney(
    resources.filter((r) => r.type === "cash"),
    (r) => r.value
  );
  const accountsReceivable = idsWithMoney(
    resources.filter((r) => r.type === "client"),
    (r) => r.value
  );
  const inventory = idsWithMoney(
    resources.filter((r) => r.type === "inventory"),
    (r) => r.value
  );
  const accountsPayable = idsWithMoney(
    resources.filter((r) => r.type === "supplier"),
    (r) => r.value
  );
  const loans = idsWithMoney(
    resources.filter((r) => r.type === "loan"),
    (r) => r.value
  );
  const nonCurrentAssets = idsWithMoney(
    resources.filter((r) => r.type === "asset" || r.type === "investment"),
    (r) => r.value
  );
  const totalInvestment = idsWithMoney(
    resources.filter((r) => r.type === "investment"),
    (r) => r.value
  );

  const currentAssets = unionIds(cash, accountsReceivable, inventory);
  const totalAssets = unionIds(currentAssets, nonCurrentAssets);

  const currentLiabilities = accountsPayable;
  const totalLiabilities = unionIds(currentLiabilities, loans);
  const equity = unionIds(totalAssets, totalLiabilities);

  // Mission 192, D-106/D-109: mesma precedência de
  // `extractFinancialStatementInputs()` — quando `StatementLine`s
  // existem para a categoria, suas próprias `id`s são a fonte, nunca
  // unidas com as `id`s de eventos da mesma categoria.
  const revenueStatementLines = selectRevenueStatementLines(statementLines);
  const costOfGoodsSoldStatementLines = selectStatementLinesForCategory(
    statementLines,
    "cost_of_goods_services"
  );
  const operatingExpenseStatementLines = selectStatementLinesForCategory(
    statementLines,
    "operating_expense"
  );

  const revenue =
    revenueStatementLines.length > 0
      ? idsWithMoney(revenueStatementLines, (l) => l.amount)
      : idsWithMoney(
          events.filter((e) => e.type === "sale" || e.type === "receipt"),
          (e) => e.amount
        );
  const costOfGoodsSold =
    costOfGoodsSoldStatementLines.length > 0
      ? idsWithMoney(costOfGoodsSoldStatementLines, (l) => l.amount)
      : idsWithMoney(
          events.filter((e) => e.type === "purchase"),
          (e) => e.amount
        );
  const operatingExpenses =
    operatingExpenseStatementLines.length > 0
      ? idsWithMoney(operatingExpenseStatementLines, (l) => l.amount)
      : idsWithMoney(
          events.filter((e) => e.type === "payment"),
          (e) => e.amount
        );

  const grossProfit = unionIds(revenue, costOfGoodsSold);
  // Depreciação/amortização/impostos são sempre `0` fixo (nenhum
  // `ResourceType`/`FinancialEventType` os representa hoje, ver
  // `extractFinancialStatementInputs()`) — nunca contribuem um `id`
  // real, então `ebitda`/`ebit` compartilham exatamente as mesmas
  // fontes (EBIT é sempre antes de juros, por definição — nunca inclui
  // `interestExpense`).
  const ebitda = unionIds(grossProfit, operatingExpenses);
  const ebit = ebitda;

  // Juros (Mission 111, D-057): `interest_expense` é um
  // FinancialEventType próprio — nunca cai dentro de `payment`/
  // `operatingExpenses` (mesmo filtro exato de
  // `extractFinancialStatementInputs()`).
  const interestExpense = idsWithMoney(
    events.filter((e) => e.type === "interest_expense"),
    (e) => e.amount
  );

  // Mission 192 Closure, D-110: mesma precedência de
  // `extractFinancialStatementInputs()` — StatementLines de resultado
  // financeiro/impostos, quando existem, são a fonte; caso contrário
  // (nenhum DRE no Financial Model), `interestExpense` permanece a
  // única fonte legada de `netIncome`.
  const financialIncomeLines = selectStatementLinesForCategory(statementLines, "financial_income");
  const financialExpenseLines = selectStatementLinesForCategory(statementLines, "financial_expense");
  const financialResultNetLines = selectStatementLinesForCategory(statementLines, "financial_result");
  const taxesLines = selectStatementLinesForCategory(statementLines, "taxes");
  const netIncomeLines = selectStatementLinesForCategory(statementLines, "net_income");

  const financialResult =
    financialIncomeLines.length > 0 || financialExpenseLines.length > 0
      ? unionIds(
          idsWithMoney(financialIncomeLines, (l) => l.amount),
          idsWithMoney(financialExpenseLines, (l) => l.amount)
        )
      : financialResultNetLines.length > 0
        ? idsWithMoney(financialResultNetLines, (l) => l.amount)
        : interestExpense;
  const taxes = idsWithMoney(taxesLines, (l) => l.amount);

  // Lucro Líquido declarado explicitamente (Seção 11) é sua PRÓPRIA
  // fonte quando é ele quem alimenta `netIncome` — nunca confundido com
  // a árvore derivada de `ebit`+`financialResult`-`taxes`.
  const netIncome =
    netIncomeLines.length > 0
      ? idsWithMoney(netIncomeLines, (l) => l.amount)
      : unionIds(ebit, financialResult, taxes);

  return {
    cash,
    accountsReceivable,
    inventory,
    currentAssets,
    nonCurrentAssets,
    totalAssets,
    accountsPayable,
    loans,
    currentLiabilities,
    totalLiabilities,
    equity,
    totalInvestment,
    revenue,
    costOfGoodsSold,
    operatingExpenses,
    grossProfit,
    ebitda,
    ebit,
    netIncome,
    interestExpense,
    financialResult,
    taxes,
  };
}

/**
 * Divergência de aritmética entre valores declarados diretamente por
 * um demonstrativo — nunca corrigida, apenas reportada (Mission 192,
 * Seção 31 — "Statement Arithmetic Validation"). `expected` é sempre
 * derivado exclusivamente de OUTRAS `StatementLine`s do mesmo
 * documento — nunca do resultado calculado pela árvore de
 * `deriveIncomeStatementResults()` (que usa magnitudes absolutas,
 * D-050/D-051, e portanto não é diretamente comparável byte a byte com
 * o sinal literal de uma linha declarada).
 */
export interface StatementArithmeticIssue {
  readonly rule: string;
  readonly message: string;
  readonly declared: number;
  readonly expected: number;
}

const ARITHMETIC_TOLERANCE = 0.01;

function declaredTotal(
  statementLines: readonly StatementLine[],
  category: StatementCategory
): number | undefined {
  const lines = selectStatementLinesForCategory(statementLines, category);
  if (lines.length === 0) return undefined;
  return sumMoney(lines.map((line) => line.amount));
}

/**
 * Verifica relações aritméticas SOMENTE quando o documento já expõe
 * todos os totais intermediários necessários (Seção 31 da missão: "não
 * assuma que todo layout de DRE expõe todos os totais intermediários")
 * — nunca reconstrói um total ausente por inferência. Tolerância de
 * `ARITHMETIC_TOLERANCE` (um centavo) absorve apenas arredondamento de
 * ponto flutuante, nunca uma divergência de conteúdo real.
 */
export function validateStatementArithmetic(
  statementLines: readonly StatementLine[]
): readonly StatementArithmeticIssue[] {
  const issues: StatementArithmeticIssue[] = [];

  const grossRevenue = declaredTotal(statementLines, "gross_revenue");
  const deductions = declaredTotal(statementLines, "revenue_deductions");
  const netRevenue = declaredTotal(statementLines, "net_revenue");

  if (grossRevenue !== undefined && deductions !== undefined && netRevenue !== undefined) {
    const expected = grossRevenue - Math.abs(deductions);
    if (Math.abs(expected - netRevenue) > ARITHMETIC_TOLERANCE) {
      issues.push({
        rule: "net-revenue-consistency",
        message:
          "Receita Líquida declarada não corresponde a Receita Bruta − Deduções.",
        declared: netRevenue,
        expected,
      });
    }
  }

  const costOfGoodsServices = declaredTotal(statementLines, "cost_of_goods_services");
  const grossProfitDeclared = declaredTotal(statementLines, "gross_profit");
  const revenueForGrossProfit = netRevenue ?? grossRevenue;

  if (
    revenueForGrossProfit !== undefined &&
    costOfGoodsServices !== undefined &&
    grossProfitDeclared !== undefined
  ) {
    const expected = revenueForGrossProfit - Math.abs(costOfGoodsServices);
    if (Math.abs(expected - grossProfitDeclared) > ARITHMETIC_TOLERANCE) {
      issues.push({
        rule: "gross-profit-consistency",
        message:
          "Lucro Bruto declarado não corresponde a Receita − Custo dos Produtos/Serviços Vendidos.",
        declared: grossProfitDeclared,
        expected,
      });
    }
  }

  // Mission 192 Closure — Complete Statement Economics & Balance-Date
  // Semantics, Seção 10: só verifica quando TODOS os componentes
  // necessários (receita, CMV, despesas operacionais, resultado
  // financeiro, impostos) E o Lucro Líquido declarado existem — nunca
  // reconstrói um componente ausente (Seção 11: missing ≠ zero).
  const operatingExpensesDeclared = declaredTotal(statementLines, "operating_expense");
  const financialResultDeclared = resolveDeclaredFinancialResult(statementLines);
  const taxesDeclared = declaredTotal(statementLines, "taxes");
  const netIncomeDeclared = declaredTotal(statementLines, "net_income");
  const revenueForNetIncome = netRevenue ?? grossRevenue;

  if (
    revenueForNetIncome !== undefined &&
    costOfGoodsServices !== undefined &&
    operatingExpensesDeclared !== undefined &&
    financialResultDeclared !== undefined &&
    taxesDeclared !== undefined &&
    netIncomeDeclared !== undefined
  ) {
    const expectedGrossProfit = revenueForNetIncome - Math.abs(costOfGoodsServices);
    const expectedEbit = expectedGrossProfit - Math.abs(operatingExpensesDeclared);
    const expected = expectedEbit + financialResultDeclared - Math.abs(taxesDeclared);

    if (Math.abs(expected - netIncomeDeclared) > ARITHMETIC_TOLERANCE) {
      issues.push({
        rule: "net-income-consistency",
        message:
          "Lucro Líquido declarado não corresponde a Receita − CMV − Despesas Operacionais + Resultado Financeiro − Impostos.",
        declared: netIncomeDeclared,
        expected,
      });
    }
  }

  return issues;
}

/**
 * Compatibilidade entre o período de um demonstrativo (DRE) e a
 * data-base de um saldo pontual (Balancete) no MESMO Financial Model
 * (Mission 192 Closure, Seção 20). DRE Julho (01/07–31/07) + Balancete
 * 31/07 é compatível (mesmo conjunto de verdade); DRE Julho + Balancete
 * 31/08 não é — nunca silenciosamente tratado como o mesmo recorte
 * temporal. Reportado, nunca bloqueante (mesmo padrão de
 * `validateStatementArithmetic()`) — a exclusão de documentos
 * conflitantes acontece antes disso, em `prepareFinancialDocuments()`
 * (D-112); esta função cobre o caso em que ambos sobrevivem à
 * ingestão (períodos genuinamente diferentes, mas nenhum dos dois
 * "vence" o outro por recência, ex.: Balancete intermediário dentro do
 * período do DRE).
 */
export interface PeriodCompatibilityIssue {
  readonly rule: string;
  readonly message: string;
}

export function validatePeriodCompatibility(
  statementLines: readonly StatementLine[],
  resources: FinancialModelAggregate["resources"]
): readonly PeriodCompatibilityIssue[] {
  const period = statementLines[0]?.period;
  if (!period) return [];

  const asOfDates = resources
    .map((resource) => resource.asOfDate)
    .filter((date): date is string => date !== undefined);

  if (asOfDates.length === 0) return [];

  const start = new Date(period.startDate).getTime();
  const end = new Date(period.endDate).getTime();

  const issues: PeriodCompatibilityIssue[] = [];
  for (const asOfDate of new Set(asOfDates)) {
    const asOf = new Date(asOfDate).getTime();
    if (asOf < start || asOf > end) {
      issues.push({
        rule: "dre-balance-period-mismatch",
        message: `Data-base do Balancete (${asOfDate}) está fora do período do DRE (${period.startDate} a ${period.endDate}) — não tratados como o mesmo recorte temporal.`,
      });
    }
  }
  return issues;
}

export function calculateIndicators(
  inputs: FinancialStatementInputs,
  sources: FinancialStatementInputSources
): Record<string, CalculatedIndicator> {
  const {
    cash,
    accountsReceivable,
    inventory,
    currentAssets,
    totalAssets,
    accountsPayable,
    currentLiabilities,
    totalLiabilities,
    equity,
    totalInvestment,
    revenue,
    costOfGoodsSold,
    grossProfit,
    ebitda,
    ebit,
    netIncome,
    interestExpense,
    netIncomeAvailable,
    incomeStatementAvailable,
    balanceAvailable,
    crossSourcePeriodCompatible,
    periodInDays,
  } = inputs;

  // Mission 192 Closure — Complete Statement Economics & Balance-Date
  // Semantics, Seção 11/25: quando `netIncomeAvailable` é `false`, todo
  // indicador que dependa de `netIncome` é forçado a `unavailable` —
  // NUNCA calculado a partir do número best-effort que `netIncome`
  // carrega internamente (ver `extractFinancialStatementInputs()`).
  // "Ausente" nunca vira "zero" neste limite.
  function netIncomeDependent(result: IndicatorResult): IndicatorResult {
    return netIncomeAvailable ? result : UNAVAILABLE;
  }

  // Mission 192 Closure B — Deterministic Statement Conflict
  // Governance, D-113. Três gates NOVOS, mesmo princípio exato de
  // `netIncomeDependent()` acima (nunca "conflito"/"ausência" vira
  // "zero" ou "disponível"):
  //
  // - `incomeStatementDependent()`: indicador usa
  //   receita/CMV/despesas operacionais/EBITDA/EBIT diretamente (nunca
  //   via `netIncome`, já coberto por `netIncomeDependent()`) — forçado
  //   `unavailable` quando um DRE do período está em conflito material
  //   não resolvido (Seção 18/24 da missão).
  // - `balanceDependent()`: indicador usa saldo de Balancete
  //   diretamente — forçado `unavailable` quando um Balancete da
  //   data-base está em conflito material não resolvido (Seção 12/26).
  // - `crossSourceDependent()`: indicador MISTURA DRE (receita/CMV) e
  //   Balancete (ativo/contas a receber/etc.) — forçado `unavailable`
  //   quando os dois descrevem recortes temporais incompatíveis (Seção
  //   14/15/28): "no ratio should combine July performance with August
  //   balance".
  function incomeStatementDependent(result: IndicatorResult): IndicatorResult {
    return incomeStatementAvailable ? result : UNAVAILABLE;
  }
  function balanceDependent(result: IndicatorResult): IndicatorResult {
    return balanceAvailable ? result : UNAVAILABLE;
  }
  function crossSourceDependent(result: IndicatorResult): IndicatorResult {
    return crossSourcePeriodCompatible ? result : UNAVAILABLE;
  }

  // Mission 192 Closure B, Seção 12/18/26/28: os três prazos médios já
  // misturavam, por design original (Mission 004+), um saldo de
  // Balancete (Contas a Receber/Pagar, Estoque) com receita/CMV (DRE ou
  // evento) — exatamente o tipo de indicador que `crossSourceDependent()`
  // existe para proteger, além de `balanceDependent()`/
  // `incomeStatementDependent()` para cada lado individual em conflito.
  function mixedDependent(result: IndicatorResult): IndicatorResult {
    return balanceDependent(incomeStatementDependent(crossSourceDependent(result)));
  }

  const averageReceiptPeriodResult = mixedDependent(
    scaleResult(safeDivide(accountsReceivable, revenue), periodInDays)
  );
  const averageReceiptPeriodSources = sourcesForResult(
    averageReceiptPeriodResult,
    sources.accountsReceivable,
    sources.revenue
  );
  const averagePaymentPeriodResult = mixedDependent(
    scaleResult(safeDivide(accountsPayable, costOfGoodsSold), periodInDays)
  );
  const averagePaymentPeriodSources = sourcesForResult(
    averagePaymentPeriodResult,
    sources.accountsPayable,
    sources.costOfGoodsSold
  );
  const averageInventoryPeriodResult = mixedDependent(
    scaleResult(safeDivide(inventory, costOfGoodsSold), periodInDays)
  );
  const averageInventoryPeriodSources = sourcesForResult(
    averageInventoryPeriodResult,
    sources.inventory,
    sources.costOfGoodsSold
  );

  const financialCycleResult = combineResults([
    { result: averageInventoryPeriodResult, sign: 1 },
    { result: averageReceiptPeriodResult, sign: 1 },
    { result: averagePaymentPeriodResult, sign: -1 },
  ]);

  return {
    currentLiquidity: {
      key: "currentLiquidity",
      result: balanceDependent(safeDivide(currentAssets, currentLiabilities)),
      formula: "Ativo Circulante / Passivo Circulante",
      sourceRecordIds: sourcesForResult(
        balanceDependent(safeDivide(currentAssets, currentLiabilities)),
        sources.currentAssets,
        sources.currentLiabilities
      ),
    },
    quickLiquidity: {
      key: "quickLiquidity",
      result: balanceDependent(safeDivide(currentAssets - inventory, currentLiabilities)),
      formula: "(Ativo Circulante - Estoque) / Passivo Circulante",
      sourceRecordIds: sourcesForResult(
        balanceDependent(safeDivide(currentAssets - inventory, currentLiabilities)),
        sources.currentAssets,
        sources.inventory,
        sources.currentLiabilities
      ),
    },
    immediateLiquidity: {
      key: "immediateLiquidity",
      result: balanceDependent(safeDivide(cash, currentLiabilities)),
      formula: "Caixa / Passivo Circulante",
      sourceRecordIds: sourcesForResult(
        balanceDependent(safeDivide(cash, currentLiabilities)),
        sources.cash,
        sources.currentLiabilities
      ),
    },
    workingCapital: {
      key: "workingCapital",
      result: balanceDependent(available(currentAssets - currentLiabilities)),
      formula: "Ativo Circulante - Passivo Circulante",
      sourceRecordIds: sourcesForResult(
        balanceDependent(available(currentAssets - currentLiabilities)),
        sources.currentAssets,
        sources.currentLiabilities
      ),
    },
    grossMargin: {
      key: "grossMargin",
      result: incomeStatementDependent(scaleResult(safeDivide(grossProfit, revenue), 100)),
      formula: "(Receita - CMV) / Receita × 100",
      sourceRecordIds: sourcesForResult(
        incomeStatementDependent(scaleResult(safeDivide(grossProfit, revenue), 100)),
        sources.grossProfit,
        sources.revenue
      ),
    },
    operatingMargin: {
      key: "operatingMargin",
      result: incomeStatementDependent(scaleResult(safeDivide(ebit, revenue), 100)),
      formula: "EBIT / Receita × 100",
      sourceRecordIds: sourcesForResult(
        incomeStatementDependent(scaleResult(safeDivide(ebit, revenue), 100)),
        sources.ebit,
        sources.revenue
      ),
    },
    netMargin: {
      key: "netMargin",
      result: netIncomeDependent(
        incomeStatementDependent(scaleResult(safeDivide(netIncome, revenue), 100))
      ),
      formula: "Lucro Líquido / Receita × 100",
      sourceRecordIds: sourcesForResult(
        netIncomeDependent(
          incomeStatementDependent(scaleResult(safeDivide(netIncome, revenue), 100))
        ),
        sources.netIncome,
        sources.revenue
      ),
    },
    ebitda: {
      key: "ebitda",
      result: incomeStatementDependent(available(ebitda)),
      formula: "Lucro Bruto - Despesas Operacionais",
      sourceRecordIds: incomeStatementAvailable ? sources.ebitda : undefined,
    },
    ebit: {
      key: "ebit",
      result: incomeStatementDependent(available(ebit)),
      formula: "EBITDA - Depreciação e Amortização",
      sourceRecordIds: incomeStatementAvailable ? sources.ebit : undefined,
    },
    roi: {
      key: "roi",
      result: netIncomeDependent(
        mixedDependent(scaleResult(safeDivide(netIncome, totalInvestment), 100))
      ),
      formula: "Lucro Líquido / Investimento Total × 100",
      sourceRecordIds: sourcesForResult(
        netIncomeDependent(
          mixedDependent(scaleResult(safeDivide(netIncome, totalInvestment), 100))
        ),
        sources.netIncome,
        sources.totalInvestment
      ),
    },
    roe: {
      key: "roe",
      result: netIncomeDependent(mixedDependent(scaleResult(safeDivide(netIncome, equity), 100))),
      formula: "Lucro Líquido / Patrimônio Líquido × 100",
      sourceRecordIds: sourcesForResult(
        netIncomeDependent(mixedDependent(scaleResult(safeDivide(netIncome, equity), 100))),
        sources.netIncome,
        sources.equity
      ),
    },
    roa: {
      key: "roa",
      result: netIncomeDependent(
        mixedDependent(scaleResult(safeDivide(netIncome, totalAssets), 100))
      ),
      formula: "Lucro Líquido / Ativo Total × 100",
      sourceRecordIds: sourcesForResult(
        netIncomeDependent(
          mixedDependent(scaleResult(safeDivide(netIncome, totalAssets), 100))
        ),
        sources.netIncome,
        sources.totalAssets
      ),
    },
    assetTurnover: {
      key: "assetTurnover",
      result: mixedDependent(safeDivide(revenue, totalAssets)),
      formula: "Receita / Ativo Total",
      sourceRecordIds: sourcesForResult(
        mixedDependent(safeDivide(revenue, totalAssets)),
        sources.revenue,
        sources.totalAssets
      ),
    },
    overallIndebtedness: {
      key: "overallIndebtedness",
      result: balanceDependent(scaleResult(safeDivide(totalLiabilities, totalAssets), 100)),
      formula: "Passivo Total / Ativo Total × 100",
      sourceRecordIds: sourcesForResult(
        balanceDependent(scaleResult(safeDivide(totalLiabilities, totalAssets), 100)),
        sources.totalLiabilities,
        sources.totalAssets
      ),
    },
    debtComposition: {
      key: "debtComposition",
      result: balanceDependent(
        scaleResult(safeDivide(currentLiabilities, totalLiabilities), 100)
      ),
      formula: "Passivo Circulante / Passivo Total × 100",
      sourceRecordIds: sourcesForResult(
        balanceDependent(scaleResult(safeDivide(currentLiabilities, totalLiabilities), 100)),
        sources.currentLiabilities,
        sources.totalLiabilities
      ),
    },
    interestCoverage: {
      key: "interestCoverage",
      // Mission 111 (D-057): `interestExpense` agora reflete eventos
      // `interest_expense` reais, quando existirem — sem nenhum, o
      // valor permanece `0` e `safeDivide` continua devolvendo
      // `unavailable` (mesma semantica de sempre, nenhum caso especial
      // novo). Nunca infinito, nunca zero artificial (Etapa 9,
      // Cenario A) — apenas o mesmo contrato de `safeDivide` ja
      // estabelecido desde D-052. `incomeStatementDependent()` (Mission
      // 192 Closure B) protege `ebit` — `interestExpense` em si nunca
      // depende de DRE/Balancete (evento independente).
      result: incomeStatementDependent(safeDivide(ebit, interestExpense)),
      formula: "EBIT / Despesa com Juros",
      sourceRecordIds: sourcesForResult(
        incomeStatementDependent(safeDivide(ebit, interestExpense)),
        sources.ebit,
        sources.interestExpense
      ),
    },
    averageReceiptPeriod: {
      key: "averageReceiptPeriod",
      result: averageReceiptPeriodResult,
      formula: "(Contas a Receber / Receita) × Dias no Período",
      sourceRecordIds: averageReceiptPeriodSources,
    },
    averagePaymentPeriod: {
      key: "averagePaymentPeriod",
      result: averagePaymentPeriodResult,
      formula: "(Contas a Pagar / CMV) × Dias no Período",
      sourceRecordIds: averagePaymentPeriodSources,
    },
    averageInventoryPeriod: {
      key: "averageInventoryPeriod",
      result: averageInventoryPeriodResult,
      formula: "(Estoque / CMV) × Dias no Período",
      sourceRecordIds: averageInventoryPeriodSources,
    },
    financialCycle: {
      key: "financialCycle",
      result: financialCycleResult,
      formula: "PME + PMR - PMP",
      sourceRecordIds: sourcesForResult(
        financialCycleResult,
        averageInventoryPeriodSources ?? [],
        averageReceiptPeriodSources ?? [],
        averagePaymentPeriodSources ?? []
      ),
    },
  };
}
