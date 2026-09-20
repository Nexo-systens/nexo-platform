import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { RawFinancialDocument } from "@/efos/engines/data";
import type { FinancialModelAggregate, Period } from "@/efos/domain";
import { simulateOperatingCostScenario } from "@/efos/application/scenario-simulation/simulateOperatingCostScenario";

import {
  buildAugustDre,
  buildConflictingDre,
  buildDreWithoutPeriod,
  buildOperatingExpenseOnlyDre,
  buildRealisticBalance,
  buildRealisticBankStatement,
  buildRealisticDre,
} from "./fixtures";
import { runIngestion, statusOf } from "./helpers";

const JULY: Period = { startDate: "2026-07-01T00:00:00.000Z", endDate: "2026-07-31T00:00:00.000Z" };

function withCompany(document: RawFinancialDocument, companyId: string): RawFinancialDocument {
  return { ...document, companyId };
}

describe("Duplicate documents never double count", () => {
  test("Invariante 9: DRE duplicada (mesma economia) contribui uma única vez", async () => {
    const companyId = "company-dup-dre";
    const a = withCompany(buildRealisticDre("dre-dup-a", companyId, { source: "dre_a.pdf" }), companyId);
    const b = withCompany(buildRealisticDre("dre-dup-b", companyId, { source: "dre_b.pdf" }), companyId);

    const result = await runIngestion(companyId, [a, b]);
    assert.equal(result.conflicts.length, 0, "duplicata equivalente nunca vira StatementConflict");

    const statementLines = result.model?.statementLines ?? [];
    const grossRevenue = statementLines
      .filter((line) => line.category === "gross_revenue")
      .reduce((sum, line) => sum + (line.amount?.amount ?? 0), 0);
    assert.equal(grossRevenue, 1200000, `receita nunca dobra para 2.400.000 (obtido ${grossRevenue})`);
  });

  test("Invariante 12: Balancete duplicado (mesmo saldo) contribui uma única vez", async () => {
    const companyId = "company-dup-bal";
    const a = withCompany(buildRealisticBalance("bal-dup-a", companyId, { source: "bal_a.pdf" }), companyId);
    const b = withCompany(buildRealisticBalance("bal-dup-b", companyId, { source: "bal_b.pdf" }), companyId);

    const result = await runIngestion(companyId, [a, b]);
    assert.equal(result.conflicts.length, 0);

    const cash = (result.model?.resources ?? [])
      .filter((r) => r.type === "cash")
      .reduce((sum, r) => sum + (r.value?.amount ?? 0), 0);
    assert.equal(cash, 350000, `caixa nunca dobra para 700.000 (obtido ${cash})`);
  });
});

describe("Same-period/same-date conflicts fail closed — never an arbitrary winner", () => {
  async function runConflictScenario(order: readonly RawFinancialDocument[], companyId: string) {
    return runIngestion(companyId, order.map((d) => withCompany(d, companyId)));
  }

  test("Invariante 10/11: conflito de DRE do mesmo período — indisponível em AMBAS as ordens (permutation-invariant)", async () => {
    const a = buildRealisticDre("dre-conflict-a", "x", { source: "dre_a.pdf" });
    const b = buildConflictingDre("dre-conflict-b", "x", "dre_b.pdf");
    const balance = buildRealisticBalance("bal-conflict", "x");

    const forward = await runConflictScenario([a, b, balance], "company-conflict-fwd");
    const backward = await runConflictScenario([b, a, balance], "company-conflict-bwd");

    for (const [label, result] of [
      ["forward", forward],
      ["backward", backward],
    ] as const) {
      assert.equal(result.conflicts.length, 1, `${label}: exatamente 1 StatementConflict`);
      assert.equal(result.conflicts[0]?.scope, "income_statement");
      assert.equal(statusOf(result.indicators, "Margem Bruta"), "unavailable", `${label}: Margem Bruta indisponível`);
      assert.equal(
        statusOf(result.indicators, "Liquidez Imediata"),
        "available",
        `${label}: Balancete não relacionado permanece disponível`
      );
    }

    assert.equal(forward.conflicts.length, backward.conflicts.length);
    assert.deepEqual(
      [...forward.conflicts[0]!.documentIds].sort(),
      [...backward.conflicts[0]!.documentIds].sort(),
      "o conjunto de documentos em conflito é idêntico independentemente da ordem de chegada"
    );
  });

  test("Invariante 13: conflito de Balancete da mesma data-base — indisponível em ambas as ordens", async () => {
    const balanceA = buildRealisticBalance("bal-c-a", "x", { source: "bal_a.pdf", cash: "R$ 350.000,00" });
    const balanceB = buildRealisticBalance("bal-c-b", "x", { source: "bal_b.pdf", cash: "R$ 900.000,00" });
    const dre = buildRealisticDre("dre-for-balance-conflict", "x");

    const forward = await runConflictScenario([balanceA, balanceB, dre], "company-balconflict-fwd");
    const backward = await runConflictScenario([balanceB, balanceA, dre], "company-balconflict-bwd");

    for (const [label, result] of [
      ["forward", forward],
      ["backward", backward],
    ] as const) {
      assert.equal(result.conflicts.length, 1, `${label}`);
      assert.equal(result.conflicts[0]?.scope, "balance");
      assert.equal(statusOf(result.indicators, "Liquidez Imediata"), "unavailable");
      assert.equal(
        statusOf(result.indicators, "Margem Bruta"),
        "available",
        `${label}: DRE não relacionado permanece disponível`
      );
    }
  });

  test("Invariante 16: conflito nunca vira 0 — nenhum indicador indisponível carrega value", async () => {
    const a = buildRealisticDre("dre-zero-a", "x", { source: "dre_a.pdf" });
    const b = buildConflictingDre("dre-zero-b", "x", "dre_b.pdf");
    // Balancete presente apenas para fornecer cronologia genuína (sem
    // NENHUM sinal de período/data, o Indicators Engine falha fechado
    // por inteiro — Invariante 3 — o que já é, por si só, uma forma de
    // "nunca vira 0"; este teste audita especificamente que, quando os
    // Indicators DE FATO rodam, as métricas de DRE ficam indisponíveis
    // em vez de zeradas).
    const balance = buildRealisticBalance("bal-zero", "x");
    const result = await runConflictScenario([a, b, balance], "company-neverzero");

    assert.equal(result.indicatorsStatus, "completed");
    for (const key of ["Margem Bruta", "Margem Líquida", "EBITDA", "EBIT"]) {
      const indicator = result.indicators?.get(key);
      assert.equal(indicator?.result.status, "unavailable", key);
      assert.equal((indicator?.result as { value?: number }).value, undefined, key);
    }
  });
});

