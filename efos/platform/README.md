# EFOS — Platform

Status: **implementado (Mission 040 — First Platform Entry Point); `documents` conectado de ponta a ponta desde a Mission 044 — End-to-End Document Flow, D-032).** Primeiro ponto oficial de entrada da plataforma EFOS — a peça que um consumidor real da Plataforma (uma Server Action, rota) deve instanciar e chamar.

## Responsabilidade

`EFOSPlatform` fecha, do lado do chamador, a cadeia de composição já montada pelo Bootstrap:

```
SupabaseClient (recebido via construtor, nunca criado aqui)
        ↓
EFOSBootstrap (efos/bootstrap/, Mission 039)
        ↓
EFOSFacade (getFacade())
        ↓
analyzeCompany(companyId, documents?) → AnalysisService → PipelineContext.metadata.documents →
EFOSPipelineRuntime → Data Engine → ... → ExecutionRepository (persistência automática, D-028) → ExecutiveReport
        ↓
retorno ao chamador (ApplicationResult<ExecutiveReport>)
```

Dois métodos públicos: `analyzeCompany(companyId: string, documents?: readonly RawFinancialDocument[]): Promise<ApplicationResult<ExecutiveReport>>` e, desde a Mission 175 — Production Executive Analysis API, `analyzeCompanyWithExecutiveContext(companyId: string, documents?: readonly RawFinancialDocument[]): Promise<ApplicationResult<{report: ExecutiveReport; executiveContext?: ExecutiveFinancialContext}>>` — espelha `analyzeCompany()` byte a byte, repassando apenas para o método ADITIVO já existente em `EFOSFacade` desde a Mission 173 (`facade.analyzeCompanyWithExecutiveContext()`). Nunca uma segunda pipeline: ambos os métodos desta classe repassam para a MESMA `facade` já montada pelo Bootstrap. Consumido por `POST /api/efos/analyze/[companyId]/executive` (Mission 175) — rota dedicada, nunca uma extensão de `POST /api/efos/analyze/[companyId]` (que continua chamando apenas `analyzeCompany()`, byte a byte inalterado).

## Documentos

Desde a Mission 044 (End-to-End Document Flow, D-032), `documents` é um segundo parâmetro opcional (default `[]`) — mesmo padrão já usado por `AnalysisService.analyze()` (Mission 026, D-022) e por `EFOSFacade.analyzeCompany()` (Mission 044) — repassado sem transformação para `facade.analyzeCompany(request, documents)`. Isso fecha a lacuna registrada em D-031: um chamador com documentos reais (ex.: `app/api/efos/upload/route.ts`, Mission 042/043) agora consegue fazê-los chegar até `PipelineContext.metadata.documents` e o Data Engine. Chamadores que não passam `documents` (ex.: `app/api/efos/analyze/[companyId]/route.ts`, Mission 041) continuam funcionando sem alteração — `documents` usa o valor padrão `[]`. `EFOSPlatform` não cria mock nenhum, não sintetiza documento fictício algum — apenas monta `AnalyzeCompanyRequest` (`{ companyId }`) e repassa, junto de `documents`, para a `EFOSFacade`.

## `EFOSPlatform`

Recebe `supabaseClient: SupabaseClient` (`@supabase/supabase-js`) já criado via construtor — **nunca** chama `createClient()`/`createBrowserClient()`/`createServerClient()` internamente, mesmo princípio já estabelecido por `SupabasePersistenceClient` (D-026), `DefaultInfrastructureContainer` (D-029) e `EFOSBootstrap`: reutiliza qualquer instância já criada pelas fábricas existentes da Plataforma (`lib/supabase/client.ts`/`server.ts`), nunca cria uma segunda. Internamente, instancia `new EFOSBootstrap(supabaseClient)` e guarda a `EFOSFacade` que ele expõe — nunca executa Engines, Runtime ou Services diretamente.

## Dependências permitidas

- `efos/bootstrap` (`EFOSBootstrap`).
- `efos/application/contracts` (`ApplicationResult`), `efos/application/dto` (`AnalyzeCompanyRequest`), `efos/application/facade` (`EFOSFacade`), `efos/application/report` (`ExecutiveReport`) — todos apenas por tipo, exceto `EFOSBootstrap` que é instanciado.
- `@/efos/engines/data` (`RawFinancialDocument`) — apenas por tipo, para o parâmetro `documents` de `analyzeCompany()` (Mission 044).
- `@supabase/supabase-js` (tipo `SupabaseClient` apenas — nunca `createClient()`).

## Dependências proibidas

- **Next.js/React/HTTP/UI** — esta peça não sabe que existe uma rota, um componente ou um framework; quem a instancia (uma futura Server Action/rota) é que conhece esses detalhes.
- **Domain/Engines/Runtime/Infrastructure/Repository/Persistence/Bootstrap/Facade concretos** — `EFOSPlatform` nunca instancia nenhuma dessas implementações diretamente, apenas `EFOSBootstrap` (via construtor) e a `EFOSFacade` já pronta que ele devolve.
- **Documentos mock/fictícios** — `documents` sempre usa o valor padrão oficial (`[]`), nunca um documento sintetizado por esta camada.
