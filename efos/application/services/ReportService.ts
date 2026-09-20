import type { ApplicationService } from "../contracts";
import type { PipelineExecution } from "../orchestrators";
import type { ExecutiveReport } from "../report";

/**
 * Transforma um `PipelineExecution` (`efos/application/orchestrators/
 * PipelineExecution.ts`, Mission 020B) já produzido — por quem
 * acionou o `EFOSPipelineOrchestrator` — em um `ExecutiveReport`
 * (`efos/application/report/`, Mission 022) estruturado. Primeira
 * implementação concreta: `DefaultReportService`
 * (`DefaultReportService.ts`, Mission 022 — Executive Report
 * Service). Diferente de `AnalysisService` (D-018), este Service
 * nunca aciona o Orchestrator nem executa nenhum Engine — consome
 * exclusivamente um `PipelineExecution` já concluído, somente
 * leitura, sem alterar nenhum Aggregate recebido (D-019).
 */
export interface ReportService extends ApplicationService {
  generateReport(execution: PipelineExecution): Promise<ExecutiveReport>;
}
