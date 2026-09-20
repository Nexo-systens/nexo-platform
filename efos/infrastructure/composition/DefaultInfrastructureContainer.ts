import type { SupabaseClient } from "@supabase/supabase-js";

import type { EFOSContainer } from "@/efos/application/composition";
import { DefaultEFOSContainer } from "@/efos/application/composition";

import { SupabaseExecutionRepository } from "../repositories";
import { SupabasePersistenceClient } from "../providers";

/**
 * Composition Root oficial da Infrastructure Layer (Mission 038 —
 * Infrastructure Composition). Único lugar responsável por montar a
 * cadeia completa que liga um `SupabaseClient` já criado até um
 * `EFOSContainer` (`efos/application/composition/EFOSContainer.ts`,
 * Mission 024) pronto para uso:
 *
 * ```
 * SupabaseClient (recebido via construtor, nunca criado aqui)
 *         ↓
 * SupabasePersistenceClient (implementa PersistenceClient, Mission 032)
 *         ↓
 * SupabaseExecutionRepository (implementa ExecutionRepository, Mission 030/033–035)
 *         ↓
 * DefaultEFOSContainer (Composition Root da Application Layer, Mission 024/037 — D-028)
 * ```
 *
 * Recebe `supabaseClient: SupabaseClient` via construtor — nunca chama
 * `createClient()`/`createBrowserClient()`/`createServerClient()`
 * internamente, mesmo princípio já estabelecido por
 * `SupabasePersistenceClient` (D-026): reutiliza qualquer instância já
 * criada por quem monta este Container (ex.: `lib/supabase/client.ts`/
 * `server.ts`), nunca cria uma segunda.
 *
 * Esta é a peça que resolve a pendência deixada pela Mission 037
 * (D-028): `DefaultEFOSContainer` passou a receber `ExecutionRepository`
 * via construtor porque a Application Layer nunca importa a
 * Infrastructure Layer diretamente (`docs/AI_START.md`, ordem de
 * dependências) — `DefaultInfrastructureContainer` é o ponto de
 * composição que sabe montar os dois lados, precisamente porque a
 * Infrastructure Layer pode importar a Application Layer (o inverso é
 * que é proibido).
 */
export class DefaultInfrastructureContainer {
  private readonly container: EFOSContainer;

  constructor(supabaseClient: SupabaseClient) {
    const persistenceClient = new SupabasePersistenceClient(supabaseClient);
    const executionRepository = new SupabaseExecutionRepository(
      persistenceClient
    );

    this.container = new DefaultEFOSContainer(executionRepository);
  }

  getContainer(): EFOSContainer {
    return this.container;
  }
}
