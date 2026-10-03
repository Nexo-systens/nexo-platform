import { prepareClassifiedDocuments } from "@/app/api/efos/_shared/prepareFinancialDocuments";
import type { ExecutionSnapshot } from "@/efos/application/persistence";
import type { HistoricalExecution } from "@/efos/application/history";
import { toHistoricalExecution } from "@/efos/application/history";
import { EFOSPipelineRuntime } from "@/efos/application/orchestrators";
import { DefaultReportService } from "@/efos/application/services/DefaultReportService";
import type { RawFinancialDocument } from "@/efos/engines/data";

/**
 * Mission 208 — empresas SINTÉTICAS para o relatório executivo, produzidas
 * pelo caminho de produção: documento em texto brasileiro → intake real
 * (`prepareClassifiedDocuments`) → `EFOSPipelineRuntime` (os 10 Engines) →
 * `DefaultReportService`. Nenhum indicador, evidência ou relatório é
 * montado à mão. Nada é persistido; nenhum dado de cliente.
 *
 * - A (saudável): margens e caixa melhoram de julho para agosto.
 * - B (deterioração): prejuízo, liquidez abaixo de 1 e patrimônio negativo em agosto.
 * - C (ciclo de decisão): os mesmos números de B, com diagnóstico, decisões e resultados (montados no teste).
 * - D (dados incompletos): só um Balanço de agosto — sem DRE, primeira análise.
 */

function doc(documentId: string, companyId: string, source: string, lines: readonly string[]): RawFinancialDocument {
  return { documentId, companyId, source, lines: lines.map((label) => ({ label })) };
}

interface DreValues {
  readonly month: "07" | "08";
  readonly lastDay: "31";
  readonly gross: string;
  readonly salesTaxes: string;
  readonly net: string;
  readonly cogs: string;
  readonly grossProfit: string;
  readonly selling: string;
  readonly admin: string;
  readonly opex: string;
  readonly finIncome: string;
  readonly finExpense: string;
  readonly irpj: string;
  readonly csll: string;
  readonly netIncome: string;
}

function dre(companyId: string, values: DreValues): RawFinancialDocument {
  const { month } = values;
  return doc(`${companyId}-dre-${month}`, companyId, `dre_2026_${month}.pdf`, [
    "Demonstração do Resultado do Exercício",
    `Período: 01/${month}/2026 a ${values.lastDay}/${month}/2026`,
    `Receita Bruta de Vendas R$ ${values.gross}`,
    `Impostos sobre Vendas (R$ ${values.salesTaxes})`,
    `Receita Líquida de Vendas R$ ${values.net}`,
    `Custo dos Produtos Vendidos (R$ ${values.cogs})`,
    `Lucro Bruto R$ ${values.grossProfit}`,
    `Despesas com Vendas (R$ ${values.selling})`,
    `Despesas Administrativas (R$ ${values.admin})`,
    `Total de Despesas Operacionais (R$ ${values.opex})`,
    `Receitas Financeiras R$ ${values.finIncome}`,
    `Despesas Financeiras (R$ ${values.finExpense})`,
    `IRPJ (R$ ${values.irpj})`,
    `CSLL (R$ ${values.csll})`,
    `Lucro Líquido do Exercício ${values.netIncome}`,
  ]);
}

interface BalanceValues {
  readonly month: "07" | "08";
  readonly cash: string;
  readonly receivables: string;
  readonly inventory: string;
  readonly suppliers: string;
  readonly loans: string;
}

function balance(companyId: string, values: BalanceValues): RawFinancialDocument {
  return doc(`${companyId}-balanco-${values.month}`, companyId, `balanco_2026_${values.month}.pdf`, [
    "Balanço Patrimonial",
    `Data-base: 31/${values.month}/2026`,
    `Caixa e Equivalentes de Caixa R$ ${values.cash}`,
    `Clientes R$ ${values.receivables}`,
    `Estoques R$ ${values.inventory}`,
    `Fornecedores R$ ${values.suppliers}`,
    `Empréstimos R$ ${values.loans}`,
  ]);
}

const HEALTHY_JULY: readonly [DreValues, BalanceValues] = [
  {
    month: "07", lastDay: "31", gross: "1.000.000,00", salesTaxes: "90.000,00", net: "910.000,00", cogs: "450.000,00",
    grossProfit: "460.000,00", selling: "100.000,00", admin: "60.000,00", opex: "160.000,00", finIncome: "10.000,00",
    finExpense: "20.000,00", irpj: "40.000,00", csll: "20.000,00", netIncome: "R$ 230.000,00",
  },
  { month: "07", cash: "400.000,00", receivables: "300.000,00", inventory: "150.000,00", suppliers: "200.000,00", loans: "150.000,00" },
];

const HEALTHY_AUGUST: readonly [DreValues, BalanceValues] = [
  {
    month: "08", lastDay: "31", gross: "1.100.000,00", salesTaxes: "99.000,00", net: "1.001.000,00", cogs: "470.000,00",
    grossProfit: "531.000,00", selling: "105.000,00", admin: "60.000,00", opex: "165.000,00", finIncome: "10.000,00",
    finExpense: "20.000,00", irpj: "45.000,00", csll: "25.000,00", netIncome: "R$ 286.000,00",
  },
  { month: "08", cash: "480.000,00", receivables: "310.000,00", inventory: "150.000,00", suppliers: "190.000,00", loans: "140.000,00" },
];

