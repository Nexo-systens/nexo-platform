import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { formatCalendarDate, formatPeriod } from "@/modules/analysis/lib/executive-language";

/**
 * Mission 201 — Founding Company Final Go-Live Gate.
 *
 * Achado no smoke test ao vivo: uma DRE de 01/07/2026 a 31/07/2026
 * aparecia na Trajetória Financeira como "30/06/2026 – 31/07/2026".
 * O classificador codifica os limites de período em UTC (início =
 * meia-noite UTC do primeiro dia, fim = 23:59:59 UTC do último dia —
 * `DefaultFinancialStatementClassifier`), e a UI formatava no fuso local
 * (BRT, -03:00). Datas de calendário de período são sempre formatadas em
 * UTC.
 */

// Exatamente o que o classificador produz para "Período: 01/07/2026 a 31/07/2026".
const JULY_2026 = {
  startDate: new Date(Date.UTC(2026, 6, 1)).toISOString(),
  endDate: new Date(Date.UTC(2026, 6, 31, 23, 59, 59)).toISOString(),
};

describe("Mission 201 — período financeiro exibido no dia de calendário correto", () => {
  const originalTz = process.env.TZ;
  before(() => { process.env.TZ = "America/Sao_Paulo"; });
  after(() => { process.env.TZ = originalTz; });

  test("controle: no fuso de Brasília, a formatação local antiga exibiria o início no dia anterior", () => {
    assert.equal(new Date(JULY_2026.startDate).toLocaleDateString("pt-BR"), "30/06/2026");
  });

  test("formatPeriod() exibe exatamente o período declarado no documento", () => {
    assert.equal(formatPeriod(JULY_2026), "01/07/2026 – 31/07/2026");
  });

  test("formatCalendarDate() é estável em qualquer fuso (UTC-12 a UTC+14)", () => {
    for (const tz of ["Pacific/Kwajalein", "America/Sao_Paulo", "UTC", "Asia/Tokyo", "Pacific/Kiritimati"]) {
      process.env.TZ = tz;
      assert.equal(formatCalendarDate(JULY_2026.startDate), "01/07/2026", tz);
      assert.equal(formatCalendarDate(JULY_2026.endDate), "31/07/2026", tz);
    }
    process.env.TZ = "America/Sao_Paulo";
  });
});
