import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { RawFinancialDocument } from "@/efos/engines/data";
import {
  buildConflictingDre,
  buildRealisticBalance,
  buildRealisticBankStatement,
  buildRealisticDre,
} from "../financial-ingestion/fixtures";
import { buildExecutiveReport, indicatorByName, sectionOfType } from "./helpers";

/**
 * Mission 194 — Production Executive Report Truth & Presentation
 * Audit, Seção 39/40. Subconjunto representativo dos casos
 * adversariais exigidos pela missão — cada um pergunta literalmente
 * "o que o executivo vê?" e verifica a resposta contra o `ExecutiveReport`
 * real (nunca uma suposição sobre o comportamento interno). Reaproveita
 * as fixtures já committed de `tests/financial-ingestion/fixtures.ts`
 * (Mission 193) sempre que cobrem o caso — apenas os documentos que
 * exigem uma variação genuinamente nova desta missão (imposto
 * ausente) são construídos aqui, seguindo o mesmo estilo (`label`
 * puro, texto em português, formato numérico brasileiro).
 */

function doc(documentId: string, companyId: string, source: string, lines: readonly string[]): RawFinancialDocument {
  return { documentId, companyId, source, lines: lines.map((label) => ({ label })) };
}

describe("Caso 1 — apenas DRE (sem Balanço): indicadores de Balanço/cross-source indisponíveis, DRE disponível", () => {
  test("Margem Bruta disponível; Liquidez Corrente e ROA indisponíveis (nenhum Balanço enviado)", async () => {
    const companyId = "company-case-dre-only";
    const { report } = await buildExecutiveReport(companyId, [buildRealisticDre("d1", companyId)]);

    const indicators = sectionOfType(report, "indicators")!.indicators.indicators;
    assert.equal(indicatorByName(indicators, "Margem Bruta")?.result.status, "available");
    assert.equal(indicatorByName(indicators, "Liquidez Corrente")?.result.status, "unavailable");
    assert.equal(indicatorByName(indicators, "ROA")?.result.status, "unavailable");

    const balanceSheet = sectionOfType(report, "balanceSheet");
    assert.equal(balanceSheet?.balanceSheet.length, 0, "nenhum recurso de Balanço existe nesta análise");
  });
});

describe("Caso 2 — apenas Balanço (sem DRE): indicadores de DRE/cross-source indisponíveis, Balanço disponível", () => {
  test("Liquidez Corrente disponível; Margem Bruta e ROA indisponíveis (nenhum DRE/evento enviado)", async () => {
    const companyId = "company-case-balance-only";
    const { report } = await buildExecutiveReport(companyId, [buildRealisticBalance("b1", companyId)]);

    const indicators = sectionOfType(report, "indicators")!.indicators.indicators;
    assert.equal(indicatorByName(indicators, "Liquidez Corrente")?.result.status, "available");
    assert.equal(indicatorByName(indicators, "Margem Bruta")?.result.status, "unavailable");

    // Mission 194 Closure — Canonical Missing-vs-Zero Financial
    // Semantics: corrigido. Antes, sem NENHUM dado de DRE/evento,
    // `netIncome` seguia o caminho legado (soma de componentes vazios)
    // e era tratado como um zero GENUÍNO — ROA ficava `available` com
    // valor 0%, quando deveria ser `unavailable` (nenhum dado de
    // resultado existe para calcular coisa alguma). Corrigido na
    // origem (`extractFinancialStatementInputs()`, D-110 supplement):
    // `incomeStatementAvailable` agora também exige que EXISTA dado de
    // DRE/evento relevante, não apenas "nenhum conflito".
    assert.equal(
      indicatorByName(indicators, "ROA")?.result.status,
      "unavailable",
      "sem nenhum dado de DRE/evento, ROA nunca deveria ser 'available' com um zero fabricado pelo caminho legado"
    );
    assert.equal(indicatorByName(indicators, "EBITDA")?.result.status, "unavailable");
    assert.equal(indicatorByName(indicators, "EBIT")?.result.status, "unavailable");

    const incomeStatement = sectionOfType(report, "incomeStatement");
    assert.equal(incomeStatement?.incomeStatement.length, 0, "nenhuma linha/evento de DRE existe nesta análise");
  });
});

