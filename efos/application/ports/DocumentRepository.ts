/**
 * Port de leitura de documentos financeiros brutos. A entidade
 * `Document` do dominio (efos/domain) e minima (esqueleto, Mission
 * 003) — este Port usa `unknown` para o payload ate que o formato real
 * de documento consumido pela Application Layer seja definido.
 * Contrato puro — implementacao real (ex.: Supabase Storage) pertence
 * a Infrastructure. Nenhuma logica de negocio.
 */
export interface DocumentRepository {
  findById(documentId: string): Promise<unknown | undefined>;
  findByCompanyId(companyId: string): Promise<readonly unknown[]>;
}
