# EFOS — Bootstrap

Status: **implementado (Mission 039 — EFOS Bootstrap).** Único ponto oficial responsável por iniciar toda a plataforma — o topo da cadeia de composição, acima da Application Layer e da Infrastructure Layer.

## Responsabilidade

`EFOSBootstrap` monta, na ordem oficial:

```
SupabaseClient (recebido via construtor, nunca criado aqui)
        ↓
DefaultInfrastructureContainer (efos/infrastructure/composition/, Mission 038)
        ↓
EFOSContainer (getContainer())
        ↓
EFOSFacade (getFacade())
```

Apenas montagem — **nunca** executa análise, nunca aciona Engines, Runtime, Services ou a própria Facade. Único método público: `getFacade(): EFOSFacade`.

## Por que este componente existe

Com a Mission 038 (Infrastructure Composition, D-029), já existia um caminho completo de tipos entre um `SupabaseClient` real e um `EFOSContainer` funcional (`DefaultInfrastructureContainer`), mas nenhum ponto único e oficial expunha diretamente a peça que a Plataforma realmente precisa consumir: `EFOSFacade` (`efos/application/facade/EFOSFacade.ts`, Mission 023 — "toda a Plataforma NEXO deve conversar com o EFOS através deste contrato"). `EFOSBootstrap` fecha essa cadeia — é o primeiro (e único) lugar que um consumidor real da Plataforma (uma Server Action, uma rota, um script) deveria chamar para obter uma `EFOSFacade` pronta para uso, sem precisar conhecer `DefaultInfrastructureContainer`, `EFOSContainer`, `DefaultEFOSContainer` ou qualquer implementação concreta intermediária.

## `EFOSBootstrap`

Recebe `supabaseClient: SupabaseClient` (`@supabase/supabase-js`) já criado via construtor — **nunca** chama `createClient()`/`createBrowserClient()`/`createServerClient()` internamente, mesmo princípio já estabelecido por `SupabasePersistenceClient` (D-026) e `DefaultInfrastructureContainer` (D-029): reutiliza qualquer instância já criada pelas fábricas existentes da Plataforma (`lib/supabase/client.ts`/`server.ts`), nunca cria uma segunda.

## Dependências permitidas

- `efos/infrastructure/composition` (`DefaultInfrastructureContainer`).
- `efos/application/facade` (`EFOSFacade`, apenas por tipo — o Bootstrap nunca instancia `DefaultEFOSFacade` diretamente, recebe a instância já pronta de `EFOSContainer.getFacade()`).
- `@supabase/supabase-js` (tipo `SupabaseClient` apenas — nunca `createClient()`).

## Dependências proibidas

- **Domain** (`efos/domain`) — nunca importado aqui.
- **Engines** (`efos/engines/*`) — o Bootstrap nunca conhece Engines; qualquer execução de pipeline passa exclusivamente pela `EFOSFacade` já montada.
- **Next.js/React/HTTP** — esta peça não sabe que existe uma rota, um componente ou um framework; quem a instancia (uma futura Server Action/rota) é que conhece esses detalhes.
- **Execução de análise** — `EFOSBootstrap` nunca chama `facade.analyzeCompany(...)`; apenas monta e devolve a `EFOSFacade`, quem a consome decide quando/como chamá-la.
