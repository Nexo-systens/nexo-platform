import type { ApplicationResult, ApplicationService } from "../contracts";
import type { AnalyzeCompanyRequest, AnalyzeCompanyResponse } from "../dto";
import type { PipelineExecution, PipelineMetadata } from "../orchestrators";
import type { StatementConflict } from "@/efos/domain";
import type { RawFinancialDocument } from "@/efos/engines/data";
import type { EvidenceHistoricalPeriod } from "@/efos/engines/evidence";

/**
 * Coordena a obtenção de uma análise financeira completa de uma
 * empresa. Primeira implementação concreta: `DefaultAnalysisService`
 * (`DefaultAnalysisService.ts`, Mission 021 — Analysis Service).
 * `analyze()` usa exclusivamente os DTOs oficiais da Mission 017
 * (`AnalyzeCompanyRequest`/`AnalyzeCompanyResponse`, `efos/application/
 * dto/AnalyzeCompany.dto.ts`) e retorna `ApplicationResult` — mesmo
 * envelope que `AnalyzeCompanyUseCase.execute()` (`efos/application/
 * use-cases/`) já espera, permitindo que um futuro Use Case repasse o
 * resultado do Service diretamente. Nunca conhece Engines
 * (`efos/engines/*`) nem o Domain (`efos/domain`) diretamente — só o
 * `EFOSPipelineOrchestrator` (`efos/application/orchestrators/`) e,
 * desde a Mission 026, o `DocumentIntake` (`efos/application/intake/`).
 *
 * No sucesso, o valor carrega `response` (`AnalyzeCompanyResponse`,
 * inalterado desde a Mission 017) **e** `execution`
 * (`PipelineExecution`, Mission 020B) — mesmo padrão de composição já
 * usado por `PipelineResult` (`{ metadata, execution }`, D-017): um
 * objeto literal reaproveitando tipos já oficiais, nenhum DTO novo.
 * `execution` existe para que um consumidor (ex.: `EFOSFacade`,
 * Mission 023) possa encadear `ReportService.generateReport()` sem
 * precisar conhecer o Orchestrator (D-020).
 *
 * `documents` (Mission 026 — Document Intake Layer) é um parâmetro
 * opcional, não um DTO novo — reaproveita `RawFinancialDocument`
 * (`efos/engines/data/data.types.ts`, contrato oficial do Data
 * Engine, D-002). Antes de montar o `PipelineContext`, `analyze()`
 * passa `documents` por `DocumentIntake.prepareDocuments()` — nenhum
 * outro componente prepara documentos (D-022).
 *
 * Desde a Mission 066 (Executive Report Persistence, D-038, revisando
 * D-028), o valor de sucesso também carrega `metadata`
 * (`PipelineMetadata`, Mission 018/D-017) — este Service deixou de
 * persistir a execução (essa responsabilidade migrou para
 * `EFOSFacade`, único ponto que já possui o `ExecutiveReport`
 * completo); `metadata` precisa chegar até lá para montar o
 * `ExecutionSnapshot` oficial.
 */
export interface AnalysisService extends ApplicationService {
  /**
   * `priorPeriods` (Mission 174 — Production Temporal Evidence Input)
   * — histórico financeiro comparável já canonicalizado (nunca
   * buscado por este Service; quem decide o que fornecer é sempre o
   * chamador — `DefaultEFOSFacade` — mesmo princípio de D-002 já
   * aplicado a `documents`/`DocumentIntake`). Repassado, sem
   * transformação, até `EvidenceEngine` através de `PipelineContext.metadata`
   * (mesmo mecanismo de transporte já usado para `documents` desde a
   * Mission 044) — nunca um parâmetro novo em
   * `EFOSPipelineOrchestrator.execute()`. Omitido (ou `[]`) produz
   * exatamente o comportamento anterior a esta missão: apenas Evidence
   * absoluta, nenhuma Evidence temporal.
   */
  /**
   * `conflicts` (Mission 192 Closure B — Deterministic Statement
   * Conflict Governance) — mesmo princípio de `priorPeriods`: quem
   * decide o que fornecer é sempre o chamador (`DefaultEFOSFacade`,
   * repassando o que `prepareFinancialDocuments()` já detectou).
   * Repassado sem transformação até `FinancialModelEngine` através de
   * `PipelineContext.metadata` (mesmo mecanismo de `documents`/
   * `priorPeriods`). Omitido (ou `[]`) produz
   * `FinancialModelAggregate.statementConflicts` ausente — nenhum
   * comportamento novo.
   */
  analyze(
    request: AnalyzeCompanyRequest,
    documents?: readonly RawFinancialDocument[],
    priorPeriods?: readonly EvidenceHistoricalPeriod[],
    conflicts?: readonly StatementConflict[]
  ): Promise<
    ApplicationResult<{
      readonly response: AnalyzeCompanyResponse;
      readonly execution: PipelineExecution;
      readonly metadata: PipelineMetadata;
    }>
  >;
}
