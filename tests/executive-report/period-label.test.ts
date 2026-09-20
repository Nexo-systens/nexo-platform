import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { NormalizedFinancialRecord } from "@/efos/engines/data";
import { derivePeriodLabel } from "@/modules/analysis/lib/report-view";

/**
 * Mission 194 — Production Executive Report Truth & Presentation
 * Audit, Seção 33. `period.startDate`/`asOfDate` são sempre ISO
 * COMPLETO (`Date.prototype.toISOString()`, "AAAA-MM-DDTHH:mm:ss.sssZ"),
 * nunca apenas "AAAA-MM-DD" — um bug real foi encontrado e corrigido
 * durante esta missão: cortar por "-" sem primeiro isolar a parte de
 * data produzia "01T00:00:00.000Z" como se fosse o dia.
 */
function statementLine(period: { startDate: string; endDate: string }): NormalizedFinancialRecord {
  return {
    recordId: "sl-1",
    kind: "statement_line",
    label: "linha",
    amount: 100,
    currency: "BRL",
    source: "dre.pdf",
    statementCategory: "net_income",
    period,
  };
}

function resource(asOfDate: string): NormalizedFinancialRecord {
  return {
    recordId: "res-1",
    kind: "resource",
    label: "recurso",
    amount: 100,
    currency: "BRL",
    source: "balanco.pdf",
    resourceType: "cash",
    asOfDate,
  };
}

describe("derivePeriodLabel()", () => {
  test("formata period ISO completo como DD/MM/AAAA a DD/MM/AAAA", () => {
    const label = derivePeriodLabel([
      statementLine({
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-07-31T00:00:00.000Z",
      }),
    ]);
    assert.equal(label, "01/07/2026 a 31/07/2026");
  });

  test("formata asOfDate ISO completo como Data-base: DD/MM/AAAA", () => {
    const label = derivePeriodLabel([resource("2026-07-31T00:00:00.000Z")]);
    assert.equal(label, "Data-base: 31/07/2026");
  });

  test("sem período nem data-base — undefined, nunca uma string vazia/fabricada", () => {
    const label = derivePeriodLabel([
      { recordId: "evt-1", kind: "event", label: "evento", amount: 1, currency: "BRL", occurredAt: "2026-07-01", source: "x" },
    ]);
    assert.equal(label, undefined);
  });
});
