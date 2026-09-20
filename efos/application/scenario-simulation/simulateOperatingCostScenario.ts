import type { FinancialModelAggregate, Period } from "@/efos/domain";
import {
  calculateIndicators,
  deriveIncomeStatementResults,
  extractFinancialStatementInputSources,
  extractFinancialStatementInputs,
  type FinancialStatementInputs,
} from "@/efos/engines/indicators";

import { compareScenarioIndicator } from "./compareScenarioIndicator";
import {
  validateOperatingCostChangeAssumption,
  type OperatingCostChangeAssumption,
} from "./ScenarioAssumption";
import type { OperatingCostScenarioSimulationOutcome } from "./ScenarioProjection";

/**
 * Mission 180 — Scenario Intelligence Foundation & First Real
 * Simulation.
 *
 * Único indicador causalmente afetado por uma mudança em
 * `operatingExpenses`, mantendo receita/CMV/juros/balanço patrimonial
 * inalterados — derivado por leitura direta das fórmulas de
 * `indicators.calculator.ts` (`calculateIndicators`), nunca suposto:
 *
 * - `ebitda`/`ebit` dependem diretamente de `operatingExpenses`
 *   (`deriveIncomeStatementResults`).
 * - `operatingMargin` (EBIT/Receita), `netMargin` (Lucro Líquido/Receita),
 *   `roi`/`roe`/`roa` (Lucro Líquido/...), `interestCoverage`
 *   (EBIT/Juros) dependem transitivamente via `ebit`/Lucro Líquido.
 *
 * `netIncome` (Lucro Líquido) em si NUNCA é um `CalculatedIndicator`
 * exposto por `calculateIndicators()` — apenas `netMargin` (Lucro
 * Líquido/Receita) o é, mesmo padrão de `grossProfit` (também nunca
 * exposto como indicador próprio, só via `grossMargin`). O valor bruto
 * de Lucro Líquido projetado continua visível em
 * `projection.projected.inputs.netIncome` (achado da própria bateria
 * de testes desta missão — `CAUSALLY_AFFECTED_INDICATOR_KEYS` incluía
 * `"netIncome"` por engano antes desta correção).
 *
 * Explicitamente EXCLUÍDOS (Seção 14 — nunca mostrar uma métrica só
 * porque existe): `currentLiquidity`/`quickLiquidity`/`immediateLiquidity`/
 * `workingCapital` (balanço patrimonial, nunca tocado por esta
 * vertical), `grossMargin` (Receita/CMV apenas, `operatingExpenses` não
 * entra na fórmula), `assetTurnover`/`overallIndebtedness`/
 * `debtComposition` (balanço patrimonial), `averageReceiptPeriod`/
 * `averagePaymentPeriod`/`averageInventoryPeriod`/`financialCycle`
 * (Contas a Receber/Pagar/Estoque/CMV — nenhum depende de
 * `operatingExpenses`).
 */
const CAUSALLY_AFFECTED_INDICATOR_KEYS = [
  "ebitda",
  "ebit",
  "operatingMargin",
  "netMargin",
  "roi",
  "roe",
  "roa",
  "interestCoverage",
] as const;

const SCENARIO_SIMULATION_LIMITATIONS: readonly string[] = [
  "Esta é uma simulação baseada em premissas explícitas, não uma previsão de fato (Product Vision: \"Não entregamos previsões. Entregamos cenários.\").",
  "Não modela depreciação/amortização nem impostos — permanecem 0, mesma limitação já documentada pelo Indicators Engine (extractFinancialStatementInputs) para dados reais.",
  "Assume que receita, CMV, juros e todo o balanço patrimonial (caixa, contas a receber/pagar, estoque, empréstimos, ativos, patrimônio líquido) permanecem exatamente iguais aos da execução base — apenas Despesas Operacionais muda.",
  "Vertical de período único: representa \"e se esta mudança já tivesse valido durante o mesmo período da verdade financeira atual\" — não projeta múltiplos períodos futuros.",
  "sourceRecordIds da execução base são preservados nos indicadores projetados para rastreabilidade da parte real do modelo — o ajuste hipotético em si não tem origem documental (não é um Resource/FinancialEvent real) e não é adicionado a nenhuma lista de origem.",
];

