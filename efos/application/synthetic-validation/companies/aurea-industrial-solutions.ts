import type { NormalizedFinancialRecord } from "@/efos/engines/data";
import type { Period } from "@/efos/domain";

import type { SyntheticCompanyDefinition } from "../SyntheticCompanyDefinition";
import type { SyntheticFinancialDataset, SyntheticFinancialPeriod } from "../SyntheticFinancialDataset";
import type { SyntheticGroundTruth } from "../SyntheticGroundTruth";
import { buildSyntheticCompanyScenario } from "../buildSyntheticCompanyScenario";
import type { SyntheticCompanyScenario } from "../SyntheticCompanyScenario";

/**
 * Mission 156 — Synthetic Company Validation Foundation (Etapa 3).
 *
 * AUREA INDUSTRIAL SOLUTIONS LTDA. — primeira empresa sintética oficial
 * do EFOS. Claramente fictícia (nome inventado, nenhuma correspondência
 * com empresa real identificável). Perfil: B2B industrial, receita
 * parcialmente contratual, venda de produtos/equipamentos, custos
 * industriais relevantes, clientes corporativos, contas a receber e
 * estoque relevantes, crescimento recente com margem deteriorando e
 * pressão crescente sobre caixa — exatamente o perfil pedido pela
 * missão.
 *
 * `companyId`/`scenarioId` são strings determinísticas fixas — nunca
 * `randomUUID()` (Etapa 6/S).
 */
const COMPANY_ID = "synthetic-aurea-industrial-solutions";
const SCENARIO_ID = "aurea-industrial-solutions-v1";

export const AUREA_COMPANY_DEFINITION: SyntheticCompanyDefinition = {
  companyId: COMPANY_ID,
  scenarioId: SCENARIO_ID,
  legalName: "AUREA INDUSTRIAL SOLUTIONS LTDA.",
  industry: "Indústria B2B — equipamentos e soluções industriais",
  businessModel:
    "Venda de produtos/equipamentos industriais para clientes corporativos, com parcela de receita recorrente contratual (contratos de manutenção/suporte) e parcela transacional (vendas avulsas de equipamento). Estrutura de custos industrial (produção/insumos relevante), capital de giro relevante (recebíveis e estoque de equipamentos/peças).",
  executiveDescription:
    "Empresa fictícia usada exclusivamente para validação determinística do EFOS (Mission 156). Cenário de 6 períodos mensais: crescimento saudável nos primeiros dois meses, seguido de deterioração progressiva de margem e de capital de giro (contas a receber e estoque crescendo mais rápido que a receita), consumindo caixa e elevando endividamento de forma administrável, porém crescente.",
  currency: "BRL",
  fiscalCalendar: {
    periodType: "monthly",
    firstPeriodStart: "2026-01-01T00:00:00.000Z",
  },
};

/**
 * Etapa 4/8 — dinâmica econômica mensal, coerente e documentada.
 * Nenhum número é aleatório: cada linha obedece as relações descritas
 * abaixo (README.md tem o detalhamento completo).
 *
 * - Receita cresce ~9-13% ao mês em todos os 6 períodos (narrativa de
 *   crescimento contínuo, nunca interrompida).
 * - CMV cresce PROPORCIONALMENTE MAIS RÁPIDO que a receita a partir do
 *   período 3 → margem bruta cai de 40% (P1) para 28,9% (P6).
 * - Contas a receber crescem mais rápido que a receita (30% da receita
 *   em P1 → 48,2% em P6) — prazo de recebimento se alongando.
 * - Estoque cresce de forma semelhante (acompanhando o crescimento de
 *   vendas futuras esperado, mas sem giro proporcional).
 * - Capital de giro (AR + Estoque − Fornecedores) cresce de 160k (P1)
 *   para 565k (P6) — consumindo caixa de forma crescente.
 * - Caixa cai de 220k (P1) para 100k (P6), consistente com o aumento
 *   de capital de giro superando a geração operacional.
 * - Dívida (loan) cresce de 50k (P1) para 150k (P6) — endividamento
 *   administrável (nunca ultrapassa o Ativo não-circulante), porém em
 *   trajetória clara de alta, junto de despesa de juros crescente.
 */
interface MonthlyFigures {
  readonly month: number; // 1-6
  readonly revenue: number;
  readonly cogs: number;
  readonly opex: number;
  readonly interestExpense: number;
  readonly cash: number;
  readonly accountsReceivable: number;
  readonly inventory: number;
  readonly accountsPayable: number;
  readonly loan: number;
  readonly nonCurrentAsset: number;
}

