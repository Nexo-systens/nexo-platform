import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { RawFinancialDocument, RawFinancialLine } from "@/efos/engines/data";
import type { StatementLine } from "@/efos/domain";
import { validateStatementArithmetic } from "@/efos/engines/indicators";

import { buildRealisticBalance, buildRealisticBankStatement, buildRealisticDre } from "./fixtures";
import { availableValue, runIngestion, statusOf } from "./helpers";

function line(label: string): RawFinancialLine {
  return { label };
}

describe("Chronology — never the runtime clock", () => {
  test("Invariante 3: período do Indicator vem do período do DRE, nunca de new Date()", async () => {
    const dre = buildRealisticDre("dre-chrono-1", "company-chrono-1");
    const result = await runIngestion("company-chrono-1", [dre]);

    assert.equal(result.indicatorsStatus, "completed");
    const grossMargin = result.indicators?.get("Margem Bruta");
    assert.ok(grossMargin, "Margem Bruta deve existir");
    assert.equal(grossMargin?.period.startDate.slice(0, 10), "2026-07-01");
    assert.equal(grossMargin?.period.endDate.slice(0, 10), "2026-07-31");

    const today = new Date().toISOString().slice(0, 10);
    assert.notEqual(
      grossMargin?.period.startDate.slice(0, 10),
      today,
      "o período nunca coincide com a data de execução do teste"
    );
  });

  test("Invariante 4: Balancete sozinho alcança os Indicators com a data-base real, nunca new Date()", async () => {
    const balance = buildRealisticBalance("bal-chrono-1", "company-chrono-2");
    const result = await runIngestion("company-chrono-2", [balance]);

    assert.equal(result.indicatorsStatus, "completed");
    const liquidity = result.indicators?.get("Liquidez Imediata");
    assert.equal(statusOf(result.indicators, "Liquidez Imediata"), "available");
    assert.equal(liquidity?.period.startDate.slice(0, 10), "2026-07-31");
    assert.equal(liquidity?.period.endDate.slice(0, 10), "2026-07-31");
  });
});

describe("Missing vs. zero — Mission 192 Closure, D-110", () => {
  test("Invariante 5: DRE genuinamente incompleto nunca vira Lucro Líquido = 0", async () => {
    const incompleteDre: RawFinancialDocument = {
      documentId: "dre-incomplete",
      companyId: "company-missing-1",
      source: "dre_incompleto.pdf",
      lines: [
        line("Demonstração do Resultado do Exercício"),
        line("Período: 01/07/2026 a 31/07/2026"),
        line("Receita Bruta de Vendas R$ 500.000,00"),
        line("Custo dos Produtos Vendidos (R$ 200.000,00)"),
      ],
    };

    const result = await runIngestion("company-missing-1", [incompleteDre]);
    assert.equal(result.indicatorsStatus, "completed");

    const netMargin = result.indicators?.get("Margem Líquida");
    assert.equal(netMargin?.result.status, "unavailable");
    assert.equal(
      (netMargin?.result as { value?: number }).value,
      undefined,
      "indisponível nunca carrega um 'value' — nunca 0 como substituto de ausência"
    );
  });
});

