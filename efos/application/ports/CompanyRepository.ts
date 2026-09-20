import type { Company } from "@/efos/domain";

/**
 * Port de leitura da entidade `Company` (efos/domain). Contrato puro —
 * a implementacao real (ex.: Supabase) pertence a Infrastructure, fora
 * do EFOS Core. Nenhuma logica de negocio, nenhum metodo implementado.
 */
export interface CompanyRepository {
  findById(companyId: string): Promise<Company | undefined>;
}