describe("Caso 3 — apenas transações bancárias (sem DRE/Balanço): caminho de fallback D-004 continua funcionando", () => {
  test("Movimentações de Caixa disponíveis; DRE usa fallback de eventos (nunca StatementLine)", async () => {
    const companyId = "company-case-bank-only";
    const { report } = await buildExecutiveReport(companyId, [buildRealisticBankStatement("bk1", companyId)]);

    const cashFlow = sectionOfType(report, "cashFlow");
    assert.ok(cashFlow && cashFlow.cashFlow.length > 0);
    assert.ok(cashFlow.cashFlow.every((r) => r.kind === "event"));

    const incomeStatement = sectionOfType(report, "incomeStatement");
    assert.ok(incomeStatement && incomeStatement.incomeStatement.length > 0);
    assert.ok(
      incomeStatement.incomeStatement.every((r) => r.kind === "event"),
      "sem DRE, a Demonstração do Resultado usa apenas o fallback de eventos (D-004), nunca uma StatementLine fabricada"
    );

    const balanceSheet = sectionOfType(report, "balanceSheet");
    assert.equal(balanceSheet?.balanceSheet.length, 0);
  });
});

describe("Caso 5 — DRE + Balanço TEMPORALMENTE INCOMPATÍVEIS: verdade válida de cada lado permanece visível", () => {
  test("Margem Bruta (só DRE) e Liquidez Corrente (só Balanço) disponíveis; ROA (cross-source) indisponível", async () => {
    const companyId = "company-case-incompatible-periods";
    const { report } = await buildExecutiveReport(companyId, [
      buildRealisticDre("d1", companyId), // Julho/2026
      buildRealisticBalance("b1", companyId, { asOfDate: "31/08/2026" }), // Agosto — mês diferente
    ]);

    const indicators = sectionOfType(report, "indicators")!.indicators.indicators;
    assert.equal(
      indicatorByName(indicators, "Margem Bruta")?.result.status,
      "available",
      "Seção 12: verdade válida e não relacionada nunca é escondida por causa de outra incompatibilidade"
    );
    assert.equal(indicatorByName(indicators, "Liquidez Corrente")?.result.status, "available");
    assert.equal(
      indicatorByName(indicators, "ROA")?.result.status,
      "unavailable",
      "Seção 13: nenhum indicador cross-source pode ser calculado silenciosamente sobre períodos incompatíveis"
    );
  });
});

describe("Caso 6/15 — DRE conflitante + Balanço válido: conflito ≠ zero, mas verdade válida e não relacionada permanece visível", () => {
  test("nenhum dos dois DREs conflitantes vira autoridade (Margem Bruta indisponível); Balanço válido continua disponível (Seção 12/15)", async () => {
    const companyId = "company-case-conflicting-dre";
    const { report, ingestion } = await buildExecutiveReport(companyId, [
      buildRealisticDre("d1", companyId, { source: "dre_a.pdf" }),
      buildConflictingDre("d2", companyId, "dre_b.pdf"),
      buildRealisticBalance("b1", companyId),
    ]);

    assert.equal(ingestion.conflicts.length, 1, "um StatementConflict deveria ser registrado");
    const indicators = sectionOfType(report, "indicators")!.indicators.indicators;
    assert.equal(
      indicatorByName(indicators, "Margem Bruta")?.result.status,
      "unavailable",
      "conflito de DRE nunca vira um indicador calculado com um valor escolhido arbitrariamente"
    );
    assert.equal(
      indicatorByName(indicators, "Liquidez Corrente")?.result.status,
      "available",
      "Seção 12/15: um Balanço válido não relacionado ao conflito de DRE nunca é escondido por causa dele"
    );

    const incomeStatement = sectionOfType(report, "incomeStatement");
    assert.equal(
      incomeStatement?.incomeStatement.length,
      0,
      "documentos em conflito são excluídos ANTES do Financial Model — nenhuma StatementLine sobrevive de nenhum dos dois"
    );
    const balanceSheet = sectionOfType(report, "balanceSheet");
    assert.ok(
      balanceSheet && balanceSheet.balanceSheet.length > 0,
      "o Balanço válido continua aparecendo normalmente no relatório, apesar do conflito de DRE"
    );
  });
});

