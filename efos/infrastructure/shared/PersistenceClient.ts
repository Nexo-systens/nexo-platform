import type { PersistenceQuery } from "./PersistenceQuery";
import type { PersistenceResult } from "./PersistenceResult";

/**
 * Abstração oficial do cliente de persistência da Infrastructure
 * Layer (Mission 031 — Persistence Client Abstraction). Contrato
 * puro — nenhuma implementação concreta, nenhuma conexão, nenhum SDK,
 * nenhum Supabase nesta missão.
 *
 * Objetivo: qualquer mecanismo futuro de persistência — Supabase,
 * PostgreSQL, SQLite, um Mock, ou um client de testes — deve poder
 * implementar exatamente este mesmo contrato, sem que nenhum
 * Repository concreto (ex.: `SupabaseExecutionRepository`,
 * `efos/infrastructure/repositories/`) precise conhecer qual
 * mecanismo está por trás dele.
 *
 * Quatro operações, todas recebendo `PersistenceQuery` (consulta
 * declarativa) e devolvendo `Promise<PersistenceResult>` (retorno
 * padronizado) — nenhum método tem corpo, nenhuma lógica de negócio.
 */
export interface PersistenceClient {
  insert(query: PersistenceQuery): Promise<PersistenceResult>;
  update(query: PersistenceQuery): Promise<PersistenceResult>;
  select(query: PersistenceQuery): Promise<PersistenceResult>;
  delete(query: PersistenceQuery): Promise<PersistenceResult>;
}
