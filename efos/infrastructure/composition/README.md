# Infrastructure — Composition Root

Status: **implementado (Mission 038 — Infrastructure Composition).** Único ponto responsável por montar a cadeia completa que liga um `SupabaseClient` já criado até um `EFOSContainer` (`efos/application/composition/EFOSContainer.ts`, Mission 024) pronto para uso.

## Responsabilidade

`DefaultInfrastructureContainer` monta, na ordem oficial:

```
SupabaseClient (recebido via construtor, nunca criado aqui)
        ↓
SupabasePersistenceClient (efos/infrastructure/providers/, Mission 032 — implementa PersistenceClient)
        ↓
SupabaseExecutionRepository (efos/infrastructure/repositories/, Mission 030/033–035 — implementa ExecutionRepository)
        ↓
DefaultEFOSContainer (efos/application/composition/, Mission 024/037 — D-028)
```

Apenas montagem — nenhuma regra de negócio, nenhum cálculo, nenhum acesso a Engine/Domain diretamente. `getContainer()` devolve sempre a mesma instância de `EFOSContainer` (construída uma única vez no construtor).

## Por que esta peça existe (Mission 037, D-028)

`DefaultEFOSContainer` (`efos/application/composition/DefaultEFOSContainer.ts`) passou a receber `executionRepository: ExecutionRepository` via construtor na Mission 037, em vez de instanciar uma implementação concreta internamente — porque a Application Layer nunca importa a Infrastructure Layer diretamente (`docs/AI_START.md`, ordem de dependências: Domain → Domain Events → EFOS Engines → Application → Experience → Infrastructure). Isso deixou em aberto: quem monta o `SupabaseExecutionRepository` real e o passa para o Container? `DefaultInfrastructureContainer` é essa peça — vive na Infrastructure Layer, que **pode** importar a Application Layer (o inverso é que é proibido), então é o lugar correto para conhecer os dois lados e montá-los.

## `DefaultInfrastructureContainer`

Único método público: `getContainer(): EFOSContainer`. O construtor recebe `supabaseClient: SupabaseClient` (`@supabase/supabase-js`) já criado — **nunca** chama `createClient()`/`createBrowserClient()`/`createServerClient()` internamente, mesmo princípio já estabelecido por `SupabasePersistenceClient` (D-026): reutiliza qualquer instância já criada pelas fábricas existentes da Plataforma (`lib/supabase/client.ts`/`server.ts`), nunca cria uma segunda.

## Dependências permitidas

- `efos/application/composition` (`EFOSContainer`, `DefaultEFOSContainer`).
- `efos/infrastructure/providers` (`SupabasePersistenceClient`).
- `efos/infrastructure/repositories` (`SupabaseExecutionRepository`).
- `@supabase/supabase-js` (tipo `SupabaseClient` apenas — nunca `createClient()`).

## Dependências proibidas

- **Domain** (`efos/domain`) — nunca importado aqui.
- **Next.js/React/HTTP** — esta peça não sabe que existe uma rota, um componente ou um framework; quem a instancia (uma futura camada de bootstrap da Plataforma) é que conhece esses detalhes.
- **Criação de client Supabase** — sempre recebido já pronto via construtor, nunca criado aqui.
