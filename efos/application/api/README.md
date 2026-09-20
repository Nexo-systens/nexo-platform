# Application Layer — API

Status: **implementado (Mission 028 — REST API Layer).** Primeira camada HTTP oficial da NEXO — transporte-agnóstica: recebe uma requisição externa e a encaminha para o EFOS. Nenhum framework HTTP concreto (Next.js Route, Express, Fastify, Hono, Nest) é criado ou conhecido nesta missão.

## Responsabilidade

Receber uma requisição externa, transformá-la em `AnalyzeCompanyRequest`, chamar `EFOSHost` e devolver `AnalysisResponse`. Nada além disso — nenhuma regra de negócio.

## Fluxo

```
HTTP Request
        ↓
AnalysisRequest
        ↓
AnalysisController (DefaultAnalysisController)
        ↓
EFOSHost.getFacade()
        ↓
EFOSFacade.analyzeCompany()
        ↓
ExecutiveReport (ApplicationResult<ExecutiveReport>)
        ↓
AnalysisResponse
```

Uma futura rota HTTP concreta (Next.js Route, Server Action, ou qualquer outro transporte — fora do escopo desta missão) receberia a requisição, a converteria em `AnalysisRequest` e chamaria `AnalysisController.analyze()`.

## Contrato

`AnalysisController` (`AnalysisController.ts`) tem um único método:

```ts
analyze(request: AnalysisRequest): Promise<AnalysisResponse>
```

## `AnalysisRequest` / `AnalysisResponse`

- **`AnalysisRequest`** (`AnalysisRequest.ts`) — forma transporte-agnóstica da requisição externa: `{ companyId: string }`. Hoje espelha `AnalyzeCompanyRequest` (Mission 017) porque `EFOSFacade.analyzeCompany()` só aceita esse campo — mantido como tipo próprio, não um alias, para que a forma da requisição HTTP possa evoluir independentemente do DTO interno da Application Layer.
- **`AnalysisResponse`** (`AnalysisResponse.ts`) — união discriminada por `success`, mesmo espírito de `Result`/`ApplicationResult` (D-014): no sucesso, `{ success: true; report: ExecutiveReport }` (`efos/application/report/`, Mission 022, reaproveitado por completo); na falha, `{ success: false; error: ApplicationError }` (`efos/application/contracts/ApplicationError.ts`, reaproveitado, nenhum vocabulário de erro novo).

## `DefaultAnalysisController`

Primeira implementação concreta. Recebe `EFOSHost` (`efos/application/host/EFOSHost.ts`, Mission 025) via construtor — inversão de dependência, nunca instanciando `DefaultEFOSHost` nem `DefaultEFOSContainer` internamente. `analyze()`:

1. Transforma `AnalysisRequest` em `AnalyzeCompanyRequest` (`{ companyId: request.companyId }`).
2. Chama `this.host.getFacade().analyzeCompany(analyzeCompanyRequest)`.
3. Traduz o `ApplicationResult<ExecutiveReport>` recebido: na falha, repassa o mesmo `error`; no sucesso, `{ success: true, report: result.value }`.

Nenhuma regra de negócio, nenhum cálculo, nenhum acesso a Engine, Domain ou infraestrutura.

## Dependências permitidas

- `efos/application/dto` (`AnalyzeCompanyRequest`) — apenas por tipo.
- `efos/application/host` (`EFOSHost`) — via injeção de dependência, nunca `DefaultEFOSHost` diretamente.
- `efos/application/report` (`ExecutiveReport`) — apenas por tipo.
- `efos/application/contracts` (`ApplicationError`) — apenas por tipo.

## Dependências proibidas

- **Framework HTTP** (Next.js Route, Express, Fastify, Hono, Nest, `fetch`) — esta camada é transporte-agnóstica; nenhum deles é conhecido aqui.
- **`DefaultEFOSHost`/`DefaultEFOSContainer`** (as classes concretas) — `DefaultAnalysisController` depende apenas do contrato `EFOSHost`, recebido via construtor.
- **Engines** (`efos/engines/*`) — esta camada nunca executa um Engine.
- **Banco/Supabase/Middleware/Upload/UI/React** — nenhuma dependência de infraestrutura ou apresentação.
