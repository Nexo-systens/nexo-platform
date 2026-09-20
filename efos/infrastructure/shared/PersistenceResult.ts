/**
 * Retorno padronizado de qualquer operação de persistência (Mission
 * 031 — Persistence Client Abstraction). Representação genérica —
 * nenhum tipo específico de banco (sem `PostgrestError` do Supabase,
 * sem código de erro SQL, sem driver algum).
 *
 * `error` é `string` (mensagem simples), não `ApplicationErrorCode`
 * (`efos/application/shared/Errors.ts`) — deliberado: esta camada
 * precisa continuar válida para qualquer mecanismo futuro (Supabase,
 * PostgreSQL, SQLite, Mock, Testes), e nem todo mecanismo produzirá
 * naturalmente um `ApplicationErrorCode`; traduzir `error` para esse
 * vocabulário é responsabilidade de quem consome `PersistenceResult`
 * (ex.: um futuro `SupabaseExecutionRepository` real), não desta
 * camada.
 */
export interface PersistenceResult<TData = unknown> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: string;
}
