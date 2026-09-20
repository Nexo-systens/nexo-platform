import type { ApplicationError } from "../contracts";
import type { ExecutiveReport } from "../report";

/**
 * Forma da resposta que a primeira camada HTTP oficial da NEXO
 * (Mission 028 — REST API Layer) devolve — transporte-agnóstica,
 * nunca acoplada a um framework HTTP específico (sem status code, sem
 * header). `AnalysisController.analyze()` produz este tipo a partir
 * do `ApplicationResult<ExecutiveReport>` retornado por
 * `EFOSFacade.analyzeCompany()` (Mission 023).
 *
 * União discriminada por `success`, mesmo espírito de `Result`/
 * `ApplicationResult` (`efos/application/shared/Result.ts`,
 * `efos/application/contracts/ApplicationResult.ts`, D-014) — no
 * sucesso, carrega `report: ExecutiveReport` (`efos/application/
 * report/`, Mission 022) diretamente, sem nenhum campo copiado; na
 * falha, repassa o mesmo `ApplicationError` já produzido internamente
 * (`efos/application/contracts/ApplicationError.ts`), nenhum
 * vocabulário de erro novo.
 */
export type AnalysisResponse =
  | { readonly success: true; readonly report: ExecutiveReport }
  | { readonly success: false; readonly error: ApplicationError };
