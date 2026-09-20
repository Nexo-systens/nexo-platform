import { randomUUID } from "node:crypto";

import type { ApplicationResult } from "../contracts";
import type { AnalyzeCompanyRequest, AnalyzeCompanyResponse } from "../dto";
import type { DocumentIntake } from "../intake";
import type {
  EFOSPipelineOrchestrator,
  PipelineContext,
  PipelineExecution,
  PipelineMetadata,
} from "../orchestrators";
import type { StatementConflict } from "@/efos/domain";
import type { RawFinancialDocument } from "@/efos/engines/data";
import type { EvidenceHistoricalPeriod } from "@/efos/engines/evidence";

import type { AnalysisService } from "./AnalysisService";

/**
 * Primeira implementação concreta de `AnalysisService` (Mission 021 —
 * Analysis Service) — primeiro consumidor oficial do EFOS Pipeline
 * Runtime. Depende exclusivamente do contrato `EFOSPipelineOrchestrator`
 * (`efos/application/orchestrators/EFOSPipelineOrchestrator.ts`) e do
 * contrato `DocumentIntake` (`efos/application/intake/DocumentIntake.ts`,
 * Mission 026) — ambos injetados via construtor, nunca instanciados
 * internamente (nunca `new EFOSPipelineRuntime()`/`new
 * DefaultDocumentIntake()` dentro desta classe), para que este Service
 * permaneça válido com qualquer implementação futura dos dois.
 *
 * Responsabilidade estritamente de tradução/coordenação, nenhuma regra
 * financeira: recebe `AnalyzeCompanyRequest` (+ documentos brutos
 * opcionais), prepara os documentos via `DocumentIntake`, monta
 * `PipelineContext`, aciona `EFOSPipelineOrchestrator.execute()`,
 * recebe `PipelineResult` e traduz para `{ response, execution,
 * metadata }` — toda regra determinística continua exclusivamente nos
 * Builders dos Engines (arquivos `<engine>.builder.ts` dentro de cada
 * `efos/engines/<nome>/`).
 *
 * Entre as Missions 037 e 065, este Service também persistia a
 * execução automaticamente (`ExecutionRepository.save()`, D-028), com
 * `report` sempre `undefined` (o `ExecutiveReport` só existe depois,
 * produzido por `ReportService` dentro da `EFOSFacade`). Desde a
 * Mission 066 (Executive Report Persistence, D-038, revisando D-028),
 * essa responsabilidade migrou para `EFOSFacade` — o único ponto que
 * de fato possui `metadata`+`execution`+`report` juntos, permitindo
 * uma única persistência já completa, em vez de uma primeira gravação
 * sem relatório. Este Service devolve `metadata` (Mission 018/D-017)
 * além de `execution`, para que a Facade possa montar o
 * `ExecutionSnapshot` oficial sem reconstruir nada.
 */
export class DefaultAnalysisService implements AnalysisService {
  readonly name = "AnalysisService";

  constructor(
    private readonly orchestrator: EFOSPipelineOrchestrator,
    private readonly documentIntake: DocumentIntake
  ) {}

  async analyze(
    request: AnalyzeCompanyRequest,
    documents: readonly RawFinancialDocument[] = [],
    priorPeriods?: readonly EvidenceHistoricalPeriod[],
    conflicts?: readonly StatementConflict[]
  ): Promise<
    ApplicationResult<{
      readonly response: AnalyzeCompanyResponse;
      readonly execution: PipelineExecution;
      readonly metadata: PipelineMetadata;
    }>
  > {
    const preparedDocuments = this.documentIntake.prepareDocuments(documents);

    const context: PipelineContext = {
      companyId: request.companyId,
      requestId: randomUUID(),
      executionId: randomUUID(),
      timestamp: new Date().toISOString(),
      // `priorPeriods` (Mission 174) e `conflicts` (Mission 192 Closure
      // B, D-113) transportados pelo MESMO mecanismo já usado por
      // `documents` desde a Mission 044 — nunca um campo novo em
      // `PipelineContext`, nunca um parâmetro novo em
      // `EFOSPipelineOrchestrator.execute()` (D-016).
      metadata: {
        documents: preparedDocuments,
        ...(priorPeriods ? { priorPeriods } : {}),
        ...(conflicts ? { conflicts } : {}),
      },
    };

    const result = await this.orchestrator.execute(context);

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      value: {
        response: { companyId: request.companyId },
        execution: result.value.execution,
        metadata: result.value.metadata,
      },
    };
  }
}
