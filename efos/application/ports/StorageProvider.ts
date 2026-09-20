/**
 * Port de armazenamento de arquivo bruto (ex.: documento financeiro
 * enviado pelo usuario). Contrato puro — implementacao real (ex.:
 * Supabase Storage) pertence a Infrastructure, fora do EFOS Core.
 * Nenhuma logica de negocio.
 */
export interface StorageProvider {
  upload(path: string, content: unknown): Promise<string>;
  download(path: string): Promise<unknown>;
}
