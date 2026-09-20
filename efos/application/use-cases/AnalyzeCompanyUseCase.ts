import type { UseCase } from "../contracts";
import type { AnalyzeCompanyRequest, AnalyzeCompanyResponse } from "../dto";

/**
 * Caso de uso: analisar uma empresa. Responsabilidade única — depende
 * apenas de `AnalysisService` (efos/application/services), nunca
 * conhece Engines (efos/engines/*) nem infraestrutura diretamente.
 * Nesta missão é apenas um contrato — sem implementação.
 */
export type AnalyzeCompanyUseCase = UseCase<
  AnalyzeCompanyRequest,
  AnalyzeCompanyResponse
>;
