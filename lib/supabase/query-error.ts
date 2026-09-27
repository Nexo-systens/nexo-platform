/**
 * Mission 203 — erro de consulta observável.
 *
 * Um HEAD/GET do PostgREST que falha com corpo vazio (todo HEAD tem
 * corpo vazio) vira, no postgrest-js, um objeto `{ message: "" }` sem o
 * status HTTP — exatamente o `Error: {"message":""}` visto no primeiro
 * `/dashboard` após o login no NEXO Pilot, impossível de diagnosticar.
 * Este helper NÃO engole o erro: devolve um `Error` para ser lançado,
 * com contexto, status HTTP e código do PostgREST — nunca ids,
 * parâmetros de consulta, nomes ou dados (D-129: o texto não vai ao
 * usuário; aparece só no log do servidor).
 */
export class QueryError extends Error {
  readonly status: number | null;
  readonly code: string | null;

  constructor(context: string, status: number | null, code: string | null) {
    super(`${context}: consulta falhou (HTTP ${status ?? "?"}${code ? `, ${code}` : ""})`);
    this.name = "QueryError";
    this.status = status;
    this.code = code;
  }
}

export function queryFailure(
  context: string,
  result: { readonly error: unknown; readonly status?: number | null }
): QueryError {
  const error = typeof result.error === "object" && result.error !== null ? (result.error as { code?: unknown }) : {};
  const code = typeof error.code === "string" && error.code.length > 0 ? error.code : null;
  return new QueryError(context, typeof result.status === "number" ? result.status : null, code);
}
