# Application Layer — Composition Root

Status: **implementado (Mission 024 — Composition Root; estendido na Mission 026; construtor recebe `ExecutionRepository` desde a Mission 037, repassado a `DefaultEFOSFacade` desde a Mission 066).** Ponto único de montagem de todos os componentes concretos do EFOS — toda a instanciação (`new`) de `EFOSPipelineRuntime`, `DefaultDocumentIntake`, `DefaultAnalysisService`, `DefaultReportService` e `DefaultEFOSFacade` acontece exclusivamente aqui. Nenhum Controller, API, UI ou consumidor futuro deve conhecer implementações concretas — apenas `EFOSContainer.getFacade()`.

## Responsabilidade

`DefaultEFOSContainer` monta, na ordem oficial, a cadeia completa de dependências da Application Layer:

```
EFOSPipelineRuntime (implementa EFOSPipelineOrchestrator)
DocumentIntake (DefaultDocumentIntake — sem dependências, Mission 026)
ExecutionRepository (recebido via construtor do Container, Mission 037 — nunca instanciado aqui)
        ↓
AnalysisService (DefaultAnalysisService — recebe o Orchestrator + o DocumentIntake)
        ↓
ReportService (DefaultReportService — sem dependências)
        ↓
EFOSFacade (DefaultEFOSFacade — recebe os dois Services + o ExecutionRepository, desde a Mission 066)
```

Nada além disso. O Container não conhece Engines, Domain, DTOs ou regra de negócio — apenas monta o grafo de objetos, uma vez, no construtor. Desde a Mission 037, o construtor do próprio Container recebe `executionRepository: ExecutionRepository` de fora — nunca instancia uma implementação concreta (ex.: `SupabaseExecutionRepository`, `efos/infrastructure/repositories/`) internamente, porque a Application Layer nunca importa a Infrastructure Layer diretamente (`docs/AI_START.md`, ordem de dependências). Quem monta um `SupabaseExecutionRepository` real e o passa para `new DefaultEFOSContainer(executionRepository)` é um futuro ponto de composição fora de `efos/`, ainda não construído. **Desde a Mission 066 (D-038, revisando D-028)**, o Container passou a repassar `executionRepository` para `DefaultEFOSFacade` em vez de `DefaultAnalysisService` — a assinatura pública do construtor do Container não mudou.

## Contrato

`EFOSContainer` (`EFOSContainer.ts`) tem um único método público:

```ts
getFacade(): EFOSFacade
```

Nenhum outro método nesta missão. Quem consome o Container nunca vê `EFOSPipelineRuntime`, `DefaultDocumentIntake`, `DefaultAnalysisService`, `DefaultReportService` ou `DefaultEFOSFacade` — apenas o contrato `EFOSFacade` (`efos/application/facade/EFOSFacade.ts`, Mission 023) devolvido por `getFacade()`.

## `DefaultEFOSContainer`

Primeira implementação concreta. O construtor monta a cadeia inteira uma única vez:

1. `new EFOSPipelineRuntime()` — tipado como `EFOSPipelineOrchestrator` (a variável local usa o contrato, nunca o tipo concreto, mesmo após a instanciação) — reforça que tudo abaixo do Container só conhece o Orchestrator por contrato, nunca por implementação (D-002, D-018, D-020 preservadas).
2. `new DefaultDocumentIntake()` — tipado como `DocumentIntake` (Mission 026) — sem dependências.
3. `new DefaultAnalysisService(runtime, documentIntake)` — recebe o Orchestrator e o DocumentIntake via construtor (injeção de dependência já estabelecida na Mission 021, estendida na Mission 026) — desde a Mission 066, não recebe mais `executionRepository` (D-038).
4. `new DefaultReportService()` — sem dependências (Mission 022, nunca aciona o Orchestrator).
5. `new DefaultEFOSFacade(analysisService, reportService, executionRepository)` — recebe os dois Services e, desde a Mission 066, o `ExecutionRepository` via construtor (Mission 023, estendida por D-038) — `executionRepository` é o mesmo parâmetro recebido pelo construtor do Container, nunca instanciado aqui.

`getFacade()` devolve sempre a mesma instância (montada uma única vez no construtor) — nunca remonta o grafo a cada chamada.

## Regra de exclusividade — "apenas aqui `new`"

Esta é a única classe do sistema autorizada a instanciar `EFOSPipelineRuntime`, `DefaultDocumentIntake`, `DefaultAnalysisService`, `DefaultReportService` ou `DefaultEFOSFacade`. Nenhum outro arquivo da Application Layer, e nenhum consumidor futuro (Controller, API, UI), deve conter `new EFOSPipelineRuntime()`, `new DefaultDocumentIntake()`, `new DefaultAnalysisService(...)`, `new DefaultReportService()` ou `new DefaultEFOSFacade(...)` — sempre através de `EFOSContainer.getFacade()` (D-021, estendida a `DocumentIntake` por D-022).

## Dependências permitidas

- `efos/application/orchestrators` (`EFOSPipelineRuntime`, `EFOSPipelineOrchestrator`).
- `efos/application/intake` (`DefaultDocumentIntake`, `DocumentIntake`) — Mission 026.
- `efos/application/services` (`DefaultAnalysisService`, `AnalysisService`, `DefaultReportService`, `ReportService`).
- `efos/application/facade` (`DefaultEFOSFacade`, `EFOSFacade`).
- `efos/application/persistence` (`ExecutionRepository`) — apenas por tipo, para o parâmetro `executionRepository` recebido pelo construtor do Container (Mission 037), repassado a `DefaultEFOSFacade` desde a Mission 066.

## Dependências proibidas

- **Engines** (`efos/engines/*`) — o Container nunca importa um Engine; isso pertence a `EFOSPipelineRuntime`.
- **Domain** (`efos/domain`) — o Container nunca importa entidades/agregados.
- **DTOs/Aggregates/regra financeira novos** — o Container é apenas montagem, nenhuma lógica.
- **HTTP/API/Controllers/Next.js/React/Supabase/Banco/Persistência/UI** — mesma restrição de toda a Application Layer (`efos/application/README.md`).
- **Infrastructure Layer** (`efos/infrastructure/*`, ex.: `SupabaseExecutionRepository`) — o Container nunca importa uma implementação concreta; recebe `ExecutionRepository` já pronto via construtor (Mission 037), preservando a ordem Domain → Domain Events → EFOS Engines → Application → Experience → Infrastructure (`docs/AI_START.md`).