describe("Different periods/dates — latest survives, never summed", () => {
  test("Julho + Agosto DRE — apenas Agosto sobrevive", async () => {
    const july = buildRealisticDre("dre-jul", "x");
    const august = buildAugustDre("dre-aug", "x");
    const result = await runIngestion("company-periods", [july, august].map((d) => withCompany(d, "company-periods")));

    assert.equal(result.excluded.length, 1);
    assert.equal(result.excluded[0]?.code, "non_current_period");
    const revenue = (result.model?.statementLines ?? [])
      .filter((l) => l.category === "gross_revenue")
      .reduce((sum, l) => sum + (l.amount?.amount ?? 0), 0);
    assert.equal(revenue, 1500000, "apenas Agosto (1.500.000) sobrevive, nunca somado a Julho");
  });
});

describe("Temporal compatibility — DRE period vs. Balance as-of-date", () => {
  test("Invariante 14: DRE Julho + Balanço 31/07 — compatível, ROA disponível", async () => {
    const companyId = "company-compatible";
    const dre = withCompany(
      buildRealisticDre("dre-compat", companyId, { netIncomeOverride: "R$ 242.000,00" }),
      companyId
    );
    const balance = withCompany(buildRealisticBalance("bal-compat", companyId, { asOfDate: "31/07/2026" }), companyId);

    const result = await runIngestion(companyId, [dre, balance]);
    assert.equal(statusOf(result.indicators, "ROA"), "available", `ROA deve estar disponível (obtido ${JSON.stringify(result.indicators?.get("ROA"))})`);
  });

  test("Invariante 15: DRE Julho + Balanço 31/08 — incompatível, métricas mistas indisponíveis, dimensões únicas intactas", async () => {
    const companyId = "company-incompatible";
    const dre = withCompany(buildRealisticDre("dre-incompat", companyId), companyId);
    const balance = withCompany(buildRealisticBalance("bal-incompat", companyId, { asOfDate: "31/08/2026" }), companyId);

    const result = await runIngestion(companyId, [dre, balance]);
    assert.equal(result.indicatorsStatus, "completed", "modelo formado mesmo com períodos incompatíveis");
    assert.equal(statusOf(result.indicators, "Margem Bruta"), "available");
    assert.equal(statusOf(result.indicators, "Liquidez Corrente"), "available");
    assert.equal(
      statusOf(result.indicators, "ROA"),
      "unavailable",
      "ROA nunca combina performance de Julho com saldo de Agosto"
    );
    assert.equal(statusOf(result.indicators, "Giro do Ativo"), "unavailable");
  });
});

describe("Category-specific precedence (D-109) preserved", () => {
  test("DRE só com Despesas Operacionais + extrato com venda — opex do DRE, receita do evento", async () => {
    const companyId = "company-precedence";
    const dre = withCompany(buildOperatingExpenseOnlyDre("dre-opex-only", companyId), companyId);
    const bank = withCompany(buildRealisticBankStatement("ext-precedence", companyId), companyId);

    const result = await runIngestion(companyId, [dre, bank]);
    assert.equal(result.indicatorsStatus, "completed");
    assert.equal(
      statusOf(result.indicators, "Margem Bruta"),
      "available",
      "receita vem dos eventos do extrato (nunca ausente só porque o DRE não a declarou)"
    );
  });
});

