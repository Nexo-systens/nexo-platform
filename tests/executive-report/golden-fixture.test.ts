import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildRealisticBalance,
  buildRealisticBankStatement,
  buildRealisticDre,
} from "../financial-ingestion/fixtures";
import { buildExecutiveReport, indicatorByName, sectionOfType } from "./helpers";

/**
 * Mission 194 — Production Executive Report Truth & Presentation
 * Audit, Seção 6/23/37/38/50. Fixture Brasileira realista única —
 * DRE de Julho/2026 (`buildRealisticDre`) + Balanço 31/07/2026
 * (`buildRealisticBalance`) + extrato bancário do mesmo mês
 * (`buildRealisticBankStatement`), todas já reaproveitadas de
 * `tests/financial-ingestion/fixtures.ts` (Mission 193) — nunca uma
 * segunda fixture divergente para os mesmos conceitos, e nenhum dado
 * de cliente real. Passa pelo pipeline REAL (classificadores → D-113
 * → Data → FinancialModel → Indicators → `DefaultReportService`,
 * `helpers.ts`), nunca por um `ExecutiveReport` fabricado à mão.
 *
 * A aritmética abaixo é EXATAMENTE a já documentada pelo docblock de
 * `buildRealisticDre()`/`buildRealisticBalance()` — nenhum número
 * novo inventado por esta missão, apenas verificado contra o próprio
 * código de `indicators.calculator.ts` (`extractFinancialStatementInputs`,
 * `deriveBalanceSheetTotals`) antes de ser usado como valor esperado
 * (Seção 38: "Use exact expected values").
 */

const COMPANY_ID = "company-golden-194";

describe("Golden Fixture — empresa brasileira coerente (DRE + Balanço + Extrato compatíveis)", () => {
  test("Seção 50 — Product Acceptance: todo número material é rastreável a uma autoridade canônica do EFOS", async () => {
    const { report } = await buildExecutiveReport(COMPANY_ID, [
      buildRealisticDre("doc-dre", COMPANY_ID),
      buildRealisticBalance("doc-balance", COMPANY_ID),
      buildRealisticBankStatement("doc-bank", COMPANY_ID),
    ]);

    // --- Demonstração do Resultado: nenhuma StatementLine em Residual ---
    const incomeStatement = sectionOfType(report, "incomeStatement");
    assert.ok(incomeStatement, "seção Demonstração do Resultado ausente");
    const dreLabels = incomeStatement.incomeStatement.map((r) => r.label);
    assert.ok(dreLabels.some((l) => l.includes("Receita Bruta")));
    assert.ok(dreLabels.some((l) => l.includes("Lucro Líquido")));
    // Nenhum registro de Balanço (kind === "resource") vaza para a DRE.
    assert.ok(incomeStatement.incomeStatement.every((r) => r.kind !== "resource"));

    // --- Balanço Patrimonial: apenas recursos, nunca DRE/eventos ---
    const balanceSheet = sectionOfType(report, "balanceSheet");
    assert.ok(balanceSheet, "seção Balanço Patrimonial ausente");
    assert.ok(balanceSheet.balanceSheet.every((r) => r.kind === "resource"));
    assert.ok(balanceSheet.balanceSheet.some((r) => r.resourceType === "cash"));
    assert.ok(balanceSheet.balanceSheet.some((r) => r.resourceType === "client"));
    assert.ok(balanceSheet.balanceSheet.some((r) => r.resourceType === "supplier"));

    // --- Movimentações de Caixa: apenas eventos datados, nunca DRE/Balanço ---
    const cashFlow = sectionOfType(report, "cashFlow");
    assert.ok(cashFlow, "seção de Fluxo de Caixa ausente");
    assert.ok(cashFlow.cashFlow.every((r) => r.kind === "event"));
    assert.ok(cashFlow.cashFlow.length > 0, "extrato bancário deveria produzir eventos reais");

    // --- Indicadores: valores exatos, rastreáveis à fórmula canônica ---
    const indicatorsSection = sectionOfType(report, "indicators");
    assert.ok(indicatorsSection);
    const indicators = indicatorsSection.indicators.indicators;

    const grossMargin = indicatorByName(indicators, "Margem Bruta");
    assert.equal(grossMargin?.result.status, "available");
    // Lucro Bruto 592.000 / Receita Líquida 1.092.000 × 100.
    assert.ok(
      grossMargin!.result.status === "available" &&
        Math.abs(grossMargin.result.value - (592000 / 1092000) * 100) < 0.01
    );

    const ebit = indicatorByName(indicators, "EBIT");
    assert.equal(ebit?.result.status, "available");
    // Lucro Bruto 592.000 − Despesas Operacionais 200.000.
    assert.ok(ebit!.result.status === "available" && Math.abs(ebit.result.value - 392000) < 0.01);

    const currentLiquidity = indicatorByName(indicators, "Liquidez Corrente");
    assert.equal(currentLiquidity?.result.status, "available");
    // Ativo Circulante 950.000 (350k+420k+180k) / Passivo Circulante 210.000.
    assert.ok(
      currentLiquidity!.result.status === "available" &&
        Math.abs(currentLiquidity.result.value - 950000 / 210000) < 0.01
    );

    // ROA — DRE (Julho inteiro) e Balanço (31/07) descrevem o MESMO
    // recorte temporal (Mission 192 Closure B, D-111/D-113): indicador
    // cross-source deve estar DISPONÍVEL, nunca indisponível por
    // incompatibilidade que não existe.
    const roa = indicatorByName(indicators, "ROA");
    assert.equal(roa?.result.status, "available");
    // Lucro Líquido 242.000 / Ativo Total 950.000 × 100.
    assert.ok(
      roa!.result.status === "available" && Math.abs(roa.result.value - (242000 / 950000) * 100) < 0.01
    );
  });

  test("Seção 33 — período/data-base ficam visíveis, nunca a data de execução como se fosse o período financeiro", async () => {
    const { report } = await buildExecutiveReport(COMPANY_ID, [
      buildRealisticDre("doc-dre", COMPANY_ID),
      buildRealisticBalance("doc-balance", COMPANY_ID),
    ]);

    const incomeStatement = sectionOfType(report, "incomeStatement");
    const balanceSheet = sectionOfType(report, "balanceSheet");
    assert.ok(incomeStatement?.incomeStatement.some((r) => r.period?.startDate.startsWith("2026-07-01")));
    assert.ok(balanceSheet?.balanceSheet.some((r) => r.asOfDate?.startsWith("2026-07-31")));
  });
});
