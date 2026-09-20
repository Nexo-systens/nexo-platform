import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { StatementLine } from "@/efos/domain";

import { buildRealisticDre } from "./fixtures";
import { runIngestion } from "./helpers";

/**
 * Mission 193 — Production Intake Governance & Permanent Regression
 * Gate. Protege, permanentemente, os dois achados mais graves da
 * Mission 191 (auditoria de produção): uma DRE real quebrava porque o
 * classificador transacional lia "Despesas com Vendas" como VENDA
 * (coincidência de substring "vendas") — Invariantes 1/2 do enunciado
 * desta missão. Roda através dos classificadores REAIS
 * (`DefaultFinancialStatementClassifier`), nunca linhas
 * pré-classificadas artificialmente (Seção 34).
 */
describe("Canonical classification — Mission 191 regressions", () => {
  test("Invariante 1: 'Despesas com Vendas' nunca é classificada como receita", async () => {
    const dre = buildRealisticDre("dre-1", "company-classification-1");
    const result = await runIngestion("company-classification-1", [dre]);

    const statementLines = (result.model?.statementLines ?? []) as readonly StatementLine[];
    const salesExpenseLine = statementLines.find((line) => line.label.includes("Despesas com Vendas"));

    assert.ok(salesExpenseLine, "linha 'Despesas com Vendas' deve existir no FinancialModel");
    assert.equal(
      salesExpenseLine?.category,
      "operating_expense",
      `'Despesas com Vendas' deve ser operating_expense, nunca receita (obtido: ${salesExpenseLine?.category})`
    );
    assert.notEqual(salesExpenseLine?.category, "gross_revenue");
    assert.notEqual(salesExpenseLine?.category, "net_revenue");
  });

  test("Invariante 2: 'Custo dos Produtos Vendidos' é CMV, nunca um ativo 'product'", async () => {
    const dre = buildRealisticDre("dre-2", "company-classification-2");
    const result = await runIngestion("company-classification-2", [dre]);

    const statementLines = (result.model?.statementLines ?? []) as readonly StatementLine[];
    const cogsLine = statementLines.find((line) => line.label.includes("Custo dos Produtos Vendidos"));

    assert.ok(cogsLine, "linha de CMV deve existir no FinancialModel");
    assert.equal(cogsLine?.category, "cost_of_goods_services");

    // Uma DRE nunca produz `Resource` — CMV/Receita/Despesas são
    // `StatementLine`, estruturalmente distintas de um saldo pontual
    // (Resource, Camada 1 da Ontologia). Nenhum "ativo produto" pode
    // nascer de uma linha de DRE.
    assert.equal(
      result.model?.resources.length ?? 0,
      0,
      "uma DRE pura nunca produz Resource algum (CMV nunca vira ativo 'product')"
    );
  });

  test("vocabulário adversarial completo classifica em categorias corretas e distintas", async () => {
    const dre = buildRealisticDre("dre-3", "company-classification-3");
    const result = await runIngestion("company-classification-3", [dre]);
    const statementLines = (result.model?.statementLines ?? []) as readonly StatementLine[];

    function categoryOf(fragment: string): string | undefined {
      return statementLines.find((line) => line.label.includes(fragment))?.category;
    }

    assert.equal(categoryOf("Receita Bruta de Vendas"), "gross_revenue");
    assert.equal(categoryOf("Impostos sobre Vendas"), "revenue_deductions");
    assert.equal(categoryOf("Receita Líquida de Vendas"), "net_revenue");
    assert.equal(categoryOf("Custo dos Produtos Vendidos"), "cost_of_goods_services");
    assert.equal(categoryOf("Despesas Administrativas"), "operating_expense");
    assert.equal(categoryOf("Receitas Financeiras"), "financial_income");
    assert.equal(categoryOf("Despesas Financeiras"), "financial_expense");
    assert.equal(categoryOf("IRPJ"), "taxes");
    assert.equal(categoryOf("CSLL"), "taxes");
    assert.notEqual(
      categoryOf("Impostos sobre Vendas"),
      categoryOf("IRPJ"),
      "impostos SOBRE VENDAS (dedução de receita) nunca é confundido com impostos SOBRE O LUCRO (taxes)"
    );
  });
});
