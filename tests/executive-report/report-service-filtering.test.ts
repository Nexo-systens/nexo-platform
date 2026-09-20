import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { NormalizedFinancialRecord } from "@/efos/engines/data";
import { DefaultReportService } from "@/efos/application/services/DefaultReportService";
import type { PipelineExecution } from "@/efos/application/orchestrators";
import type { FinancialModel, FinancialModelAggregate } from "@/efos/domain";

/**
 * Mission 194 — Production Executive Report Truth & Presentation
 * Audit, Seção 7/16/42/43 (D-118). Antes desta missão,
 * `DefaultReportService.buildFinancialSections()` repassava
 * `execution.data` INTEIRO, sem filtro, aos três Builders — cada
 * demonstração acabava mostrando os MESMOS registros das outras (uma
 * linha de DRE aparecia na seção "Fluxo de Caixa"; um recurso de
 * Balanço aparecia na "Demonstração do Resultado"). Este teste prova,
 * no nível do serviço (sem precisar rodar Data/FinancialModel/
 * Indicators Engines reais), que cada seção agora só contém dados da
 * sua própria demonstração.
 */

function resourceRecord(recordId: string): NormalizedFinancialRecord {
  return {
    recordId,
    kind: "resource",
    label: `recurso-${recordId}`,
    amount: 1000,
    currency: "BRL",
    source: "balanco.pdf",
    resourceType: "cash",
  };
}

function statementLineRecord(recordId: string): NormalizedFinancialRecord {
  return {
    recordId,
    kind: "statement_line",
    label: `linha-${recordId}`,
    amount: 1000,
    currency: "BRL",
    source: "dre.pdf",
    statementCategory: "operating_expense",
    period: { startDate: "2026-07-01", endDate: "2026-07-31" },
  };
}

function eventRecord(recordId: string): NormalizedFinancialRecord {
  return {
    recordId,
    kind: "event",
    label: `evento-${recordId}`,
    amount: 1000,
    currency: "BRL",
    occurredAt: "2026-07-15",
    source: "extrato.pdf",
    eventType: "sale",
  };
}

function buildExecution(data: readonly NormalizedFinancialRecord[]): PipelineExecution {
  const root: FinancialModel = {
    id: "fm-1",
    companyId: "company-1",
    provenance: { source: "test", confidence: { value: 100, level: "high" } },
    audit: { createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", version: 1 },
  };
  const financialModel: FinancialModelAggregate = {
    root,
    resources: [],
    events: [],
    indicators: [],
  };
  return {
    pipelineContext: {
      companyId: "company-1",
      requestId: "req-1",
      executionId: "exec-1",
      timestamp: "2026-07-01T00:00:00.000Z",
    },
    data,
    financialModel,
  };
}

describe("DefaultReportService — cada demonstração só recebe dados da sua própria natureza (D-118)", () => {
  test("Balanço Patrimonial nunca recebe eventos nem linhas de DRE", async () => {
    const data = [resourceRecord("res-1"), statementLineRecord("sl-1"), eventRecord("evt-1")];
    const report = await new DefaultReportService().generateReport(buildExecution(data));

    const balanceSheet = report.sections.find((section) => section.type === "balanceSheet");
    assert.ok(balanceSheet && balanceSheet.type === "balanceSheet");
    const ids = balanceSheet.balanceSheet.map((record) => record.recordId);
    assert.deepEqual(ids, ["res-1"]);
  });

  test("Demonstração do Resultado nunca recebe recursos de Balanço", async () => {
    const data = [resourceRecord("res-1"), statementLineRecord("sl-1"), eventRecord("evt-1")];
    const report = await new DefaultReportService().generateReport(buildExecution(data));

    const incomeStatement = report.sections.find((section) => section.type === "incomeStatement");
    assert.ok(incomeStatement && incomeStatement.type === "incomeStatement");
    const ids = incomeStatement.incomeStatement.map((record) => record.recordId).sort();
    assert.deepEqual(ids, ["evt-1", "sl-1"]);
  });

  test("Movimentações de Caixa nunca recebem recursos de Balanço nem linhas de DRE (Seção 16 — nunca mostrar agregado de DRE como se fosse transação)", async () => {
    const data = [resourceRecord("res-1"), statementLineRecord("sl-1"), eventRecord("evt-1")];
    const report = await new DefaultReportService().generateReport(buildExecution(data));

    const cashFlow = report.sections.find((section) => section.type === "cashFlow");
    assert.ok(cashFlow && cashFlow.type === "cashFlow");
    const ids = cashFlow.cashFlow.map((record) => record.recordId);
    assert.deepEqual(ids, ["evt-1"]);
  });

  test("título da seção de Fluxo de Caixa não afirma ser uma DFC formal (Seção 16/52.2)", async () => {
    const report = await new DefaultReportService().generateReport(buildExecution([eventRecord("evt-1")]));
    const cashFlow = report.sections.find((section) => section.type === "cashFlow");
    assert.ok(cashFlow);
    assert.notEqual(cashFlow!.title, "Fluxo de Caixa");
    assert.match(cashFlow!.title, /Movimenta/i);
  });

  test("nenhuma seção financeira é criada quando execution.data está ausente (estágio não alcançado, nunca uma seção fictícia)", async () => {
    const execution: PipelineExecution = {
      pipelineContext: {
        companyId: "company-1",
        requestId: "req-1",
        executionId: "exec-1",
        timestamp: "2026-07-01T00:00:00.000Z",
      },
    };
    const report = await new DefaultReportService().generateReport(execution);
    assert.equal(report.sections.find((s) => s.type === "balanceSheet"), undefined);
    assert.equal(report.sections.find((s) => s.type === "incomeStatement"), undefined);
    assert.equal(report.sections.find((s) => s.type === "cashFlow"), undefined);
  });
});
