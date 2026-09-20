import type { NormalizedFinancialRecord } from "@/efos/engines/data";
import type { Period } from "@/efos/domain";

import type { SyntheticCompanyDefinition } from "../SyntheticCompanyDefinition";
import type { SyntheticFinancialDataset, SyntheticFinancialPeriod } from "../SyntheticFinancialDataset";
import type { SyntheticGroundTruth } from "../SyntheticGroundTruth";
import type { SyntheticEvidenceTarget } from "../SyntheticEvidenceTarget";
import { buildSyntheticCompanyScenario } from "../buildSyntheticCompanyScenario";
import type { SyntheticCompanyScenario } from "../SyntheticCompanyScenario";

/**
 * Mission 158 — Second Synthetic Company / Evidence Threshold
 * Validation (Etapa 2).
 *
 * ORION DISTRIBUTION GROUP LTDA. — segunda empresa sintética oficial do
 * EFOS. Claramente fictícia. Perfil deliberadamente distinto da AUREA
 * (Mission 156, B2B industrial em crescimento saudável): distribuição/
 * atacado B2B, margens estruturalmente finas (típico do setor),
 * crescimento baixo/estagnado, liquidez sob pressão crescente,
 * endividamento elevado — desenhada, com base na leitura direta dos
 * limiares REAIS do `EvidenceEngine` (Etapa 1/5), para cruzá-los
 * genuinamente por volta do período 5, nunca artificialmente extrema
 * apenas para "passar no teste" (os 4 primeiros períodos permanecem
 * genuinamente saudáveis — ver README.md, "ORION EVIDENCE VALIDATION",
 * para a tabela completa período a período).
 */
const COMPANY_ID = "synthetic-orion-distribution-group";
const SCENARIO_ID = "orion-distribution-group-v1";

export const ORION_COMPANY_DEFINITION: SyntheticCompanyDefinition = {
  companyId: COMPANY_ID,
  scenarioId: SCENARIO_ID,
  legalName: "ORION DISTRIBUTION GROUP LTDA.",
  industry: "Distribuição/atacado B2B",
  businessModel:
    "Compra e revenda de produtos para clientes corporativos (varejo/indústria) em grande volume — margens estruturalmente finas (típicas de distribuição), forte dependência de crédito de fornecedores (contas a pagar elevadas) e de crédito concedido a clientes (contas a receber elevadas), estoque de giro relevante.",
  executiveDescription:
    "Empresa fictícia usada exclusivamente para validação determinística do EFOS (Mission 158) — deliberadamente distinta da AUREA (Mission 156). Cenário de 8 períodos mensais: estabilidade nos dois primeiros meses, seguida de compressão progressiva de margem (a partir do período 3) e, a partir do período 5, cruzamento genuíno de múltiplos limiares absolutos reais do EvidenceEngine — liquidez corrente abaixo de 1, capital de giro negativo, patrimônio líquido negativo, fluxo de caixa operacional negativo — simultaneamente à deterioração de margem já em curso.",
  currency: "BRL",
  fiscalCalendar: {
    periodType: "monthly",
    firstPeriodStart: "2026-01-01T00:00:00.000Z",
  },
};

/**
 * Etapa 1/5 — dinâmica econômica mensal, coerente e documentada, cada
 * linha desenhada com base na leitura direta de
 * `efos/engines/evidence/evidence.constants.ts`/`evidence.builder.ts`
 * (nunca um número arbitrário): períodos 1-2 genuinamente saudáveis em
 * todos os 5 limiares; períodos 3-4 já com margem/fluxo de caixa
 * operacional negativos (mas liquidez/capital de giro/patrimônio ainda
 * saudáveis); períodos 5-8 cruzando também liquidez<1, capital de giro
 * negativo e patrimônio líquido negativo — ver README.md para a
 * verificação aritmética completa contra as fórmulas reais do
 * Indicators Engine.
 */
interface MonthlyFigures {
  readonly month: number; // 1-8
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
  { month: 1, revenue: 800_000, cogs: 735_000, opex: 50_000, interestExpense: 5_000, cash: 80_000, accountsReceivable: 300_000, inventory: 250_000, accountsPayable: 500_000, loan: 150_000, nonCurrentAsset: 200_000 },
  { month: 2, revenue: 810_000, cogs: 750_000, opex: 52_000, interestExpense: 5_500, cash: 70_000, accountsReceivable: 310_000, inventory: 260_000, accountsPayable: 540_000, loan: 170_000, nonCurrentAsset: 200_000 },
  { month: 3, revenue: 795_000, cogs: 745_000, opex: 53_000, interestExpense: 6_000, cash: 55_000, accountsReceivable: 320_000, inventory: 270_000, accountsPayable: 580_000, loan: 195_000, nonCurrentAsset: 200_000 },
  { month: 4, revenue: 780_000, cogs: 738_000, opex: 54_000, interestExpense: 7_000, cash: 40_000, accountsReceivable: 330_000, inventory: 280_000, accountsPayable: 620_000, loan: 225_000, nonCurrentAsset: 200_000 },
  { month: 5, revenue: 770_000, cogs: 735_000, opex: 55_000, interestExpense: 8_500, cash: 25_000, accountsReceivable: 335_000, inventory: 285_000, accountsPayable: 660_000, loan: 260_000, nonCurrentAsset: 200_000 },
  { month: 6, revenue: 750_000, cogs: 725_000, opex: 56_000, interestExpense: 10_000, cash: 15_000, accountsReceivable: 340_000, inventory: 290_000, accountsPayable: 700_000, loan: 295_000, nonCurrentAsset: 200_000 },
  { month: 7, revenue: 730_000, cogs: 715_000, opex: 57_000, interestExpense: 12_000, cash: 8_000, accountsReceivable: 345_000, inventory: 295_000, accountsPayable: 740_000, loan: 325_000, nonCurrentAsset: 200_000 },
  { month: 8, revenue: 700_000, cogs: 705_000, opex: 58_000, interestExpense: 14_000, cash: 3_000, accountsReceivable: 350_000, inventory: 300_000, accountsPayable: 780_000, loan: 350_000, nonCurrentAsset: 200_000 },
];

