import type { HistoricalExecution } from "@/efos/application/history";
import type { RawFinancialDocument } from "@/efos/engines/data";

import { runExecution } from "./report-fixtures";

/**
 * Mission 209 — meses sintéticos para a matriz temporal, pelo mesmo caminho
 * de produção das fixtures da Mission 208 (intake real → `EFOSPipelineRuntime`
 * → `DefaultReportService`). Valores fictícios, aritmeticamente coerentes:
 * a escala muda a margem de um mês para o outro, o que permite provar que a
 * variação mostrada é a do período anterior canônico — nunca a de uma
 * reanálise do mesmo mês.
 */

const LAST_DAY: Readonly<Record<string, string>> = { "01": "31", "02": "28", "03": "31", "04": "30" };

function brl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function doc(documentId: string, companyId: string, lines: readonly string[]): RawFinancialDocument {
  return { documentId, companyId, source: `${documentId}.pdf`, lines: lines.map((label) => ({ label })) };
}

/** DRE mensal com custo proporcional a `costRatio` (maior custo → margem menor). */
function dre(companyId: string, month: string, costRatio: number, tag: string): RawFinancialDocument {
  const gross = 1_000_000;
  const salesTaxes = 90_000;
  const net = gross - salesTaxes;
  const cogs = Math.round(net * costRatio);
  const grossProfit = net - cogs;
  const opex = 150_000;
  const financial = -10_000;
  const preTax = grossProfit - opex + financial;
  const taxes = preTax > 0 ? Math.round(preTax * 0.2) : 0;
  const netIncome = preTax - taxes;
  return doc(`${companyId}-dre-${month}-${tag}`, companyId, [
    "Demonstração do Resultado do Exercício",
    `Período: 01/${month}/2026 a ${LAST_DAY[month]}/${month}/2026`,
    `Receita Bruta de Vendas R$ ${brl(gross)}`,
    `Impostos sobre Vendas (R$ ${brl(salesTaxes)})`,
    `Receita Líquida de Vendas R$ ${brl(net)}`,
    `Custo dos Produtos Vendidos (R$ ${brl(cogs)})`,
    `Lucro Bruto R$ ${brl(grossProfit)}`,
    `Total de Despesas Operacionais (R$ ${brl(opex)})`,
    "Receitas Financeiras R$ 5.000,00",
    "Despesas Financeiras (R$ 15.000,00)",
    `IRPJ (R$ ${brl(taxes)})`,
    `Lucro Líquido do Exercício ${netIncome >= 0 ? `R$ ${brl(netIncome)}` : `(R$ ${brl(-netIncome)})`}`,
  ]);
}

function balance(companyId: string, day: string, month: string, cash: number, tag: string): RawFinancialDocument {
  return doc(`${companyId}-balanco-${month}-${tag}`, companyId, [
    "Balanço Patrimonial",
    `Data-base: ${day}/${month}/2026`,
    `Caixa e Equivalentes de Caixa R$ ${brl(cash)}`,
    "Clientes R$ 300.000,00",
    "Estoques R$ 150.000,00",
    "Fornecedores R$ 200.000,00",
    "Empréstimos R$ 150.000,00",
  ]);
}

let sequence = 0;
function nextExecutedAt(): string {
  sequence += 1;
  return new Date(Date.UTC(2026, 5, 1, 12, 0, sequence)).toISOString();
}

/** Mês completo (DRE + Balanço do último dia). `tag` distingue versões do mesmo mês. */
export function monthly(companyId: string, month: string, costRatio: number, tag = "v1"): Promise<HistoricalExecution> {
  return runExecution(companyId, `${companyId}-${month}-${tag}`, nextExecutedAt(), [
    dre(companyId, month, costRatio, tag),
    balance(companyId, LAST_DAY[month], month, 400_000, tag),
  ]);
}

/** Posição de um dia (só Balanço): período de um único dia, indicadores de resultado indisponíveis. */
export function pointInTime(companyId: string, month: string, cash: number, tag = "v1"): Promise<HistoricalExecution> {
  return runExecution(companyId, `${companyId}-${month}-pos-${tag}`, nextExecutedAt(), [balance(companyId, LAST_DAY[month], month, cash, tag)]);
}
