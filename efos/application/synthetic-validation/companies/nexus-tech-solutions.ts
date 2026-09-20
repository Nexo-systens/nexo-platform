import type { NormalizedFinancialRecord } from "@/efos/engines/data";
import type { Period } from "@/efos/domain";

import type { SyntheticCompanyDefinition } from "../SyntheticCompanyDefinition";
import type { SyntheticFinancialDataset, SyntheticFinancialPeriod } from "../SyntheticFinancialDataset";
import type { SyntheticGroundTruth } from "../SyntheticGroundTruth";
import type { SyntheticEvidenceTarget } from "../SyntheticEvidenceTarget";
import { buildSyntheticCompanyScenario } from "../buildSyntheticCompanyScenario";
import type { SyntheticCompanyScenario } from "../SyntheticCompanyScenario";

/**
 * Mission 161 — Multi-Company Synthetic Intelligence Isolation (Etapa
 * "REGRA 2 — Create Multiple Distinct Companies").
 *
 * NEXUS TECH SOLUTIONS LTDA. — terceira empresa sintética oficial do
 * EFOS. Claramente fictícia. Perfil DELIBERADAMENTE distinto de AUREA
 * (Mission 156, industrial, 0 evidências) e de ORION (Mission 158,
 * distribuição, crise multi-frente: liquidez+capital de giro+patrimônio
 * líquido+margem+fluxo de caixa simultaneamente): serviços/tecnologia,
 * modelo de investimento em equipe (opex crescendo mais rápido que
 * receita), financiada por capital próprio (nunca por dívida) —
 * liquidez/capital de giro/patrimônio líquido permanecem SEMPRE
 * saudáveis, apenas margem (operacional/líquida) e fluxo de caixa
 * operacional cruzam os limiares reais do `EvidenceEngine` a partir do
 * período 3 — um perfil de risco de UMA ÚNICA FRENTE (rentabilidade),
 * nunca multi-frente como ORION, desenhado com base na leitura direta
 * de `evidence.builder.ts`/`evidence.constants.ts`/`indicators.calculator.ts`
 * (nunca um número arbitrário — ver verificação aritmética completa no
 * README.md, seção 16).
 */
const COMPANY_ID = "synthetic-nexus-tech-solutions";
const SCENARIO_ID = "nexus-tech-solutions-v1";

export const NEXUS_COMPANY_DEFINITION: SyntheticCompanyDefinition = {
  companyId: COMPANY_ID,
  scenarioId: SCENARIO_ID,
  legalName: "NEXUS TECH SOLUTIONS LTDA.",
  industry: "Serviços/Tecnologia — software sob demanda (SaaS) B2B",
  businessModel:
    "Prestação de serviços de software (SaaS) para clientes corporativos — receita recorrente, custo de entrega baixo (infraestrutura de nuvem), sem estoque, financiada por capital próprio (aportes de sócios/investidores), nunca por dívida bancária relevante. Investimento agressivo em equipe (engenharia/produto) cresce mais rápido que a receita — pressão sobre margem, não sobre caixa/liquidez/patrimônio.",
  executiveDescription:
    "Empresa fictícia usada exclusivamente para validação determinística do EFOS (Mission 161) — deliberadamente distinta de AUREA e ORION. Cenário de 6 períodos mensais: dois primeiros meses genuinamente saudáveis em todas as frentes; a partir do período 3, margem operacional e margem líquida (e, consequentemente, fluxo de caixa operacional) tornam-se negativas devido ao crescimento de despesas com equipe — mas liquidez corrente, capital de giro e patrimônio líquido permanecem saudáveis durante todo o cenário (sem dívida, sem estoque, contas a pagar sempre baixas).",
  currency: "BRL",
  fiscalCalendar: {
    periodType: "monthly",
    firstPeriodStart: "2026-01-01T00:00:00.000Z",
  },
};

/**
 * Etapa "REGRA 2" — dinâmica econômica mensal, coerente e documentada,
 * cada linha desenhada com base na leitura direta de
 * `efos/engines/indicators/indicators.calculator.ts` (fórmulas de
 * Liquidez Corrente/Capital de Giro/Endividamento Geral/margens) e
 * `efos/engines/evidence/evidence.builder.ts` (limiares reais) — nunca
 * um número arbitrário. Ver README.md para a verificação aritmética
 * completa período a período.
 */
interface MonthlyFigures {
  readonly month: number; // 1-6
  readonly revenue: number;
  readonly cogs: number;
  readonly opex: number;
  readonly interestExpense: number;
  readonly cash: number;
  readonly accountsReceivable: number;
  readonly accountsPayable: number;
  readonly nonCurrentAsset: number;
}

