import type { ApplicationErrorCode } from "../shared/Errors";

/**
 * Forma comum de erro retornada por qualquer Service/UseCase da
 * Application Layer. Usa o vocabulario de codigos definido em
 * `efos/application/shared/Errors.ts` (`ApplicationErrorCode`).
 * Puramente estrutural — nenhuma logica de negocio, nenhuma
 * dependencia de HTTP (sem status code, sem header).
 */
export interface ApplicationError {
  readonly code: ApplicationErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}
