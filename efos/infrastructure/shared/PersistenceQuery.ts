/**
 * Consulta abstrata de persistência (Mission 031 — Persistence
 * Client Abstraction) — estrutura puramente declarativa. Nunca
 * contém SQL, nunca contém sintaxe específica do Supabase (`.eq()`,
 * `.match()`, filtros encadeados) ou de qualquer outro mecanismo
 * concreto. Descreve *o quê* consultar/gravar, nunca *como* — a
 * tradução para a sintaxe real (SQL, chamadas do SDK do Supabase,
 * etc.) é responsabilidade exclusiva de uma futura implementação
 * concreta de `PersistenceClient`, nunca desta estrutura.
 *
 * `collection` identifica onde operar (nome de tabela/coleção,
 * neutro em relação ao mecanismo real). `filters` e `data` são
 * sacolas de valores opacas (`Record<string, unknown>`) — a forma
 * real de cada uma depende do que uma implementação concreta
 * decidir suportar; nenhuma delas é inventada aqui além do
 * necessário para o contrato existir.
 */
export interface PersistenceQuery {
  readonly collection: string;
  readonly filters?: Readonly<Record<string, unknown>>;
  readonly data?: Readonly<Record<string, unknown>>;
}
