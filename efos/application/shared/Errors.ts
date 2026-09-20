/**
 * Vocabulario comum de erro da Application Layer. Conjunto fechado de
 * codigos — como arrays `as const` + tipo derivado, mesma convencao do
 * EFOS Core (efos/domain/enums/*). Puramente estrutural, nenhuma
 * logica de negocio.
 *
 * Distinto de `ApplicationError` (efos/application/contracts/
 * ApplicationError.ts): este arquivo define o vocabulario de codigos
 * possiveis; `ApplicationError` e a forma do erro que usa esse
 * vocabulario como campo `code`.
 */
export const APPLICATION_ERROR_CODES = [
  "not_found",
  "invalid_input",
  "conflict",
  "unauthorized",
  "unexpected",
] as const;
export type ApplicationErrorCode = (typeof APPLICATION_ERROR_CODES)[number];
