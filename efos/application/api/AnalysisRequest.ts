/**
 * Forma da requisição externa recebida pela primeira camada HTTP
 * oficial da NEXO (Mission 028 — REST API Layer) — transporte-
 * agnóstica, nunca acoplada a um framework HTTP específico (Next.js,
 * Express, Fastify, Hono, Nest — nenhum deles é conhecido aqui).
 * `AnalysisController.analyze()` transforma esta forma em
 * `AnalyzeCompanyRequest` (`efos/application/dto/AnalyzeCompany.dto.ts`,
 * Mission 017) antes de chamar `EFOSHost`.
 *
 * Hoje espelha `AnalyzeCompanyRequest` (`{ companyId }`) porque
 * `EFOSFacade.analyzeCompany()` (Mission 023) só aceita esse campo —
 * `AnalysisRequest` é mantido como tipo próprio, não um alias, para
 * que a forma da requisição HTTP possa evoluir independentemente da
 * forma do DTO interno da Application Layer (mesmo princípio de D-014:
 * a fronteira externa nunca deve vazar para dentro, nem o inverso).
 */
export interface AnalysisRequest {
  readonly companyId: string;
}
