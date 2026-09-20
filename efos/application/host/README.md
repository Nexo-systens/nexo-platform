# Application Layer — Host

Status: **implementado (Mission 025 — Application Host).** Porta de entrada oficial da Application Layer — o ponto único responsável por disponibilizar o `EFOSContainer` (indiretamente, via `EFOSFacade`) para qualquer consumidor externo. Não é HTTP, não é API, não é Next.js — apenas a fronteira que um consumidor externo usa para alcançar o EFOS.

## Responsabilidade

Uma única responsabilidade: fornecer acesso à `EFOSFacade` (`efos/application/facade/EFOSFacade.ts`, Mission 023). Nada mais.

- Nunca executa Engines.
- Nunca executa o Runtime.
- Nunca conhece o Domain (`efos/domain`).
- Nunca conhece Infrastructure (Supabase, banco, HTTP).

## Contrato

`EFOSHost` (`EFOSHost.ts`) tem um único método:

```ts
getFacade(): EFOSFacade
```

## `DefaultEFOSHost`

Primeira implementação concreta. Recebe `EFOSContainer` (`efos/application/composition/EFOSContainer.ts`, Mission 024) via construtor — inversão de dependência, nunca instanciado internamente (nunca `new DefaultEFOSContainer()` dentro desta classe). `getFacade()` apenas repassa a chamada para `this.container.getFacade()` — nenhuma lógica adicional, nenhuma regra de negócio.

## Fluxo completo

```
Host (EFOSHost / DefaultEFOSHost)
        ↓
Container (EFOSContainer / DefaultEFOSContainer, Mission 024)
        ↓
Facade (EFOSFacade / DefaultEFOSFacade, Mission 023)
        ↓
Services (AnalysisService, ReportService, Mission 021/022)
        ↓
Orchestrator (EFOSPipelineOrchestrator, Mission 018)
        ↓
Runtime (EFOSPipelineRuntime, Mission 019/020A/020B)
        ↓
EFOS Core (Engines, Mission 004–015)
```

O Host não pula nenhuma camada — ele só expõe o topo dessa cadeia (`EFOSFacade`) para quem o consumir. Toda a montagem continua acontecendo exclusivamente dentro de `DefaultEFOSContainer` (D-021); o Host não monta nada, apenas repassa o acesso.

## Por que um Host separado do Container

`EFOSContainer` (Mission 024) já expõe `getFacade()` — à primeira vista, `EFOSHost` parece redundante. A distinção é de responsabilidade: o Container é o Composition Root (onde a montagem acontece, `new` autorizado só ali); o Host é a porta de entrada pública que um consumidor externo (futura rota, Server Action, script) deve conhecer — depender de `EFOSHost` em vez de `EFOSContainer` diretamente mantém o vocabulário de "montagem" (Container) separado do vocabulário de "acesso externo" (Host), para que uma eventual mudança em como o Container monta o grafo de dependências nunca exija mudar o contrato que consumidores externos veem.

## Dependências permitidas

- `efos/application/facade` (`EFOSFacade`) — apenas por tipo.
- `efos/application/composition` (`EFOSContainer`) — apenas por tipo (contrato), nunca `DefaultEFOSContainer` diretamente.

## Dependências proibidas

- **`DefaultEFOSContainer`** (a classe concreta) — o Host depende apenas do contrato `EFOSContainer`, recebido via construtor.
- **Engines** (`efos/engines/*`), **Orchestrator/Runtime** (`EFOSPipelineOrchestrator`, `EFOSPipelineRuntime`), **Services concretos** (`DefaultAnalysisService`, `DefaultReportService`) — o Host nunca os conhece diretamente, só através do Container.
- **Domain** (`efos/domain`) — o Host nunca importa entidades/agregados.
- **HTTP/API/Controllers/Route/Next.js/React/Supabase/Banco/Persistência/UI** — mesma restrição de toda a Application Layer (`efos/application/README.md`).