const MONTHLY_FIGURES: readonly MonthlyFigures[] = [
  { month: 1, revenue: 200_000, cogs: 20_000, opex: 150_000, interestExpense: 1_000, cash: 300_000, accountsReceivable: 40_000, accountsPayable: 15_000, nonCurrentAsset: 50_000 },
  { month: 2, revenue: 210_000, cogs: 21_000, opex: 175_000, interestExpense: 1_000, cash: 280_000, accountsReceivable: 42_000, accountsPayable: 16_000, nonCurrentAsset: 50_000 },
  { month: 3, revenue: 215_000, cogs: 21_500, opex: 205_000, interestExpense: 1_200, cash: 250_000, accountsReceivable: 43_000, accountsPayable: 17_000, nonCurrentAsset: 50_000 },
  { month: 4, revenue: 218_000, cogs: 21_800, opex: 230_000, interestExpense: 1_300, cash: 210_000, accountsReceivable: 44_000, accountsPayable: 18_000, nonCurrentAsset: 50_000 },
  { month: 5, revenue: 220_000, cogs: 22_000, opex: 250_000, interestExpense: 1_400, cash: 170_000, accountsReceivable: 45_000, accountsPayable: 19_000, nonCurrentAsset: 50_000 },
  { month: 6, revenue: 222_000, cogs: 22_200, opex: 265_000, interestExpense: 1_500, cash: 130_000, accountsReceivable: 46_000, accountsPayable: 20_000, nonCurrentAsset: 50_000 },
];

const LAST_DAY_OF_MONTH_2026: Readonly<Record<number, number>> = {
  1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30,
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
  const prefix = (suffix: string) => `nexus-p${m}-${suffix}`;

  // Sem inventory (serviço, sem estoque) e sem loan (financiada por
  // capital próprio, nunca dívida bancária) — a ÚNICA diferença
  // estrutural deliberada frente a AUREA/ORION, que sempre carregam os
  // 6 tipos de Resource; aqui só 4 são necessários para representar
  // honestamente o modelo de negócio (nunca inventar um Resource com
  // valor 0 apenas para manter simetria de forma).
  const resources: NormalizedFinancialRecord[] = [
    { recordId: prefix("cash"), kind: "resource", resourceType: "cash", label: `Caixa — fim do período ${m}`, amount: figures.cash, currency: "BRL", source: "synthetic:nexus" },
    { recordId: prefix("client"), kind: "resource", resourceType: "client", label: `Contas a receber — fim do período ${m}`, amount: figures.accountsReceivable, currency: "BRL", source: "synthetic:nexus" },
    { recordId: prefix("supplier"), kind: "resource", resourceType: "supplier", label: `Contas a pagar — fim do período ${m}`, amount: figures.accountsPayable, currency: "BRL", source: "synthetic:nexus" },
    { recordId: prefix("asset"), kind: "resource", resourceType: "asset", label: `Ativo não-circulante (equipamentos) — fim do período ${m}`, amount: figures.nonCurrentAsset, currency: "BRL", source: "synthetic:nexus" },
  ];

  const events: NormalizedFinancialRecord[] = [
    { recordId: prefix("sale"), kind: "event", eventType: "sale", label: `Receita de serviços do período ${m}`, amount: figures.revenue, currency: "BRL", occurredAt: mid, source: "synthetic:nexus" },
    { recordId: prefix("purchase"), kind: "event", eventType: "purchase", label: `Custo de entrega (infraestrutura) do período ${m}`, amount: -figures.cogs, currency: "BRL", occurredAt: mid, source: "synthetic:nexus" },
    { recordId: prefix("payment"), kind: "event", eventType: "payment", label: `Despesas operacionais (equipe/produto) do período ${m}`, amount: -figures.opex, currency: "BRL", occurredAt: mid, source: "synthetic:nexus" },
    { recordId: prefix("interest"), kind: "event", eventType: "interest_expense", label: `Juros do período ${m}`, amount: -figures.interestExpense, currency: "BRL", occurredAt: mid, source: "synthetic:nexus" },
  ];

  return [...resources, ...events];
}

export function buildNexusSyntheticFinancialDataset(): SyntheticFinancialDataset {
  const periods: SyntheticFinancialPeriod[] = MONTHLY_FIGURES.map((figures) => ({
    periodIndex: figures.month,
    period: monthPeriod(figures.month),
    records: buildPeriodRecords(figures),
  }));

  return { companyId: COMPANY_ID, periods };
}