const DETERIORATING_JULY: readonly [DreValues, BalanceValues] = [
  {
    month: "07", lastDay: "31", gross: "1.200.000,00", salesTaxes: "108.000,00", net: "1.092.000,00", cogs: "500.000,00",
    grossProfit: "592.000,00", selling: "120.000,00", admin: "80.000,00", opex: "200.000,00", finIncome: "15.000,00",
    finExpense: "95.000,00", irpj: "45.000,00", csll: "25.000,00", netIncome: "R$ 242.000,00",
  },
  { month: "07", cash: "350.000,00", receivables: "420.000,00", inventory: "180.000,00", suppliers: "210.000,00", loans: "300.000,00" },
];

const DETERIORATING_AUGUST: readonly [DreValues, BalanceValues] = [
  {
    month: "08", lastDay: "31", gross: "1.000.000,00", salesTaxes: "90.000,00", net: "910.000,00", cogs: "620.000,00",
    grossProfit: "290.000,00", selling: "180.000,00", admin: "120.000,00", opex: "300.000,00", finIncome: "5.000,00",
    finExpense: "60.000,00", irpj: "0,00", csll: "0,00", netIncome: "(R$ 65.000,00)",
  },
  { month: "08", cash: "90.000,00", receivables: "520.000,00", inventory: "200.000,00", suppliers: "520.000,00", loans: "600.000,00" },
];

export const FIXTURE_COMPANIES = {
  healthy: "m208-company-a-saudavel",
  deteriorating: "m208-company-b-deterioracao",
  lifecycle: "m208-company-c-ciclo",
  incomplete: "m208-company-d-incompleta",
} as const;

export async function runExecution(
  companyId: string,
  executionId: string,
  executedAt: string,
  documents: readonly RawFinancialDocument[]
): Promise<HistoricalExecution> {
  const { documents: prepared, conflicts } = await prepareClassifiedDocuments(documents);
  const result = await new EFOSPipelineRuntime().execute({
    companyId,
    requestId: `request-${executionId}`,
    executionId,
    timestamp: executedAt,
    metadata: { documents: prepared, conflicts },
  });
  if (!result.success) throw new Error(`pipeline falhou para ${executionId}: ${result.error.message}`);
  const report = await new DefaultReportService().generateReport(result.value.execution);
  const snapshot: ExecutionSnapshot = {
    metadata: { ...result.value.metadata, startedAt: executedAt },
    execution: result.value.execution,
    report: { ...report, metadata: { ...report.metadata, generatedAt: executedAt } },
  };
  return toHistoricalExecution(snapshot);
}

/** Execução id determinístico por empresa e mês (o UUID real não importa a estas funções puras). */
export function fixtureExecutionId(companyId: string, label: string): string {
  return `${companyId}-execucao-${label}`;
}

export interface FixtureHistories {
  readonly healthy: readonly HistoricalExecution[];
  readonly deteriorating: readonly HistoricalExecution[];
  readonly lifecycle: readonly HistoricalExecution[];
  readonly incomplete: readonly HistoricalExecution[];
}

let cached: Promise<FixtureHistories> | undefined;

/** Histórico canônico (ordem `executedAt`) de cada empresa sintética. */
export function buildFixtureHistories(): Promise<FixtureHistories> {
  cached ??= (async () => {
    const { healthy, deteriorating, lifecycle, incomplete } = FIXTURE_COMPANIES;
    const months = async (companyId: string, july: readonly [DreValues, BalanceValues], august: readonly [DreValues, BalanceValues]) => [
      await runExecution(companyId, fixtureExecutionId(companyId, "julho"), "2026-08-05T12:00:00.000Z", [dre(companyId, july[0]), balance(companyId, july[1])]),
      await runExecution(companyId, fixtureExecutionId(companyId, "agosto"), "2026-09-05T12:00:00.000Z", [dre(companyId, august[0]), balance(companyId, august[1])]),
    ];
    return {
      healthy: await months(healthy, HEALTHY_JULY, HEALTHY_AUGUST),
      deteriorating: await months(deteriorating, DETERIORATING_JULY, DETERIORATING_AUGUST),
      lifecycle: await months(lifecycle, DETERIORATING_JULY, DETERIORATING_AUGUST),
      incomplete: [
        await runExecution(incomplete, fixtureExecutionId(incomplete, "agosto"), "2026-09-05T12:00:00.000Z", [balance(incomplete, DETERIORATING_AUGUST[1])]),
      ],
    };
  })();
  return cached;
}

/**
 * Uma execução sintética de agosto (empresa saudável) para qualquer empresa e
 * id — usada pela prova local de fronteira entre empresas
 * (`tests/reports-local/`), que grava o snapshot com a sessão do dono.
 */
export async function buildSyntheticExecution(companyId: string, executionId: string, executedAt: string): Promise<HistoricalExecution> {
  return runExecution(companyId, executionId, executedAt, [dre(companyId, HEALTHY_AUGUST[0]), balance(companyId, HEALTHY_AUGUST[1])]);
}

/** Uma reanálise de julho da MESMA empresa com outros números (documentos divergentes). */
export async function buildDivergentJuly(companyId: string, executedAt: string): Promise<HistoricalExecution> {
  return runExecution(companyId, fixtureExecutionId(companyId, `julho-divergente-${executedAt}`), executedAt, [
    dre(companyId, HEALTHY_JULY[0]),
    balance(companyId, HEALTHY_JULY[1]),
  ]);
}

/** Uma reanálise do mesmo período de agosto (mesmos documentos, executada depois). */
export async function buildReanalysis(companyId: string, executedAt: string): Promise<HistoricalExecution> {
  return runExecution(companyId, fixtureExecutionId(companyId, `agosto-reanalise-${executedAt}`), executedAt, [
    dre(companyId, DETERIORATING_AUGUST[0]),
    balance(companyId, DETERIORATING_AUGUST[1]),
  ]);
}
