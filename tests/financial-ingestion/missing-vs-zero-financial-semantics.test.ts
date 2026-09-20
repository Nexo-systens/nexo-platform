import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { RawFinancialDocument, RawFinancialLine } from "@/efos/engines/data";
import type { FinancialModelAggregate, Period } from "@/efos/domain";
import { simulateOperatingCostScenario } from "@/efos/application/scenario-simulation/simulateOperatingCostScenario";

import {
  buildConflictingDre,
  buildRealisticBalance,
  buildRealisticDre,
} from "./fixtures";
import { availableValue, runIngestion, statusOf } from "./helpers";

/**
 * Mission 194 Closure — Canonical Missing-vs-Zero Financial Semantics.
 *
 * Reproduziu e corrigiu o defeito descoberto durante a Mission 194: sem
 * NENHUM dado de DRE/evento (ex.: apenas um Balancete enviado),
 * `extractFinancialStatementInputs()` (`efos/engines/indicators/
 * indicators.calculator.ts`) caía no branch "legado" de D-110
 * (pensado para o caminho puramente transacional real, extrato
 * bancário sem DRE) mesmo quando NENHUM evento de receita/custo/
 * despesa/juros existia — somando um array vazio, obtendo `0`, e
 * tratando esse `0` como um resultado GENUÍNO e disponível. `ROA`/
 * `ROE`/`EBITDA`/`EBIT`/`Margem Operacional` ficavam `available` com
 * valor `0` quando deveriam ser `unavailable` (nenhum dado de
 * resultado existe para calcular coisa alguma).
 *
 * Corrigido na ORIGEM (nunca em ROA especificamente, nunca em React):
 * `incomeStatementAvailable`/`balanceAvailable` — os dois gates já
 * estabelecidos por D-113 (Mission 192 Closure B) — passam a exigir
 * também que EXISTA dado da respectiva dimensão (`hasIncomeStatementData`/
 * `hasBalanceData`), não apenas "nenhum conflito". Como TODA a cascata
 * de indicadores (`netIncomeAvailable`, `ebitda`, `ebit`, `workingCapital`,
 * `roa`, `roe`, `roi`, `netMargin`, ...) já lia esses dois gates, a
 * correção se propaga inteira sem tocar nenhum indicador individual —
 * exatamente como a missão de fechamento exigiu ("Do NOT patch ROA or
 * React. Correct the earliest canonical authority").
 *
 * Reaproveita `runIngestion()`/fixtures já committed — nenhuma segunda
 * implementação de pipeline, nenhuma fixture duplicada das já
 * existentes em `tests/financial-ingestion/fixtures.ts` (Mission 193).
 */

const JULY: Period = { startDate: "2026-07-01T00:00:00.000Z", endDate: "2026-07-31T00:00:00.000Z" };

function line(label: string): RawFinancialLine {
  return { label };
}

function doc(documentId: string, companyId: string, source: string, lines: readonly string[]): RawFinancialDocument {
  return { documentId, companyId, source, lines: lines.map(line) };
}

/**
 * DRE genuinamente CONSISTENTE cujo Lucro Líquido é EXATAMENTE zero
 * (Receita Líquida = CMV, sem despesas/resultado financeiro/impostos) —
 * todos os componentes exigidos por `validateStatementArithmetic()`
 * declarados (inclusive como zero), garantindo o branch "derivado dos
 * componentes declarados" de D-110 (nunca o branch legado).
 */
function buildZeroProfitDre(documentId: string, companyId: string): RawFinancialDocument {
  return doc(documentId, companyId, "dre_lucro_zero.pdf", [
    "Demonstração do Resultado do Exercício",
    "Período: 01/07/2026 a 31/07/2026",
    "Receita Líquida de Vendas R$ 500.000,00",
    "Custo dos Produtos Vendidos (R$ 500.000,00)",
    "Resultado Financeiro R$ 0,00",
    "IRPJ (R$ 0,00)",
    "Lucro Líquido do Exercício R$ 0,00",
  ]);
}

describe("Item 1/2 — Balanço sozinho: netIncome/ROA nunca fabricam um zero a partir da ausência total de dado de DRE", () => {
  test("nenhum dado de DRE/evento: netIncome/ROA/ROE/EBITDA/EBIT/Margem Operacional ficam unavailable, nunca 0", async () => {
    const companyId = "company-mvz-balance-only";
    const result = await runIngestion(companyId, [buildRealisticBalance("bal-1", companyId)]);

    assert.equal(result.indicatorsStatus, "completed");
    for (const name of ["ROA", "ROE", "EBITDA", "EBIT", "Margem Operacional", "Margem Líquida"]) {
      const indicator = result.indicators?.get(name);
      assert.equal(indicator?.result.status, "unavailable", name);
      assert.equal((indicator?.result as { value?: number })?.value, undefined, `${name} nunca carrega value`);
    }
    // Balanço genuinamente enviado continua disponível — a correção
    // nunca torna "ausência de DRE" em "ausência de tudo".
    assert.equal(statusOf(result.indicators, "Liquidez Corrente"), "available");
  });
});

