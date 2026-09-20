import type { UseCase } from "../contracts";

/**
 * Caso de uso: executar um diagnóstico financeiro de uma empresa.
 * Responsabilidade única — dependeria de `AnalysisService`
 * (efos/application/services), nunca conhece Engines (efos/engines/*)
 * nem infraestrutura diretamente. Nesta missão é apenas um contrato —
 * sem implementação.
 *
 * Diferente de `AnalyzeCompanyUseCase`/`GenerateExecutiveReportUseCase`,
 * este Use Case ainda não tem um par de DTO nomeado (Mission 017 só
 * definiu `AnalyzeCompanyRequest`/`Response` e
 * `GenerateReportRequest`/`Response`) — usa `unknown` deliberadamente
 * em vez de inventar um formato de requisição/resposta não pedido.
 * Uma missão futura que definir `RunFinancialDiagnosisRequest`/
 * `Response` deve especializar este tipo aqui.
 */
export type RunFinancialDiagnosisUseCase = UseCase<unknown, unknown>;
