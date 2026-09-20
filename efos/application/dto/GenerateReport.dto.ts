/**
 * DTOs do caso de uso "Gerar Relatório Executivo"
 * (`GenerateExecutiveReportUseCase`, efos/application/use-cases/).
 * Imutáveis — nunca reutilizam entidades do domínio (efos/domain)
 * diretamente; representam a forma de dado que atravessa a fronteira
 * da Application Layer, independente de como o domínio modela a mesma
 * informação internamente.
 *
 * `GenerateReportResponse` é um placeholder estrutural — mesmo
 * princípio dos esqueletos originais de Engine (Mission 002, `{
 * companyId: string }`): o formato real da resposta será definido
 * quando `ReportService` for implementado de verdade, não nesta
 * missão (que não executa nenhum Engine).
 */
export interface GenerateReportRequest {
  readonly companyId: string;
}

export interface GenerateReportResponse {
  readonly companyId: string;
}