describe("Item 3/4 — DRE com Lucro Líquido genuinamente ZERO permanece disponível (zero ≠ ausência)", () => {
  test("Receita Líquida = CMV, componentes todos declarados (inclusive como zero): ROA/ROE disponíveis com valor 0%", async () => {
    const companyId = "company-mvz-zero-profit";
    const result = await runIngestion(companyId, [
      buildZeroProfitDre("dre-zero-1", companyId),
      buildRealisticBalance("bal-zero-1", companyId),
    ]);

    assert.equal(result.indicatorsStatus, "completed");
    const netIncome = availableValue(result.indicators, "Margem Líquida");
    assert.equal(netIncome, 0, "Margem Líquida deve ser 0% (Lucro Líquido genuinamente zero), nunca indisponível");

    const roa = result.indicators?.get("ROA")?.result;
    assert.equal(roa?.status, "available", "ROA deve ficar disponível — Lucro Líquido=0 é um fato conhecido, não uma ausência");
    assert.equal(roa?.status === "available" ? roa.value : undefined, 0);

    const roe = result.indicators?.get("ROE")?.result;
    assert.equal(roe?.status, "available");
    assert.equal(roe?.status === "available" ? roe.value : undefined, 0);
  });
});

describe("Item 6/7 — Margem Líquida: ausência de receita nunca vira 0%; Lucro Líquido zero com receita conhecida produz 0% genuíno", () => {
  test("Balanço sozinho: Margem Líquida indisponível (nenhuma receita conhecida)", async () => {
    const companyId = "company-mvz-netmargin-missing";
    const result = await runIngestion(companyId, [buildRealisticBalance("bal-nm-1", companyId)]);
    assert.equal(statusOf(result.indicators, "Margem Líquida"), "unavailable");
  });

  test("Lucro Líquido zero + Receita Líquida 500.000 conhecida: Margem Líquida = 0%, disponível", async () => {
    const companyId = "company-mvz-netmargin-zero";
    const result = await runIngestion(companyId, [buildZeroProfitDre("dre-nm-1", companyId)]);
    assert.equal(availableValue(result.indicators, "Margem Líquida"), 0);
  });
});

describe("Item 8 — DRE sozinho: todo indicador dependente de Balanço fica unavailable, nunca 0 (Capital de Giro incluso)", () => {
  test("Liquidez Corrente/Seca/Imediata/Capital de Giro indisponíveis sem nenhum Balancete", async () => {
    const companyId = "company-mvz-dre-only";
    const result = await runIngestion(companyId, [buildRealisticDre("dre-8", companyId)]);

    assert.equal(result.indicatorsStatus, "completed");
    for (const name of ["Liquidez Corrente", "Liquidez Seca", "Liquidez Imediata", "Capital de Giro"]) {
      assert.equal(statusOf(result.indicators, name), "unavailable", name);
    }
    // DRE genuinamente enviado continua disponível.
    assert.equal(statusOf(result.indicators, "Margem Bruta"), "available");
  });
});

describe("Item 9 — Balanço sozinho: Margem Operacional/EBITDA/EBIT indisponíveis (os únicos indicadores de resultado sem proteção de divisão por zero)", () => {
  test("EBITDA/EBIT/Margem Operacional nunca ficam available=0 só por ausência total de dado de DRE", async () => {
    const companyId = "company-mvz-ebitda-missing";
    const result = await runIngestion(companyId, [buildRealisticBalance("bal-9", companyId)]);

    for (const name of ["EBITDA", "EBIT", "Margem Operacional"]) {
      assert.equal(statusOf(result.indicators, name), "unavailable", name);
    }
  });
});

describe("Item 10 — despesa com juros ausente nunca cria Cobertura de Juros autoritativa (nunca infinito)", () => {
  test("sem nenhum evento interest_expense, Cobertura de Juros permanece unavailable, nunca Infinity", async () => {
    const companyId = "company-mvz-interest";
    const result = await runIngestion(companyId, [buildRealisticDre("dre-interest", companyId)]);

    const coverage = result.indicators?.get("Cobertura de Juros")?.result;
    assert.equal(coverage?.status, "unavailable");
    assert.notEqual((coverage as { value?: number })?.value, Infinity);
  });
});

describe("Item 11 — incompatibilidade temporal permanece unavailable mesmo após a correção de ausência", () => {
  test("DRE Julho + Balanço Agosto: ROA/Giro do Ativo indisponíveis; dimensões únicas continuam disponíveis", async () => {
    const companyId = "company-mvz-incompatible";
    const dre = buildRealisticDre("dre-incompat-mvz", companyId);
    const balance = buildRealisticBalance("bal-incompat-mvz", companyId, { asOfDate: "31/08/2026" });

    const result = await runIngestion(companyId, [dre, balance]);
    assert.equal(statusOf(result.indicators, "ROA"), "unavailable");
    assert.equal(statusOf(result.indicators, "Giro do Ativo"), "unavailable");
    assert.equal(statusOf(result.indicators, "Margem Bruta"), "available");
    assert.equal(statusOf(result.indicators, "Liquidez Corrente"), "available");
  });
});