const MONTHLY_FIGURES: readonly MonthlyFigures[] = [
  { month: 1, revenue: 500_000, cogs: 300_000, opex: 120_000, interestExpense: 1_000, cash: 220_000, accountsReceivable: 150_000, inventory: 100_000, accountsPayable: 90_000, loan: 50_000, nonCurrentAsset: 300_000 },
  { month: 2, revenue: 550_000, cogs: 335_000, opex: 125_000, interestExpense: 1_100, cash: 240_000, accountsReceivable: 165_000, inventory: 110_000, accountsPayable: 95_000, loan: 55_000, nonCurrentAsset: 305_000 },
  { month: 3, revenue: 620_000, cogs: 390_000, opex: 135_000, interestExpense: 1_300, cash: 230_000, accountsReceivable: 200_000, inventory: 140_000, accountsPayable: 100_000, loan: 65_000, nonCurrentAsset: 310_000 },
  { month: 4, revenue: 690_000, cogs: 455_000, opex: 145_000, interestExpense: 1_600, cash: 200_000, accountsReceivable: 250_000, inventory: 175_000, accountsPayable: 105_000, loan: 80_000, nonCurrentAsset: 315_000 },
  { month: 5, revenue: 760_000, cogs: 525_000, opex: 160_000, interestExpense: 2_200, cash: 150_000, accountsReceivable: 320_000, inventory: 220_000, accountsPayable: 110_000, loan: 110_000, nonCurrentAsset: 320_000 },
  { month: 6, revenue: 830_000, cogs: 590_000, opex: 175_000, interestExpense: 3_000, cash: 100_000, accountsReceivable: 400_000, inventory: 280_000, accountsPayable: 115_000, loan: 150_000, nonCurrentAsset: 325_000 },
];

/**
 * Último dia de cada um dos 6 meses de 2026 (2026 não é bissexto) —
 * tabela literal fixa, nunca `new Date()`/`Date.now()` (Etapa 6/T: o
 * builder nunca lê o relógio real, nem para cálculo de calendário).
 */
const LAST_DAY_OF_MONTH_2026: Readonly<Record<number, number>> = {
  1: 31,
  2: 28,
  3: 31,
  4: 30,
  5: 31,
  6: 30,
};

