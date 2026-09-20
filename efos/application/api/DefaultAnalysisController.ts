import type { AnalyzeCompanyRequest } from "../dto";
import type { EFOSHost } from "../host";

import type { AnalysisController } from "./AnalysisController";
import type { AnalysisRequest } from "./AnalysisRequest";
import type { AnalysisResponse } from "./AnalysisResponse";

/**
 * Primeira implementação concreta de `AnalysisController` (Mission
 * 028 — REST API Layer). Recebe `EFOSHost`
 * (`efos/application/host/EFOSHost.ts`, Mission 025) via construtor —
 * inversão de dependência, nunca instanciando `DefaultEFOSHost` nem
 * `DefaultEFOSContainer` internamente.
 *
 * Fluxo de `analyze()`: `AnalysisRequest` → `AnalyzeCompanyRequest`
 * (`efos/application/dto/AnalyzeCompany.dto.ts`, Mission 017,
 * nenhum campo copiado além de `companyId`) → `EFOSHost.getFacade()`
 * → `EFOSFacade.analyzeCompany()` → `ApplicationResult<ExecutiveReport>`
 * → `AnalysisResponse`. Nenhuma regra de negócio, nenhum acesso a
 * Engine, Domain ou infraestrutura.
 */
export class DefaultAnalysisController implements AnalysisController {
  constructor(private readonly host: EFOSHost) {}

  async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
    const analyzeCompanyRequest: AnalyzeCompanyRequest = {
      companyId: request.companyId,
    };

    const result = await this.host
      .getFacade()
      .analyzeCompany(analyzeCompanyRequest);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, report: result.value };
  }
}