export function buildNexusSyntheticEvidenceTargets(): readonly SyntheticEvidenceTarget[] {
  return [
    {
      targetEvidenceType: "negative",
      targetCondition: "Margem Operacional e Margem Líquida negativas, Margem Bruta permanece positiva (custo de entrega baixo, só opex de equipe cresce)",
      supportingPeriod: 3,
      expectedThreshold: 0,
      expectedMetric: "Margem Operacional / Margem Líquida",
      expectedOutcome: "operating-margin-negative / net-margin-negative",
    },
    {
      targetEvidenceType: "negative",
      targetCondition: "Fluxo de caixa operacional negativo (mesmo desequilíbrio que gera a margem negativa)",
      supportingPeriod: 3,
      expectedThreshold: 0,
      expectedMetric: "Fluxo de Caixa Operacional (convenção do EvidenceEngine)",
      expectedOutcome: "operating-cash-flow-negative",
    },
  ];
}

/**
 * Etapa "REGRA 2" — Ground Truth inclui explicitamente a afirmação de
 * que liquidez/capital de giro/patrimônio líquido NUNCA cruzam limiar
 * negativo (ao contrário de ORION) — o contraste estrutural deliberado
 * entre as duas empresas é, ele mesmo, parte do que esta missão precisa
 * comprovar.
 */
export function buildNexusSyntheticGroundTruth(): SyntheticGroundTruth {
  return {
    scenarioId: SCENARIO_ID,
    assertions: [
      {
        category: "EXPECTED_FACT",
        statement: "A Margem Operacional do período 6 é negativa.",
        rationale: "Despesas com equipe crescem muito mais rápido que a receita a partir do período 3, por construção do dataset — verificável diretamente no Indicator de margem operacional.",
      },
      {
        category: "EXPECTED_FACT",
        statement: "A Liquidez Corrente do período 6 permanece acima de 1 (saudável).",
        rationale: "Sem dívida bancária e sem estoque, Contas a Pagar permanece sempre baixa frente ao Ativo Circulante (caixa+contas a receber) — diferente de ORION, onde o mesmo indicador cruza abaixo de 1.",
      },
      {
        category: "EXPECTED_FACT",
        statement: "O Capital de Giro do período 6 permanece positivo.",
        rationale: "Ativo Circulante permanece sempre superior a Contas a Pagar, por construção do dataset.",
      },
      {
        category: "EXPECTED_SIGNAL",
        statement: "O EvidenceEngine real deveria produzir evidências de categoria 'profitability' e 'cash_flow' a partir do período 3, mas NUNCA de categoria 'liquidity'/'working_capital'/'debt'.",
        rationale: "Os valores absolutos da NEXUS cruzam genuinamente margens negativas e fluxo de caixa operacional negativo a partir do período 3, mas nunca os limiares de liquidez/capital de giro/endividamento — perfil de risco de frente única, deliberadamente distinto de ORION (multi-frente).",
      },
      {
        category: "EXPECTED_SIGNAL",
        statement: "O ContextEngine real deveria agrupar essas evidências em 'profitability', mas NUNCA em 'cash_pressure' (que exige ≥2 evidências dentre liquidity/working_capital/cash_flow — apenas 1 categoria desse grupo, cash_flow, está presente).",
        rationale: "MINIMUM_EVIDENCES_FOR_CONTEXT (2) é atingido na categoria de rentabilidade (2 evidências: operating+net margin), mas não no grupo de pressão de caixa (apenas 1 evidência, cash_flow).",
      },
      {
        category: "EXPECTED_INTERPRETATION",
        statement: "Uma Executive AI real poderia descrever o cenário como 'empresa de serviços com crise de rentabilidade isolada, financeiramente estável em liquidez/capital'.",
        rationale: "Nunca uma obrigação — apenas uma interpretação plausível dentre outras legítimas; a arquitetura nunca é validada contra o texto exato gerado por um modelo de IA.",
      },
    ],
    decisionScenario: {
      problem: "Investimento acelerado em equipe levou a margens operacional e líquida negativas, mesmo com liquidez e patrimônio líquido saudáveis — risco financeiro concentrado em rentabilidade, não em solvência.",
      expectedRecommendationThemes: ["revisar estrutura de custos"],
      expectedDecisionNature:
        "Uma ação executiva explicitamente humana (nunca fabricada automaticamente) — por exemplo, revisar ritmo de contratação ou renegociar custos de infraestrutura.",
    },
    evidenceTargets: buildNexusSyntheticEvidenceTargets(),
  };
}

export function buildNexusTechSolutionsScenario(): SyntheticCompanyScenario {
  return buildSyntheticCompanyScenario(
    NEXUS_COMPANY_DEFINITION,
    buildNexusSyntheticFinancialDataset(),
    buildNexusSyntheticGroundTruth(),
    "1.0.0",
    ["financial_truth"]
  );
}