describe("Document-level isolation — invalid DRE never poisons a valid Balance", () => {
  test("Invariante 19: DRE sem período excluído; Balancete válido alcança os Indicators normalmente", async () => {
    const companyId = "company-isolation";
    const invalidDre = withCompany(buildDreWithoutPeriod("dre-invalid", companyId), companyId);
    const balance = withCompany(buildRealisticBalance("bal-valid", companyId), companyId);

    const result = await runIngestion(companyId, [invalidDre, balance]);

    assert.equal(result.excluded.length, 1);
    assert.equal(result.excluded[0]?.code, "invalid_document");
    assert.equal(result.indicatorsStatus, "completed");
    assert.equal(statusOf(result.indicators, "Liquidez Imediata"), "available");
  });
});

describe("Company isolation — a conflict never leaks across companies", () => {
  test("empresa A em conflito nunca afeta a empresa B, mesmo processadas na mesma bateria", async () => {
    const a1 = buildRealisticDre("dre-iso-a1", "iso-a", { source: "dre_a1.pdf" });
    const a2 = buildConflictingDre("dre-iso-a2", "iso-a", "dre_a2.pdf");
    const balanceA = buildRealisticBalance("bal-iso-a", "iso-a");

    const bClean = buildRealisticDre("dre-iso-b", "iso-b");
    const balanceB = buildRealisticBalance("bal-iso-b", "iso-b");

    const [resultA, resultB] = await Promise.all([
      runIngestion("iso-a", [a1, a2, balanceA]),
      runIngestion("iso-b", [bClean, balanceB]),
    ]);

    assert.equal(resultA.conflicts.length, 1, "empresa A registra seu próprio conflito");
    assert.equal(resultB.conflicts.length, 0, "empresa B permanece livre de conflito — nenhum vazamento");
    assert.equal(statusOf(resultB.indicators, "Margem Bruta"), "available");
    assert.equal(statusOf(resultA.indicators, "Margem Bruta"), "unavailable");
  });
});

describe("Scenario boundary — never simulates from arbitrarily selected conflicted truth", () => {
  test("Invariante 20: baseline conflitado produz projeção TAMBÉM indisponível", async () => {
    const companyId = "company-scenario-conflict";
    const a = withCompany(buildRealisticDre("dre-scenario-a", companyId, { source: "dre_a.pdf" }), companyId);
    const b = withCompany(buildConflictingDre("dre-scenario-b", companyId, "dre_b.pdf"), companyId);
    const balance = withCompany(buildRealisticBalance("bal-scenario", companyId), companyId);

    const result = await runIngestion(companyId, [a, b, balance]);
    const model = result.model as FinancialModelAggregate;
    assert.ok(model.statementConflicts && model.statementConflicts.length > 0, "baseline real carrega o conflito");

    const outcome = simulateOperatingCostScenario(companyId, model, JULY, {
      kind: "operating_cost_change",
      scenarioType: "adjust_operating_costs",
      // Delta POSITIVO deliberadamente — o baseline de Despesas
      // Operacionais é 0 aqui (conflito exclui toda a DRE), então uma
      // REDUÇÃO tornaria a validação estrutural (nunca negativo)
      // rejeitar por um motivo diferente do que este teste audita.
      operatingExpensesDelta: { amount: 1000, currency: "BRL" },
    });

    assert.equal(outcome.outcome, "simulated");
    if (outcome.outcome === "simulated") {
      assert.equal(outcome.projection.baseline.indicators.ebitda.result.status, "unavailable");
      assert.equal(outcome.projection.projected.indicators.ebitda.result.status, "unavailable");
      assert.equal(outcome.projection.projected.indicators.netMargin.result.status, "unavailable");
    }
  });

  test("baseline válido simula normalmente (regressão)", async () => {
    const companyId = "company-scenario-valid";
    const dre = withCompany(
      buildRealisticDre("dre-scenario-valid", companyId, { source: "dre.pdf" }),
      companyId
    );
    const balance = withCompany(buildRealisticBalance("bal-scenario-valid", companyId), companyId);

    const result = await runIngestion(companyId, [dre, balance]);
    const model = result.model as FinancialModelAggregate;

    const outcome = simulateOperatingCostScenario(companyId, model, JULY, {
      kind: "operating_cost_change",
      scenarioType: "adjust_operating_costs",
      operatingExpensesDelta: { amount: -1000, currency: "BRL" },
    });

    assert.equal(outcome.outcome, "simulated");
    if (outcome.outcome === "simulated") {
      assert.equal(outcome.projection.baseline.indicators.ebitda.result.status, "available");
    }
  });
});
