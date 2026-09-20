/**
 * Port de persistencia de relatorios executivos gerados pela
 * Application Layer. A forma concreta de "relatorio" ainda nao esta
 * definida (nenhum `ReportService` real existe nesta missao) — por
 * isso o payload e `unknown`, nunca inventado. Contrato puro —
 * implementacao real pertence a Infrastructure. Nenhuma logica de
 * negocio.
 */
export interface ReportRepository {
  save(companyId: string, report: unknown): Promise<void>;
  findById(reportId: string): Promise<unknown | undefined>;
}