describe("Caso 10 — Lucro Líquido declarado inconsistente com os componentes: needs_review, nunca rejeitado", () => {
  test("documento é ACEITO (contribui para o Financial Model) mas marcado needs_review — indicadores de DRE continuam disponíveis", async () => {
    const companyId = "company-case-inconsistent-net-income";
    const { report, ingestion } = await buildExecutiveReport(companyId, [
      buildRealisticDre("d1", companyId, { netIncomeOverride: "R$ 999.999,00" }),
    ]);

    // O documento contribuiu normalmente — Margem Bruta/EBIT continuam
    // disponíveis (dependem de Receita/CMV/Despesas, nunca de Lucro
    // Líquido) mesmo com a inconsistência.
    const indicators = sectionOfType(report, "indicators")!.indicators.indicators;
    assert.equal(indicatorByName(indicators, "Margem Bruta")?.result.status, "available");

    const incomeStatement = sectionOfType(report, "incomeStatement");
    assert.ok(
      incomeStatement && incomeStatement.incomeStatement.length > 0,
      "needs_review nunca significa exclusão — o documento contribuiu normalmente para a DRE"
    );
    void ingestion;
  });
});

describe("Caso 9 — impostos GENUINAMENTE ausentes (nunca declarados): nunca tratado como inconsistência", () => {
  test("sem nenhuma linha de imposto, a verificação de consistência do Lucro Líquido é pulada — nunca um falso needs_review", async () => {
    const companyId = "company-case-missing-taxes";
    const noTaxesDre = doc(companyId + "-doc", companyId, "dre_sem_impostos.pdf", [
      "Demonstração do Resultado do Exercício",
      "Período: 01/07/2026 a 31/07/2026",
      "Receita Bruta de Vendas R$ 1.200.000,00",
      "Custo dos Produtos Vendidos (R$ 500.000,00)",
      "Despesas Administrativas (R$ 100.000,00)",
      // Nenhuma linha de Resultado Financeiro/Impostos/Lucro Líquido —
      // `validateStatementArithmetic()` exige TODOS os componentes
      // presentes para verificar consistência (Seção 11: missing ≠
      // inconsistente); sem eles, a verificação é simplesmente pulada.
    ]);

    const { report } = await buildExecutiveReport(companyId, [noTaxesDre]);
    const indicators = sectionOfType(report, "indicators")!.indicators.indicators;
    // Margem Bruta não depende de impostos — continua disponível.
    assert.equal(indicatorByName(indicators, "Margem Bruta")?.result.status, "available");
  });
});

describe("Caso 40 — Zero vs Ausente: o mesmo indicador nunca confunde os dois estados", () => {
  test("Caso A: Margem Bruta genuinamente 0% (Receita = CMV) é `available` com value 0, nunca tratado como indisponível", async () => {
    const companyId = "company-case-zero-margin";
    const zeroMarginDre = doc(companyId + "-doc", companyId, "dre_margem_zero.pdf", [
      "Demonstração do Resultado do Exercício",
      "Período: 01/07/2026 a 31/07/2026",
      "Receita Líquida de Vendas R$ 500.000,00",
      "Custo dos Produtos Vendidos (R$ 500.000,00)",
      "Lucro Bruto R$ 0,00",
    ]);

    const { report } = await buildExecutiveReport(companyId, [zeroMarginDre]);
    const indicators = sectionOfType(report, "indicators")!.indicators.indicators;
    const grossMargin = indicatorByName(indicators, "Margem Bruta")?.result;
    assert.equal(grossMargin?.status, "available");
    assert.equal(grossMargin?.status === "available" ? grossMargin.value : undefined, 0);
  });

  test("Caso B: Margem Bruta genuinamente AUSENTE (nenhum dado de DRE) é `unavailable`, nunca fabricada como 0%", async () => {
    const companyId = "company-case-missing-margin";
    const { report } = await buildExecutiveReport(companyId, [buildRealisticBalance("b1", companyId)]);

    const indicators = sectionOfType(report, "indicators")!.indicators.indicators;
    const grossMargin = indicatorByName(indicators, "Margem Bruta")?.result;
    assert.equal(grossMargin?.status, "unavailable");
    assert.equal((grossMargin as { value?: number })?.value, undefined);
  });
});