function monthPeriod(month: number): Period {
  const startDate = `2026-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
  const lastDay = LAST_DAY_OF_MONTH_2026[month];
  const endDate = `2026-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59.000Z`;
  return { startDate, endDate };
}

/**
 * Constrói os `NormalizedFinancialRecord[]` de um único período — 6
 * `Resource`s (saldos de fim de período, convenção D-004: cash/client/
 * inventory/supplier/loan/asset) + 4 `FinancialEvent`s (fluxos do mês:
 * sale/purchase/payment/interest_expense). `recordId` é sempre uma
 * string determinística prefixada pelo mês — nunca `randomUUID()`.
 */
function buildPeriodRecords(figures: MonthlyFigures): readonly NormalizedFinancialRecord[] {
  const m = figures.month;
  const mid = `2026-${String(m).padStart(2, "0")}-15T00:00:00.000Z`;
  const prefix = (suffix: string) => `aurea-p${m}-${suffix}`;

  const resources: NormalizedFinancialRecord[] = [
    { recordId: prefix("cash"), kind: "resource", resourceType: "cash", label: `Caixa — fim do período ${m}`, amount: figures.cash, currency: "BRL", source: "synthetic:aurea" },
    { recordId: prefix("client"), kind: "resource", resourceType: "client", label: `Contas a receber — fim do período ${m}`, amount: figures.accountsReceivable, currency: "BRL", source: "synthetic:aurea" },
    { recordId: prefix("inventory"), kind: "resource", resourceType: "inventory", label: `Estoque — fim do período ${m}`, amount: figures.inventory, currency: "BRL", source: "synthetic:aurea" },
    { recordId: prefix("supplier"), kind: "resource", resourceType: "supplier", label: `Contas a pagar — fim do período ${m}`, amount: figures.accountsPayable, currency: "BRL", source: "synthetic:aurea" },
    { recordId: prefix("loan"), kind: "resource", resourceType: "loan", label: `Empréstimos — fim do período ${m}`, amount: figures.loan, currency: "BRL", source: "synthetic:aurea" },
    { recordId: prefix("asset"), kind: "resource", resourceType: "asset", label: `Ativo não-circulante — fim do período ${m}`, amount: figures.nonCurrentAsset, currency: "BRL", source: "synthetic:aurea" },
  ];

  const events: NormalizedFinancialRecord[] = [
    { recordId: prefix("sale"), kind: "event", eventType: "sale", label: `Vendas do período ${m}`, amount: figures.revenue, currency: "BRL", occurredAt: mid, source: "synthetic:aurea" },
    { recordId: prefix("purchase"), kind: "event", eventType: "purchase", label: `CMV do período ${m}`, amount: -figures.cogs, currency: "BRL", occurredAt: mid, source: "synthetic:aurea" },
    { recordId: prefix("payment"), kind: "event", eventType: "payment", label: `Despesas operacionais do período ${m}`, amount: -figures.opex, currency: "BRL", occurredAt: mid, source: "synthetic:aurea" },
    { recordId: prefix("interest"), kind: "event", eventType: "interest_expense", label: `Juros do período ${m}`, amount: -figures.interestExpense, currency: "BRL", occurredAt: mid, source: "synthetic:aurea" },
  ];

  return [...resources, ...events];
}

export function buildAureaSyntheticFinancialDataset(): SyntheticFinancialDataset {
  const periods: SyntheticFinancialPeriod[] = MONTHLY_FIGURES.map((figures) => ({
    periodIndex: figures.month,
    period: monthPeriod(figures.month),
    records: buildPeriodRecords(figures),
  }));

  return { companyId: COMPANY_ID, periods };
}

/**
 * Etapa 5 — Ground Truth, conhecido apenas pelo harness de teste,
 * nunca enviado à Executive AI/prompt/Financial Truth/Knowledge.
 */
export function buildAureaSyntheticGroundTruth(): SyntheticGroundTruth {
  return {
    scenarioId: SCENARIO_ID,
    assertions: [
      {
        category: "EXPECTED_FACT",
        statement: "A margem bruta do período 6 é menor que a margem bruta do período 1.",
        rationale: "CMV cresce proporcionalmente mais rápido que a receita a partir do período 3 (dado de entrada determinístico) — diretamente verificável no Indicator de margem bruta calculado pelo Indicators Engine.",
      },
      {
        category: "EXPECTED_FACT",
        statement: "A razão Contas a Receber / Receita do período 6 é maior que a do período 1.",
        rationale: "AR cresce de 30% da receita (P1) para 48,2% da receita (P6) por construção do dataset — verificável comparando `accountsReceivable`/`revenue` derivados em cada período.",
      },
      {
        category: "EXPECTED_FACT",
        statement: "O caixa do período 6 é menor que o caixa do período 1.",
        rationale: "Caixa cai de 220.000 (P1) para 100.000 (P6) por construção do dataset.",
      },
      {
        category: "EXPECTED_FACT",
        statement: "A dívida (loan) do período 6 é maior que a do período 1, mas nunca ultrapassa o Ativo não-circulante em nenhum período.",
        rationale: "Endividamento administrável, porém crescente, por desenho explícito da missão — loan sempre < nonCurrentAsset em todos os 6 períodos.",
      },
      {
        category: "EXPECTED_SIGNAL",
        statement: "Um Evidence/Context Engine real, ao processar este Financial Model, provavelmente sinalizaria pressão de capital de giro e/ou deterioração de margem.",
        rationale: "Documentado para uma missão futura que exercite Evidence/Context Engines sobre este dataset — não testado nesta missão (Etapa 12/13, fora do escopo de Mission 156).",
      },
      {
        category: "EXPECTED_INTERPRETATION",
        statement: "Uma Executive AI real poderia descrever o cenário como 'crescimento que não converte em geração de caixa'.",
        rationale: "Nunca uma obrigação — apenas uma interpretação plausível dentre outras legítimas; a arquitetura nunca é validada contra o texto exato gerado por um modelo de IA.",
      },
    ],
    decisionScenario: {
      problem: "O crescimento de receita está consumindo caixa, por meio de capital de giro crescente (recebíveis e estoque) que cresce mais rápido que a receita, junto de margem bruta em queda.",
      expectedRecommendationThemes: [
        "melhorar conversão/prazo de recebíveis",
        "controlar crescimento de estoque",
        "revisar estrutura de custo/CMV para conter a queda de margem",
      ],
      expectedDecisionNature:
        "Uma ação executiva explicitamente humana (nunca fabricada automaticamente) — por exemplo, priorizar iniciativas de gestão de capital de giro. Execution/Outcome ficam para uma missão futura que exercite o fluxo humano real.",
    },
  };
}

export function buildAureaIndustrialSolutionsScenario(): SyntheticCompanyScenario {
  return buildSyntheticCompanyScenario(
    AUREA_COMPANY_DEFINITION,
    buildAureaSyntheticFinancialDataset(),
    buildAureaSyntheticGroundTruth(),
    "1.0.0",
    ["financial_truth"]
  );
}
