import type { ApplicationError } from "../contracts/ApplicationError";

/**
 * Wrapper generico de resultado — sucesso ou erro, nunca os dois.
 * Reutilizavel por qualquer Service/Port internamente, nao apenas
 * pelo envelope oficial de UseCase (`ApplicationResult`,
 * efos/application/contracts/ApplicationResult.ts, que e este mesmo
 * tipo especializado com `ApplicationError` como erro). Puramente
 * estrutural — nenhuma logica de negocio.
 */
export type Result<TValue, TError = ApplicationError> =
  | { readonly success: true; readonly value: TValue }
  | { readonly success: false; readonly error: TError };