/**
 * Núcleo puro da primeira vertical de simulação (Seção 11 — "Pure
 * Simulation"): `baseline + typed assumption → projected result`,
 * determinístico, sem I/O, sem mutação do `financialModel` recebido
 * (nunca escreve em `.resources`/`.events` — apenas lê, via as MESMAS
 * funções puras já usadas pelo Indicators Engine em produção).
 *
 * Reaproveita integralmente (Seção 12 — "Reuse Canonical Financial
 * Logic", nunca duplica uma fórmula):
 * - `extractFinancialStatementInputs()`/`extractFinancialStatementInputSources()`
 *   para o baseline, exatamente como o Indicators Engine faz em
 *   produção;
 * - `deriveIncomeStatementResults()` (extraída de dentro da própria
 *   `extractFinancialStatementInputs()` por esta missão) para recalcular
 *   a DRE projetada a partir do único campo alterado;
 * - `calculateIndicators()`, sem nenhuma modificação, para ambos
 *   baseline e projetado — a mesma implementação de fórmula que já
 *   está em produção.
 *
 * `financialModel.root.companyId` é validado contra `companyId`
 * (defesa em profundidade — mesmo padrão já adotado por
 * `buildDecisionCenterQueue()`, Mission 179, `scopedDiagnoses`) — nunca
 * confia apenas no chamador ter resolvido a empresa corretamente.
 */
export function simulateOperatingCostScenario(
  companyId: string,
  financialModel: FinancialModelAggregate,
  period: Period,
  assumption: OperatingCostChangeAssumption
): OperatingCostScenarioSimulationOutcome {
  if (financialModel.root.companyId !== companyId) {
    return { outcome: "rejected", reason: "company-mismatch" };
  }

  const baselineInputs = extractFinancialStatementInputs(financialModel);
  const baselineSources = extractFinancialStatementInputSources(financialModel);

  const validation = validateOperatingCostChangeAssumption(
    assumption,
    baselineInputs.operatingExpenses
  );
  if (!validation.valid) {
    return { outcome: "rejected", reason: validation.reason };
  }

  const baselineIndicators = calculateIndicators(baselineInputs, baselineSources);

  const projectedOperatingExpenses =
    baselineInputs.operatingExpenses + assumption.operatingExpensesDelta.amount;

  // Mission 192 Closure — Complete Statement Economics & Balance-Date
  // Semantics, D-110: `deriveIncomeStatementResults()` passou a receber
  // `financialResult`/`taxes` já resolvidos (nunca `interestExpense`
  // diretamente) — reaproveita os MESMOS valores já resolvidos pelo
  // baseline (`baselineInputs.financialResult`/`.taxes`), nunca uma
  // segunda resolução; a hipótese desta vertical nunca toca resultado
  // financeiro/impostos, apenas Despesas Operacionais.
  const { grossProfit, ebitda, ebit, netIncome } = deriveIncomeStatementResults(
    baselineInputs.revenue,
    baselineInputs.costOfGoodsSold,
    projectedOperatingExpenses,
    baselineInputs.financialResult,
    baselineInputs.taxes
  );

  const projectedInputs: FinancialStatementInputs = {
    ...baselineInputs,
    operatingExpenses: projectedOperatingExpenses,
    grossProfit,
    ebitda,
    ebit,
    netIncome,
  };

  // `sources` deliberadamente reaproveitada do baseline sem alteração —
  // ver `SCENARIO_SIMULATION_LIMITATIONS`: o ajuste hipotético não tem
  // `Resource`/`FinancialEvent` real de origem, então nunca fabrica um
  // novo id de proveniência (D-052/Mission 110 preservados).
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
