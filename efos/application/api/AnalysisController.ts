import type { AnalysisRequest } from "./AnalysisRequest";
import type { AnalysisResponse } from "./AnalysisResponse";

/**
 * Primeira camada HTTP oficial da NEXO (Mission 028 — REST API
 * Layer) — responsabilidade única: receber uma requisição externa,
 * transformá-la em `AnalyzeCompanyRequest`, chamar `EFOSHost`
 * (`efos/application/host/EFOSHost.ts`, Mission 025) e devolver
 * `AnalysisResponse`. Nada além disso — nenhuma regra de negócio.
 *
 * Deliberadamente transporte-agnóstica: nenhum Next.js Route,
 * Express, Fastify, Hono ou Nest é conhecido aqui — esta interface é
 * o contrato que uma futura camada HTTP concreta (fora do escopo
 * desta missão) invocaria.
 *
 * Primeira implementação concreta: `DefaultAnalysisController`
 * (`DefaultAnalysisController.ts`). Único método público:
 * `analyze()`.
 */
export interface AnalysisController {
  analyze(request: AnalysisRequest): Promise<AnalysisResponse>;
}
