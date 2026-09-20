import type { SupabaseClient } from "@supabase/supabase-js";

import type { EFOSFacade } from "@/efos/application/facade";
import { DefaultInfrastructureContainer } from "@/efos/infrastructure/composition";

/**
 * Bootstrap oficial do EFOS (Mission 039 — EFOS Bootstrap). Único
 * ponto responsável por iniciar toda a plataforma — o topo da cadeia
 * de composição que começa em `DefaultInfrastructureContainer`
 * (`efos/infrastructure/composition/`, Mission 038):
 *
 * ```
 * SupabaseClient (recebido via construtor, nunca criado aqui)
 *         ↓
 * DefaultInfrastructureContainer (Mission 038)
 *         ↓
 * EFOSContainer (getContainer())
 *         ↓
 * EFOSFacade (getFacade())
 * ```
 *
 * Apenas montagem — nunca executa análise, nunca aciona Engines,
 * Runtime, Services ou a própria Facade; apenas monta a cadeia e
 * devolve `EFOSFacade` pronta para quem a consumir chamar
 * `analyzeCompany()`. Recebe `supabaseClient: SupabaseClient` via
 * construtor — nunca chama `createClient()`/`createBrowserClient()`/
 * `createServerClient()` internamente, mesmo princípio já estabelecido
 * por `SupabasePersistenceClient` (D-026) e `DefaultInfrastructureContainer`
 * (D-029): reutiliza qualquer instância já criada por quem o instancia
 * (ex.: `lib/supabase/client.ts`/`server.ts`), nunca cria uma segunda.
 *
 * Único método público: `getFacade(): EFOSFacade`. Nenhuma outra
 * responsabilidade — o Bootstrap não sabe como `EFOSFacade` foi
 * montada por dentro (isso pertence a `DefaultInfrastructureContainer`/
 * `DefaultEFOSContainer`), apenas expõe o resultado já pronto.
 */
export class EFOSBootstrap {
  private readonly facade: EFOSFacade;

  constructor(supabaseClient: SupabaseClient) {
    const infrastructureContainer = new DefaultInfrastructureContainer(
      supabaseClient
    );
    const container = infrastructureContainer.getContainer();

    this.facade = container.getFacade();
  }

  getFacade(): EFOSFacade {
    return this.facade;
  }
}
