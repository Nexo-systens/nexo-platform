import type { Indicator } from "@/efos/domain";
import type { RawFinancialDocument } from "@/efos/engines/data";
import { DefaultReportService } from "@/efos/application/services/DefaultReportService";
import type { PipelineExecution } from "@/efos/application/orchestrators";
import type { ExecutiveReport, ExecutiveReportSection } from "@/efos/application/report";
import { runIngestion, type IngestionResult } from "../financial-ingestion/helpers";

/**
 * Mission 194 — Production Executive Report Truth & Presentation
 * Audit. Estende `runIngestion()` (`tests/financial-ingestion/helpers.ts`,
 * Mission 193 — MESMA sequência oficial de produção: classificação →
 * D-113 → Normalizer → Resolver → Consolidator → DocumentIntake →
 * Data Engine → Financial Model Engine → Indicators Engine, nenhuma
 * segunda implementação paralela) até o ÚLTIMO estágio que
 * `DefaultReportService` (Mission 022/062/064/194) realmente lê:
 * `execution.data`/`execution.financialModel`/`execution.indicators`.
 *
 * Nunca invoca `EFOSPipelineRuntime`/`EFOSFacade`/`EFOSPlatform`
 * completos (que exigem Evidence/Context/Reasoning/Recommendation/
 * Decision reais e persistência Supabase — fora do escopo desta
 * missão, que audita apenas a fidelidade da PROJEÇÃO do `ExecutiveReport`
 * sobre o que o Financial Model/Indicators já produziram) — um
 * `PipelineExecution` parcial (mesmo contrato oficial,
 * `efos/application/orchestrators/PipelineExecution.ts`, todos os
 * campos de estágio já opcionais por design) é suficiente e genuíno:
 * `DefaultReportService.generateReport()` já lida com estágios
 * ausentes há muitas missões (nenhuma seção é criada para um estágio
 * não alcançado).
 */
export interface ExecutiveReportBuildResult {
  readonly ingestion: IngestionResult;
  readonly report: ExecutiveReport;
}

export async function buildExecutiveReport(
  companyId: string,
  documents: readonly RawFinancialDocument[]
): Promise<ExecutiveReportBuildResult> {
  const ingestion = await runIngestion(companyId, documents);

  const execution: PipelineExecution = {
    pipelineContext: {
      companyId,
      requestId: "test-request",
      executionId: "test-execution",
      timestamp: new Date().toISOString(),
    },
    data: ingestion.data,
    financialModel: ingestion.model,
    indicators:
      ingestion.indicatorsStatus === "completed" && ingestion.indicators
        ? { companyId, financialModelId: ingestion.model!.root.id, indicators: [...ingestion.indicators.values()] }
        : undefined,
  };

  const report = await new DefaultReportService().generateReport(execution);
  return { ingestion, report };
}

export function sectionOfType<T extends ExecutiveReportSection["type"]>(
  report: ExecutiveReport,
  type: T
): Extract<ExecutiveReportSection, { type: T }> | undefined {
  return report.sections.find((section): section is Extract<ExecutiveReportSection, { type: T }> =>
    section.type === type
  );
}

export function indicatorByName(
  indicators: readonly Indicator[],
  name: string
): Indicator | undefined {
  return indicators.find((indicator) => indicator.name === name);
}
