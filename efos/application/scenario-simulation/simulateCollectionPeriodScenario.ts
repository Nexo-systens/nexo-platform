import type { FinancialModelAggregate, Period } from "@/efos/domain";
import {
  calculateIndicators,
  deriveBalanceSheetTotals,
  extractFinancialStatementInputSources,
  extractFinancialStatementInputs,
  type FinancialStatementInputs,
} from "@/efos/engines/indicators";

import { compareScenarioIndicator } from "./compareScenarioIndicator";
import {
  validateCollectionPeriodChangeAssumption,
  type CollectionPeriodChangeAssumption,
} from "./ScenarioAssumption";
import type { CollectionPeriodScenarioSimulationOutcome } from "./ScenarioProjection";

/**
 * Mission 182 — Scenario Engine Generalization & Second Financial
 * Vertical.
 *
 * Segunda vertical real de simulação: "e se meus clientes demorarem
 * N dias a mais/a menos para pagar?" (Seção 23). Selecionada entre 6
 * candidatas (Seção 4) por ser a única, além de Despesas Operacionais,
 * que não exige inventar uma relação financeira — o Indicators Engine
 * já calcula, em produção, o Prazo Médio de Recebimento
 * (`averageReceiptPeriod = (Contas a Receber / Receita) × Dias no
 * Período`, `indicators.calculator.ts`). Esta função apenas INVERTE
 * essa mesma fórmula (resolve para Contas a Receber dado um prazo-alvo)
 * — nunca uma segunda fórmula, nunca uma relação nova.
 *
 * **Timing não é Receita (Seção 6) — prova algébrica.** `revenue`,
 * `costOfGoodsSold`, `operatingExpenses`, `interestExpense` (e,
 * portanto, `grossProfit`/`ebitda`/`ebit`/`netIncome`) são copiados de
 * `baselineInputs` SEM NENHUMA alteração — a hipótese nunca toca a DRE.
 * Apenas dois saldos de BALANÇO (estoque, Seção 7) mudam: Contas a
 * Receber (a variável de destino da hipótese) e Caixa (a contrapartida
 * — ver abaixo). Isso não é uma escolha de implementação, é uma
 * consequência necessária de `deriveBalanceSheetTotals()` nunca
 * receber um `revenue`/`costOfGoodsSold`/etc. como parâmetro — não HÁ
 * como esta função alterar a DRE mesmo que tentasse.
 *
 * **Mecanismo de caixa — troca de estoque, nunca criação de valor.**
 * Se o prazo de recebimento aumenta, o mesmo valor de Receita (já
 * reconhecida, inalterada) fica "parado" em Contas a Receber em vez de
 * já ter virado Caixa — então Caixa projetado = Caixa base −
 * (Contas a Receber projetada − Contas a Receber base). Como
 * `currentAssets = cash + accountsReceivable + inventory`
 * (`deriveBalanceSheetTotals`), a soma cash+accountsReceivable é
 * PRESERVADA por construção — `currentAssets`/`totalAssets`/
 * `totalLiabilities`/`equity` são bit-a-bit idênticos entre baseline e
 * projetado (prova algébrica, nunca apenas empírica: ver
 * `test-mission182-scenario-engine-generalization.ts`).
 *
 * **Indicadores causalmente afetados** (por leitura direta das
 * fórmulas de `calculateIndicators()`, nunca suposto): `immediateLiquidity`
 * (Caixa/Passivo Circulante — Caixa muda), `averageReceiptPeriod` (é a
 * própria hipótese), `financialCycle` (soma `averageReceiptPeriod`).
 * Explicitamente INALTERADOS, e por isso EXCLUÍDOS do comparativo
 * (Seção 14 da Mission 180): `currentLiquidity`/`quickLiquidity`/
 * `workingCapital` (dependem apenas da SOMA `currentAssets`, preservada
 * por construção); `grossMargin`/`operatingMargin`/`netMargin`/`ebitda`/
 * `ebit`/`roi`/`roe`/`roa`/`interestCoverage` (DRE nunca tocada,
 * `totalAssets`/`equity`/`totalInvestment` preservados); `assetTurnover`/
 * `overallIndebtedness`/`debtComposition` (dependem de `totalAssets`/
 * `totalLiabilities`, preservados); `averagePaymentPeriod`/
 * `averageInventoryPeriod` (Contas a Pagar/Estoque/CMV nunca tocados).
 */
const CAUSALLY_AFFECTED_INDICATOR_KEYS = [
  "immediateLiquidity",
  "averageReceiptPeriod",
  "financialCycle",
] as const;

const SCENARIO_SIMULATION_LIMITATIONS: readonly string[] = [
  "Esta é uma simulação baseada em premissas explícitas, não uma previsão de fato (Product Vision: \"Não entregamos previsões. Entregamos cenários.\").",
  "Nunca altera Receita, CMV, Despesas Operacionais ou Juros — apenas Contas a Receber e Caixa mudam, numa troca de saldo que preserva o Ativo Circulante total (nenhum valor é criado ou destruído).",
  "Assume que o mesmo volume de Receita continuaria a ser gerado independentemente do prazo de recebimento — não modela se um prazo mais curto reduziria vendas, nem se um prazo mais longo as aumentaria.",
  "Vertical de período único: representa \"e se este prazo já valesse durante o mesmo período da verdade financeira atual\" — não projeta múltiplos períodos futuros.",
  "sourceRecordIds da execução base são preservados nos indicadores projetados para rastreabilidade da parte real do modelo — o ajuste hipotético em si não tem origem documental (não é um Resource/FinancialEvent real) e não é adicionado a nenhuma lista de origem.",
];