describe("Statement economics — netting, taxes, reconciliation", () => {
  test("Invariante 6: resultado financeiro é NETADO (receitas − despesas), nunca somado", async () => {
    const dre = buildRealisticDre("dre-net-1", "company-economics-1");
    const result = await runIngestion("company-economics-1", [dre]);
    const statementLines = (result.model?.statementLines ?? []) as readonly StatementLine[];

    const financialIncome = statementLines.find((l) => l.category === "financial_income");
    const financialExpense = statementLines.find((l) => l.category === "financial_expense");
    assert.equal(financialIncome?.amount?.amount, 15000);
    assert.equal(financialExpense?.amount?.amount, -95000);

    // Margem Líquida = Lucro Líquido / Receita × 100 = 242.000/1.092.000×100 ≈ 22,16%.
    // Se o resultado financeiro fosse somado (15.000+95.000=110.000 de
    // despesa) em vez de netado (−80.000), o Lucro Líquido cairia para
    // 392.000−110.000−70.000=212.000 — um valor MENOR e DIFERENTE do
    // que a prova abaixo exige.
    const netMarginValue = availableValue(result.indicators, "Margem Líquida");
    assert.ok(netMarginValue !== undefined, "Margem Líquida deve estar disponível");
    assert.ok(
      Math.abs((netMarginValue as number) - (242000 / 1092000) * 100) < 0.01,
      `Margem Líquida deve refletir netting correto (obtido ${netMarginValue})`
    );
  });

  test("Invariante 7: impostos sobre o lucro (IRPJ+CSLL) contados exatamente uma vez", async () => {
    const dre = buildRealisticDre("dre-tax-1", "company-economics-2");
    const result = await runIngestion("company-economics-2", [dre]);
    const statementLines = (result.model?.statementLines ?? []) as readonly StatementLine[];

    const taxLines = statementLines.filter((l) => l.category === "taxes");
    assert.equal(taxLines.length, 2, "IRPJ e CSLL são duas linhas distintas, ambas categoria taxes");
    const totalTaxes = taxLines.reduce((sum, l) => sum + Math.abs(l.amount?.amount ?? 0), 0);
    assert.equal(totalTaxes, 70000, "IRPJ 45.000 + CSLL 25.000 = 70.000, nunca duplicado nem zerado");
  });

  test("Invariante 8: Lucro Líquido declarado bate com a reconciliação aritmética (DRE consistente)", async () => {
    const dre = buildRealisticDre("dre-recon-1", "company-economics-3");
    const result = await runIngestion("company-economics-3", [dre]);
    const statementLines = (result.model?.statementLines ?? []) as readonly StatementLine[];

    const issues = validateStatementArithmetic(statementLines);
    assert.deepEqual(issues, [], `DRE consistente não deve gerar nenhuma divergência (obtido ${JSON.stringify(issues)})`);

    const netMargin = result.indicators?.get("Margem Líquida");
    assert.equal(netMargin?.result.status, "available");
  });

  test("Invariante 8b: Lucro Líquido declarado divergente É reportado (nunca silenciosamente aceito)", async () => {
    const brokenDre = buildRealisticDre("dre-recon-broken", "company-economics-4", {
      netIncomeOverride: "R$ 999.000,00",
    });
    const result = await runIngestion("company-economics-4", [brokenDre]);
    const statementLines = (result.model?.statementLines ?? []) as readonly StatementLine[];

    const issues = validateStatementArithmetic(statementLines);
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.rule, "net-income-consistency");
    assert.equal(issues[0]?.declared, 999000);
  });
});

describe("Bank events remain events — never fabricated chronology", () => {
  test("Invariante 17/18: extrato bancário produz FinancialEvent, nunca StatementLine, nunca occurredAt fabricado", async () => {
    const bankStatement = buildRealisticBankStatement("ext-1", "company-events-1");
    const result = await runIngestion("company-events-1", [bankStatement]);

    assert.ok(result.model, "FinancialModel deve ser formado");
    assert.equal(result.model?.events.length, 3, "as 3 transações do extrato viram FinancialEvent");
    assert.equal(
      result.model?.statementLines?.length ?? 0,
      0,
      "um extrato bancário nunca produz StatementLine"
    );

    for (const event of result.model?.events ?? []) {
      assert.ok(event.occurredAt, "todo FinancialEvent tem occurredAt genuíno, do próprio texto");
      assert.notEqual(event.occurredAt, undefined);
    }

    for (const statementLine of (result.model?.statementLines ?? []) as readonly StatementLine[]) {
      assert.ok(
        !("occurredAt" in statementLine),
        "nenhuma StatementLine jamais carrega occurredAt — período é sempre um intervalo, nunca uma data pontual fabricada"
      );
    }
  });
});