describe("Item 12 — conflito material permanece unavailable mesmo após a correção de ausência", () => {
  test("DRE conflitante: Margem Bruta/EBITDA/EBIT indisponíveis, nunca um vencedor arbitrário", async () => {
    const companyId = "company-mvz-conflict";
    const a = buildRealisticDre("dre-conflict-mvz-a", companyId, { source: "dre_a.pdf" });
    const b = buildConflictingDre("dre-conflict-mvz-b", companyId, "dre_b.pdf");
    const balance = buildRealisticBalance("bal-conflict-mvz", companyId);

    const result = await runIngestion(companyId, [a, b, balance]);
    assert.equal(result.conflicts.length, 1);
    for (const name of ["Margem Bruta", "EBITDA", "EBIT"]) {
      assert.equal(statusOf(result.indicators, name), "unavailable", name);
    }
    // Balanço não relacionado ao conflito de DRE permanece disponível.
    assert.equal(statusOf(result.indicators, "Liquidez Corrente"), "available");
  });
});

describe("Item 13/14 — zero declarado explicitamente permanece zero (nunca reinterpretado como ausência)", () => {
  test("Caixa declarado como R$ 0,00 junto de outros saldos reais: Liquidez Imediata = 0, disponível", async () => {
    const companyId = "company-mvz-zero-cash";
    const result = await runIngestion(companyId, [
      buildRealisticBalance("bal-zero-cash", companyId, { cash: "R$ 0,00" }),
    ]);

    const immediateLiquidity = result.indicators?.get("Liquidez Imediata")?.result;
    assert.equal(immediateLiquidity?.status, "available", "Balanço real existe (Clientes/Estoques/Fornecedores/Empréstimos) — Caixa=0 é um fato declarado, não ausência");
    assert.equal(immediateLiquidity?.status === "available" ? immediateLiquidity.value : undefined, 0);
  });

  test("Estoque declarado como R$ 0,00 junto de outros saldos reais: Liquidez Seca = Liquidez Corrente (estoque não subtrai nada)", async () => {
    const companyId = "company-mvz-zero-inventory";
    const zeroInventoryBalance = doc(companyId + "-doc", companyId, "balanco_estoque_zero.pdf", [
      "Balanço Patrimonial",
      "Data-base: 31/07/2026",
      "Caixa e Equivalentes de Caixa R$ 350.000,00",
      "Clientes R$ 420.000,00",
      "Estoques R$ 0,00",
      "Fornecedores R$ 210.000,00",
    ]);

    const result = await runIngestion(companyId, [zeroInventoryBalance]);
    const currentLiquidity = availableValue(result.indicators, "Liquidez Corrente");
    const quickLiquidity = availableValue(result.indicators, "Liquidez Seca");
    assert.ok(currentLiquidity !== undefined && quickLiquidity !== undefined);
    assert.ok(
      Math.abs((currentLiquidity as number) - (quickLiquidity as number)) < 0.0001,
      "com estoque genuinamente zero, Liquidez Corrente e Liquidez Seca devem coincidir (nada a subtrair)"
    );
  });
});

describe("Item 15 — Scenario Engine nunca converte um baseline ausente em uma projeção autoritativa", () => {
  test("baseline sem nenhum dado de DRE (Balanço sozinho): projeção de custo operacional preserva unavailable, nunca fabrica um número", async () => {
    const companyId = "company-mvz-scenario-missing";
    const result = await runIngestion(companyId, [buildRealisticBalance("bal-scenario-mvz", companyId)]);
    const model = result.model as FinancialModelAggregate;

    const outcome = simulateOperatingCostScenario(companyId, model, JULY, {
      kind: "operating_cost_change",
      scenarioType: "adjust_operating_costs",
      operatingExpensesDelta: { amount: 1000, currency: "BRL" },
    });

    assert.equal(outcome.outcome, "simulated");
    if (outcome.outcome === "simulated") {
      assert.equal(outcome.projection.baseline.indicators.ebitda.result.status, "unavailable");
      assert.equal(outcome.projection.projected.indicators.ebitda.result.status, "unavailable");
      assert.equal(outcome.projection.projected.indicators.netMargin.result.status, "unavailable");
    }
  });
});

describe("Item 17 — disponibilidade sobrevive a serialização JSON (round-trip)", () => {
  test("IndicatorResult unavailable nunca ganha um value após JSON.stringify/parse", async () => {
    const companyId = "company-mvz-json";
    const result = await runIngestion(companyId, [buildRealisticBalance("bal-json", companyId)]);

    const roa = result.indicators?.get("ROA")?.result;
    assert.equal(roa?.status, "unavailable");

    const roundTripped = JSON.parse(JSON.stringify(roa));
    assert.equal(roundTripped.status, "unavailable");
    assert.equal("value" in roundTripped, false, "unavailable nunca serializa um campo value, nem mesmo undefined");
  });
});
