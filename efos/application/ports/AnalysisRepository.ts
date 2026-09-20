/**
 * Port de persistencia de uma analise gerada pela Application Layer.
 * A forma concreta de "analise" ainda nao esta definida (nenhum
 * `AnalysisService` real existe nesta missao) — por isso o payload e
 * `unknown`, nunca inventado. Contrato puro — implementacao real
 * pertence a Infrastructure. Nenhuma logica de negocio.
 */
export interface AnalysisRepository {
  save(companyId: string, analysis: unknown): Promise<void>;
  findLatestByCompanyId(companyId: string): Promise<unknown | undefined>;
}