const LAST_DAY_OF_MONTH_2026: Readonly<Record<number, number>> = {
  1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30, 7: 31, 8: 31,
};

function monthPeriod(month: number): Period {
  const startDate = `2026-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
  const lastDay = LAST_DAY_OF_MONTH_2026[month];
  const endDate = `2026-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59.000Z`;
  return { startDate, endDate };
}

function buildPeriodRecords(figures: MonthlyFigures): readonly NormalizedFinancialRecord[] {
  const m = figures.month;
  const mid = `2026-${String(m).padStart(2, "0")}-15T00:00:00.000Z`;
  const prefix = (suffix: string) => `orion-p${m}-${suffix}`;

  const resources: NormalizedFinancialRecord[] = [
    { recordId: prefix("cash"), kind: "resource", resourceType: "cash", label: `Caixa — fim do período ${m}`, amount: figures.cash, currency: "BRL", source: "synthetic:orion" },
    { recordId: prefix("client"), kind: "resource", resourceType: "client", label: `Contas a receber — fim do período ${m}`, amount: figures.accountsReceivable, currency: "BRL", source: "synthetic:orion" },
    { recordId: prefix("inventory"), kind: "resource", resourceType: "inventory", label: `Estoque — fim do período ${m}`, amount: figures.inventory, currency: "BRL", source: "synthetic:orion" },
    { recordId: prefix("supplier"), kind: "resource", resourceType: "supplier", label: `Contas a pagar — fim do período ${m}`, amount: figures.accountsPayable, currency: "BRL", source: "synthetic:orion" },
    { recordId: prefix("loan"), kind: "resource", resourceType: "loan", label: `Empréstimos — fim do período ${m}`, amount: figures.loan, currency: "BRL", source: "synthetic:orion" },
    { recordId: prefix("asset"), kind: "resource", resourceType: "asset", label: `Ativo não-circulante — fim do período ${m}`, amount: figures.nonCurrentAsset, currency: "BRL", source: "synthetic:orion" },
  ];

  const events: NormalizedFinancialRecord[] = [
    { recordId: prefix("sale"), kind: "event", eventType: "sale", label: `Vendas do período ${m}`, amount: figures.revenue, currency: "BRL", occurredAt: mid, source: "synthetic:orion" },
    { recordId: prefix("purchase"), kind: "event", eventType: "purchase", label: `CMV do período ${m}`, amount: -figures.cogs, currency: "BRL", occurredAt: mid, source: "synthetic:orion" },
    { recordId: prefix("payment"), kind: "event", eventType: "payment", label: `Despesas operacionais do período ${m}`, amount: -figures.opex, currency: "BRL", occurredAt: mid, source: "synthetic:orion" },
    { recordId: prefix("interest"), kind: "event", eventType: "interest_expense", label: `Juros do período ${m}`, amount: -figures.interestExpense, currency: "BRL", occurredAt: mid, source: "synthetic:orion" },
  ];

  return [...resources, ...events];
}

export function buildOrionSyntheticFinancialDataset(): SyntheticFinancialDataset {
  const periods: SyntheticFinancialPeriod[] = MONTHLY_FIGURES.map((figures) => ({
    periodIndex: figures.month,
    period: monthPeriod(figures.month),
    records: buildPeriodRecords(figures),
  }));

  return { companyId: COMPANY_ID, periods };
}

/**
 * Etapa 5 — condições que o cenário foi deliberadamente desenhado para
 * cruzar, com o limiar REAL lido de `evidence.constants.ts`. Metadata
 * de validação — nunca enviada a nenhuma Engine.
 */
export function buildOrionSyntheticEvidenceTargets(): readonly SyntheticEvidenceTarget[] {
  return [
    {
      targetEvidenceType: "negative",
      targetCondition: "Liquidez Corrente abaixo do mínimo saudável (Ativo Circulante não cobre integralmente o Passivo Circulante)",
      supportingPeriod: 5,
      expectedThreshold: 1,
      expectedMetric: "Liquidez Corrente",
      expectedOutcome: "liquidity-below-minimum",
    },
    {
      targetEvidenceType: "negative",
      targetCondition: "Margem Operacional e Margem Líquida negativas",
      supportingPeriod: 3,
      expectedThreshold: 0,
      expectedMetric: "Margem Operacional / Margem Líquida",
      expectedOutcome: "operating-margin-negative / net-margin-negative",
    },
    {
      targetEvidenceType: "negative",
      targetCondition: "Capital de Giro negativo (Passivo Circulante supera o Ativo Circulante)",
      supportingPeriod: 5,
      expectedThreshold: 0,
      expectedMetric: "Capital de Giro",
      expectedOutcome: "working-capital-insufficient",
    },
    {
      targetEvidenceType: "negative",
      targetCondition: "Endividamento Geral acima do breakeven de patrimônio líquido (Passivo Total supera o Ativo Total)",
      supportingPeriod: 5,
      expectedThreshold: 100,
      expectedMetric: "Endividamento Geral",
      expectedOutcome: "negative-equity",
    },
    {
      targetEvidenceType: "negative",
      targetCondition: "Fluxo de caixa operacional negativo (saídas de sale/purchase/payment superam entradas)",
      supportingPeriod: 3,
      expectedThreshold: 0,
      expectedMetric: "Fluxo de Caixa Operacional (convenção do EvidenceEngine)",
      expectedOutcome: "operating-cash-flow-negative",
    },
  ];
}

export function buildOrionSyntheticGroundTruth(): SyntheticGroundTruth {
  return {
    scenarioId: SCENARIO_ID,
    assertions: [
      {
        category: "EXPECTED_FACT",
        statement: "A Liquidez Corrente do período 8 é menor que 1.",
        rationale: "Ativo Circulante (caixa+AR+estoque) cresce mais devagar que Contas a Pagar a partir do período 5, por construção do dataset — diretamente verificável no Indicator de liquidez corrente calculado pelo Indicators Engine.",
      },
      {
        category: "EXPECTED_FACT",
        statement: "A Margem Operacional do período 8 é negativa.",
        rationale: "Despesas operacionais crescem enquanto a margem bruta se comprime, por construção do dataset — verificável diretamente no Indicator de margem operacional.",
      },
      {
        category: "EXPECTED_FACT",
        statement: "O Capital de Giro do período 8 é negativo.",
        rationale: "Contas a Pagar cresce mais rápido que Ativo Circulante a partir do período 5, por construção do dataset.",
      },
      {
        category: "EXPECTED_SIGNAL",
        statement: "O EvidenceEngine real deveria produzir ao menos uma Evidence de categoria 'liquidity' e uma de categoria 'profitability' a partir do período 5.",
        rationale: "Os valores absolutos da ORION cruzam genuinamente CURRENT_LIQUIDITY_MINIMUM (1) e margens negativas a partir do período 5 — testável diretamente contra a Engine real, ao contrário da AUREA (Mission 156/157).",
      },
      {
        category: "EXPECTED_SIGNAL",
        statement: "O ContextEngine real deveria agrupar essas evidências em 'pressão de caixa' e 'rentabilidade comprometida' a partir do período 5.",
        rationale: "MINIMUM_EVIDENCES_FOR_CONTEXT (2) é atingido tanto nas categorias de pressão de caixa (liquidity/working_capital/cash_flow) quanto na categoria de rentabilidade a partir do período 5.",
      },
      {
        category: "EXPECTED_INTERPRETATION",
        statement: "Uma Executive AI real poderia descrever o cenário como 'distribuidora com margem estrutural fina, endividada, sob pressão de liquidez'.",
        rationale: "Nunca uma obrigação — apenas uma interpretação plausível dentre outras legítimas; a arquitetura nunca é validada contra o texto exato gerado por um modelo de IA.",
      },
    ],
    decisionScenario: {
      problem: "Margens estruturalmente finas, combinadas a endividamento crescente, levaram a empresa a uma posição de liquidez e patrimônio líquido negativos — risco financeiro em múltiplas frentes simultâneas.",
      expectedRecommendationThemes: [
        "reforçar geração de caixa operacional",
        "revisar estrutura de custos",
        "revisar operações em múltiplas frentes financeiras",
      ],
      expectedDecisionNature:
        "Uma ação executiva explicitamente humana (nunca fabricada automaticamente) — por exemplo, priorizar renegociação de dívida ou revisão de precificação. Execution/Outcome ficam para uma missão futura que exercite o fluxo humano real.",
    },
    evidenceTargets: buildOrionSyntheticEvidenceTargets(),
  };
}

export function buildOrionDistributionGroupScenario(): SyntheticCompanyScenario {
  return buildSyntheticCompanyScenario(
    ORION_COMPANY_DEFINITION,
    buildOrionSyntheticFinancialDataset(),
    buildOrionSyntheticGroundTruth(),
    "1.0.0",
    ["financial_truth"]
  );
}