/**
 * Núcleo puro da segunda vertical (Seção 11 da Mission 180, preservada):
 * determinístico, sem I/O, sem mutação do `financialModel` recebido.
 *
 * Reaproveita integralmente (Seção 17): `extractFinancialStatementInputs()`/
 * `extractFinancialStatementInputSources()` para o baseline;
 * `calculateIndicators()` para ler o Prazo Médio de Recebimento BASE
 * (nunca recalculado à mão — a mesma fórmula que já roda em produção);
 * `deriveBalanceSheetTotals()` (extraída de dentro da própria
 * `extractFinancialStatementInputs()` por esta missão, mesmo padrão de
 * `deriveIncomeStatementResults()`, Mission 180) para recompor os
 * totais de balanço a partir dos dois saldos alterados;
 * `calculateIndicators()` de novo, sem nenhuma modificação, para o
 * projetado.
 *
 * `financialModel.root.companyId` validado contra `companyId` — mesma
 * defesa em profundidade de `simulateOperatingCostScenario()`.
 */
export function simulateCollectionPeriodScenario(
  companyId: string,
  financialModel: FinancialModelAggregate,
  period: Period,
  assumption: CollectionPeriodChangeAssumption
): CollectionPeriodScenarioSimulationOutcome {
  if (financialModel.root.companyId !== companyId) {
    return { outcome: "rejected", reason: "company-mismatch" };
  }

  const baselineInputs = extractFinancialStatementInputs(financialModel);
  const baselineSources = extractFinancialStatementInputSources(financialModel);
  const baselineIndicators = calculateIndicators(baselineInputs, baselineSources);

  // Prazo Médio de Recebimento BASE lido do próprio Indicators Engine —
  // nunca recalculado aqui (evitaria uma segunda fórmula, ainda que
  // idêntica). `unavailable` (ex.: Receita = 0) impede qualquer baseline
  // defensável para esta vertical — fail closed (Seção 5/27 da Mission 180).
  const baselineCollectionPeriodResult = baselineIndicators.averageReceiptPeriod.result;
  if (baselineCollectionPeriodResult.status === "unavailable") {
    return { outcome: "rejected", reason: "baseline-collection-period-unavailable" };
  }
  const baselineCollectionPeriodDays = baselineCollectionPeriodResult.value;

  // Inversão da MESMA fórmula (`averageReceiptPeriod = AR/Receita×Dias`)
  // para obter Contas a Receber a partir de um prazo-alvo — nunca uma
  // relação nova. `periodInDays` nunca é 0 (`periodInDaysFrom()` sempre
  // devolve >= 1).
  const projectedCollectionPeriodDays =
    baselineCollectionPeriodDays + assumption.collectionPeriodDeltaDays;
  const projectedAccountsReceivable =
    (projectedCollectionPeriodDays / baselineInputs.periodInDays) * baselineInputs.revenue;
  const accountsReceivableDelta = projectedAccountsReceivable - baselineInputs.accountsReceivable;
  // Contrapartida em Caixa: o mesmo valor de Receita, já reconhecida,
  // ou já virou Caixa (prazo menor) ou continua em Contas a Receber
  // (prazo maior) — nunca os dois ao mesmo tempo (troca de estoque,
  // nunca criação de valor).
  const projectedCashDelta = -accountsReceivableDelta;

  const validation = validateCollectionPeriodChangeAssumption(
    assumption,
    baselineCollectionPeriodDays,
    baselineInputs.cash,
    projectedCashDelta
  );
  if (!validation.valid) {
    return { outcome: "rejected", reason: validation.reason };
  }

  const projectedCash = baselineInputs.cash + projectedCashDelta;

  const { currentAssets, totalAssets, currentLiabilities, totalLiabilities, equity } =
    deriveBalanceSheetTotals(
      projectedCash,
      projectedAccountsReceivable,
      baselineInputs.inventory,
      baselineInputs.nonCurrentAssets,
      baselineInputs.accountsPayable,
      baselineInputs.loans
    );

  const projectedInputs: FinancialStatementInputs = {
    ...baselineInputs,
    cash: projectedCash,
    accountsReceivable: projectedAccountsReceivable,
    currentAssets,
    totalAssets,
    currentLiabilities,
    totalLiabilities,
    equity,
  };

  // `sources` deliberadamente reaproveitada do baseline sem alteração —
  // mesmo raciocínio de `simulateOperatingCostScenario()` (o ajuste
  // hipotético não tem `Resource` real de origem).
  const projectedIndicators = calculateIndicators(projectedInputs, baselineSources);

  const comparison = CAUSALLY_AFFECTED_INDICATOR_KEYS.map((key) =>
    compareScenarioIndicator(key, baselineIndicators, projectedIndicators)
  );

  return {
    outcome: "simulated",
    projection: {
      companyId,
      scenarioType: assumption.scenarioType,
      period,
      assumption,
      baseline: { inputs: baselineInputs, indicators: baselineIndicators },
      projected: { inputs: projectedInputs, indicators: projectedIndicators },
      comparison,
      nature: "hypothetical",
      disclaimer:
        "Esta é uma simulação determinística baseada em uma premissa explícita, não uma previsão de fato.",
      limitations: SCENARIO_SIMULATION_LIMITATIONS,
    },
  };
}
