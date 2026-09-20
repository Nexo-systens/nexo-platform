import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PersistenceClient,
  PersistenceQuery,
  PersistenceResult,
} from "../shared";

/**
 * Primeira implementação concreta de `PersistenceClient`
 * (`efos/infrastructure/shared/PersistenceClient.ts`, Mission 031) na
 * Infrastructure Layer (Mission 032 — Supabase Persistence Client).
 *
 * Recebe um `SupabaseClient` já criado via construtor — nunca chama
 * `createClient()`/`createBrowserClient()`/`createServerClient()`
 * internamente, nunca cria uma segunda instância de client. O projeto
 * já possui três fábricas de client (`lib/supabase/client.ts`,
 * `lib/supabase/server.ts`, `lib/supabase/proxy.ts`) — esta classe
 * reutiliza qualquer instância já criada por elas, apenas traduzindo
 * `PersistenceQuery`/`PersistenceResult` para a API oficial do SDK
 * (`.from().insert()/.update()/.select()/.delete()`), nunca SQL manual.
 *
 * Tipado como `SupabaseClient` genérico (sem o parâmetro `Database`
 * de `types/database.ts`) deliberadamente: `PersistenceQuery.collection`
 * é uma `string` neutra, não restrita aos nomes de tabela conhecidos
 * pelo schema da Plataforma, então amarrar este client ao tipo
 * `Database` quebraria a promessa de D-025 (a abstração de
 * persistência precisa continuar válida para qualquer coleção, não
 * apenas para as tabelas hoje existentes). `.from(query.collection)`
 * perde a checagem estática de nome/coluna de tabela como
 * consequência direta disso.
 *
 * Limitação conhecida: nenhuma tabela relacionada a execução do EFOS
 * existe hoje em `types/database.ts` (apenas `companies`, `users`,
 * `documents`). Os quatro métodos abaixo estão implementados de forma
 * genérica contra a API oficial do Supabase e funcionam para qualquer
 * `collection` que exista de fato no banco — mas uma chamada com
 * `collection: "executions"` (ou qualquer nome ainda não migrado)
 * falhará em tempo de execução com um erro do Postgres (relação
 * inexistente), reportado via `PersistenceResult.error`. Criar essa
 * tabela está fora do escopo desta missão.
 */
export class SupabasePersistenceClient implements PersistenceClient {
  constructor(private readonly supabaseClient: SupabaseClient) {}

  async insert(query: PersistenceQuery): Promise<PersistenceResult> {
    const { data, error } = await this.supabaseClient
      .from(query.collection)
      .insert(query.data ?? {})
      .select();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? undefined };
  }

  async update(query: PersistenceQuery): Promise<PersistenceResult> {
    let builder = this.supabaseClient.from(query.collection).update(query.data ?? {});
    builder = this.applyFilters(builder, query.filters);
    const { data, error } = await builder.select();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? undefined };
  }

  async select(query: PersistenceQuery): Promise<PersistenceResult> {
    let builder = this.supabaseClient.from(query.collection).select("*");
    builder = this.applyFilters(builder, query.filters);
    const { data, error } = await builder;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? undefined };
  }

  async delete(query: PersistenceQuery): Promise<PersistenceResult> {
    let builder = this.supabaseClient.from(query.collection).delete();
    builder = this.applyFilters(builder, query.filters);
    const { data, error } = await builder.select();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? undefined };
  }

  /**
   * `builder` é deliberadamente `any` aqui: o tipo real devolvido por
   * `.update()/.select()/.delete()` do SDK do Supabase é um generic
   * profundamente recursivo (`PostgrestFilterBuilder<...>`) — como
   * `query.collection` é uma `string` neutra (não uma chave literal de
   * `Database`), o compilador não consegue resolver esse generic sem
   * estourar o limite de profundidade de instanciação (TS2589).
   * `.eq()` continua sendo a API oficial do SDK, nunca SQL manual;
   * apenas a assinatura deste método auxiliar interno abre mão da
   * checagem estática de tipo do builder para permanecer genérico
   * sobre `insert`/`update`/`select`/`delete`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyFilters(builder: any, filters: PersistenceQuery["filters"]): any {
    if (!filters) {
      return builder;
    }

    return Object.entries(filters).reduce(
      (acc, [column, value]) => acc.eq(column, value),
      builder
    );
  }
}
