/**
 * Metadados identificadores de um Executive Report (Mission 022 —
 * Executive Report Service). Nenhum campo calculado — todos lidos
 * diretamente de `PipelineExecution.pipelineContext` (`companyId`,
 * `executionId`) ou de `PipelineExecution.financialModel.root.id`
 * (`financialModelId`, ausente se a execução não alcançou o estágio
 * Financial Model). `generatedAt` marca quando o relatório em si foi
 * montado — distinto de `PipelineContext.timestamp` (quando a
 * execução do pipeline começou).
 */
export interface ExecutiveReportMetadata {
  readonly companyId: string;
  readonly executionId: string;
  readonly financialModelId?: string;
  readonly generatedAt: string;
}
