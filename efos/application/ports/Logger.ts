/**
 * Port de log estruturado. Contrato puro — implementação real (ex.:
 * console, serviço de observabilidade) pertence a Infrastructure.
 * Nenhuma lógica de negócio.
 */
export interface Logger {
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}
