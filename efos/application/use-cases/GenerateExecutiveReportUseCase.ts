import type { UseCase } from "../contracts";
import type { GenerateReportRequest, GenerateReportResponse } from "../dto";

/**
 * Caso de uso: gerar relatório executivo de uma empresa.
 * Responsabilidade única — depende apenas de `ReportService`
 * (efos/application/services), nunca conhece Engines
 * (efos/engines/*) nem infraestrutura diretamente. Nesta missão é
 * apenas um contrato — sem implementação.
 */
export type GenerateExecutiveReportUseCase = UseCase<
  GenerateReportRequest,
  GenerateReportResponse
>;
