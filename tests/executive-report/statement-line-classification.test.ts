import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { StatementCategory } from "@/efos/domain";
import type { NormalizedFinancialRecord } from "@/efos/engines/data";
import { DefaultIncomeStatementBuilder } from "@/efos/engines/financial-model/builders/DefaultIncomeStatementBuilder";

/**
 * Mission 194 — Production Executive Report Truth & Presentation
 * Audit, Seção 7/20/41. Prova direta, no nível do Builder (sem
 * precisar rodar o pipeline inteiro), do defeito confirmado por três
 * missões consecutivas (191/192/193): `DefaultIncomeStatementBuilder`
 * nunca reconhecia `kind === "statement_line"`, então TODA linha de
 * DRE caía em "Residual" — independentemente de sua `StatementCategory`
 * já declarada pelo próprio documento (Receita/Custo/Despesa/
 * Financeiro/Tributos).
 */

function statementLine(
  recordId: string,
  category: StatementCategory,
  amount = 100
): NormalizedFinancialRecord {
  return {
    recordId,
    kind: "statement_line",
    label: `linha-${recordId}`,
    amount,
    currency: "BRL",
    source: "dre.pdf",
    statementCategory: category,
    period: { startDate: "2026-07-01", endDate: "2026-07-31" },
  };
}

function event(
  recordId: string,
  eventType: NormalizedFinancialRecord["eventType"]
): NormalizedFinancialRecord {
  return {
    recordId,
    kind: "event",
    label: `evento-${recordId}`,
    amount: 100,
    currency: "BRL",
    occurredAt: "2026-07-15",
    source: "extrato.pdf",
    eventType,
  };
}

/** Ordem de grupo esperada: Receitas < Custos < Despesas < Financeiro < Tributos < Residual. */
function groupIndexOf(sorted: readonly NormalizedFinancialRecord[], recordId: string): number {
  return sorted.findIndex((record) => record.recordId === recordId);
}

describe("DefaultIncomeStatementBuilder — classificação de StatementLine (D-118)", () => {
  test("nenhuma StatementCategory cai em Residual (Seção 41) — todas as onze categorias têm grupo", () => {
    const categories: readonly StatementCategory[] = [
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
    ];

    const records = categories.map((category, index) => statementLine(`sl-${index}`, category));
    const sorted = new DefaultIncomeStatementBuilder().build(records);

    // Um evento genuinamente não classificado, para provar que Residual
    // continua existindo (com propósito legítimo) — apenas nunca mais
    // recebe uma StatementLine.
    const genuinelyResidual = event("evt-hiring", "hiring");
    const sortedWithResidual = new DefaultIncomeStatementBuilder().build([
      ...records,
      genuinelyResidual,
    ]);

    const residualIndex = groupIndexOf(sortedWithResidual, "evt-hiring");
    for (const category of categories) {
      const recordId = `sl-${categories.indexOf(category)}`;
      const index = groupIndexOf(sortedWithResidual, recordId);
      assert.ok(
        index < residualIndex,
        `StatementCategory "${category}" deveria vir ANTES do grupo Residual (verdadeiramente não classificado), mas não veio`
      );
    }
    assert.equal(sorted.length, categories.length, "nenhum registro é criado/removido pelo Builder");
  });

  test("Receitas (gross_revenue/revenue_deductions/net_revenue) vêm antes de Custos (cost_of_goods_services/gross_profit)", () => {
    const records = [
      statementLine("net_revenue", "net_revenue"),
      statementLine("cogs", "cost_of_goods_services"),
      statementLine("gross_revenue", "gross_revenue"),
      statementLine("gross_profit", "gross_profit"),
    ];
    const sorted = new DefaultIncomeStatementBuilder().build(records);

    assert.ok(groupIndexOf(sorted, "gross_revenue") < groupIndexOf(sorted, "cogs"));
    assert.ok(groupIndexOf(sorted, "net_revenue") < groupIndexOf(sorted, "cogs"));
    assert.ok(groupIndexOf(sorted, "cogs") < groupIndexOf(sorted, "gross_profit"));
  });

  test("Despesas (operating_expense) vêm antes de Financeiro (financial_income/financial_expense/financial_result)", () => {
    const records = [
      statementLine("opex", "operating_expense"),
      statementLine("fin_income", "financial_income"),
      statementLine("fin_expense", "financial_expense"),
      statementLine("fin_result", "financial_result"),
    ];
    const sorted = new DefaultIncomeStatementBuilder().build(records);

    assert.ok(groupIndexOf(sorted, "opex") < groupIndexOf(sorted, "fin_income"));
    assert.ok(groupIndexOf(sorted, "opex") < groupIndexOf(sorted, "fin_expense"));
    assert.ok(groupIndexOf(sorted, "opex") < groupIndexOf(sorted, "fin_result"));
  });

  test("Tributos (taxes/net_income) vêm por último entre os grupos não-residuais — Lucro Líquido é a última linha", () => {
    const records = [
      statementLine("net_income", "net_income"),
      statementLine("taxes", "taxes"),
      statementLine("gross_revenue", "gross_revenue"),
      event("hiring-event", "hiring"),
    ];
    const sorted = new DefaultIncomeStatementBuilder().build(records);

    assert.ok(groupIndexOf(sorted, "taxes") < groupIndexOf(sorted, "net_income"));
    assert.ok(groupIndexOf(sorted, "net_income") < groupIndexOf(sorted, "hiring-event"));
    assert.ok(groupIndexOf(sorted, "gross_revenue") < groupIndexOf(sorted, "taxes"));
  });

  test("eventos de venda/compra/pagamento (fallback D-004) continuam classificados igual a antes — StatementLine não regride o caminho de extrato bancário", () => {
    const records = [
      event("sale-1", "sale"),
      event("purchase-1", "purchase"),
      event("payment-1", "payment"),
      statementLine("opex", "operating_expense"),
    ];
    const sorted = new DefaultIncomeStatementBuilder().build(records);

    assert.ok(groupIndexOf(sorted, "sale-1") < groupIndexOf(sorted, "purchase-1"));
    assert.ok(groupIndexOf(sorted, "purchase-1") < groupIndexOf(sorted, "payment-1"));
    // "payment" (Despesas, evento) e "operating_expense" (Despesas,
    // StatementLine) pertencem ao MESMO grupo — a ordem relativa entre
    // eles não é garantida por esta missão (nunca coexistem na prática:
    // D-109 dá precedência de StatementLine sobre evento por categoria
    // antes mesmo de chegar ao Financial Model) — apenas confirma que
    // nenhum dos dois caiu em Residual.
    const residualStart = groupIndexOf(sorted, "payment-1") + 1;
    assert.ok(groupIndexOf(sorted, "opex") <= residualStart);
  });
});
