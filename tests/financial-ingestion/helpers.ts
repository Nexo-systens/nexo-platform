import type { EfosEngineContext } from "@/efos/interfaces";
import type { FinancialModelAggregate, Indicator } from "@/efos/domain";
import { DataEngine } from "@/efos/engines/data";
import type { DataEngineOutput, RawFinancialDocument } from "@/efos/engines/data";
import { FinancialModelEngine } from "@/efos/engines/financial-model";
import { IndicatorsEngine } from "@/efos/engines/indicators";
import { prepareClassifiedDocuments } from "@/app/api/efos/_shared/prepareFinancialDocuments";
import type { ExcludedDocument } from "@/app/api/efos/_shared/resolveStatementConflicts";
import type { StatementConflict } from "@/efos/domain";

/**
 * Mission 193 — Production Intake Governance & Permanent Regression
 * Gate. Único runner de pipeline desta suíte — reaproveita
 * `prepareClassifiedDocuments()` (a MESMA sequência de produção:
 * classificação → D-113 → Normalizer → Resolver → Consolidator →
 * KnowledgeBuilder → Validator → ContextBuilder → DocumentIntake) mais
 * `DataEngine`/`FinancialModelEngine`/`IndicatorsEngine` reais — nunca
 * uma segunda implementação paralela de nenhuma etapa (Seção 30/42 da
 * missão).
 */

function engineContext(companyId: string): EfosEngineContext {
  return { companyId, pipelineRunId: "test" };
}

export interface IngestionResult {
  readonly excluded: readonly ExcludedDocument[];
  readonly conflicts: readonly StatementConflict[];
  readonly dataStatus: "completed" | "failed";
  readonly dataError?: string;
  /**
   * Mission 194 — Production Executive Report Truth & Presentation
   * Audit. Saída CRUA do Data Engine (`DataEngineOutput`, mesmo campo
   * que `PipelineExecution.data`) — antes ausente deste resultado
   * porque nenhum consumidor precisava dela (só `model`/`indicators`
   * eram usados pelos invariantes de ingestão); `tests/executive-report/`
   * precisa dela para alimentar `DefaultReportService.generateReport()`
   * com um `PipelineExecution` real, nunca uma segunda execução do Data
   * Engine em paralelo.
   */
  readonly data?: DataEngineOutput;
  readonly modelStatus?: "completed" | "failed";
  readonly modelError?: string;
  readonly model?: FinancialModelAggregate;
  readonly indicatorsStatus?: "completed" | "failed";
  readonly indicatorsError?: string;
  readonly indicators?: ReadonlyMap<string, Indicator>;
}

export async function runIngestion(
  companyId: string,
  documents: readonly RawFinancialDocument[]
): Promise<IngestionResult> {
  const { documents: preparedDocuments, excluded, conflicts } =
    await prepareClassifiedDocuments(documents);

  const ctx = engineContext(companyId);

  const dataResult = await new DataEngine().execute(
    { companyId, documents: preparedDocuments },
    ctx
  );
  if (dataResult.status === "failed") {
    return { excluded, conflicts, dataStatus: "failed", dataError: dataResult.error };
  }

  const modelResult = await new FinancialModelEngine().execute(
    { companyId, records: dataResult.output!, conflicts },
    ctx
  );
  if (modelResult.status === "failed") {
    return {
      excluded,
      conflicts,
      dataStatus: "completed",
      data: dataResult.output,
      modelStatus: "failed",
      modelError: modelResult.error,
    };
  }

  const indicatorsResult = await new IndicatorsEngine().execute(
    { companyId, financialModel: modelResult.output! },
    ctx
  );

  const indicators = new Map<string, Indicator>();
  if (indicatorsResult.status === "completed") {
    for (const indicator of indicatorsResult.output!.indicators) {
      indicators.set(indicator.name, indicator);
    }
  }

  return {
    excluded,
    conflicts,
    dataStatus: "completed",
    data: dataResult.output,
    modelStatus: "completed",
    model: modelResult.output,
    indicatorsStatus: indicatorsResult.status,
    indicatorsError: indicatorsResult.status === "failed" ? indicatorsResult.error : undefined,
    indicators,
  };
}

/** Atalho para o valor de um indicador disponível — `undefined` se indisponível ou inexistente. */
export function availableValue(indicators: ReadonlyMap<string, Indicator> | undefined, name: string): number | undefined {
  const result = indicators?.get(name)?.result;
  return result?.status === "available" ? result.value : undefined;
}

export function statusOf(indicators: ReadonlyMap<string, Indicator> | undefined, name: string): string | undefined {
  return indicators?.get(name)?.result.status;
}
