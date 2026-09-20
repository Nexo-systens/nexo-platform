# CONTEXT

Resumo do projeto NEXO, suficiente para qualquer nova conversa continuar o desenvolvimento sem depender do histórico do chat.

---

## Objetivo da NEXO

NEXO é uma plataforma financeira executiva B2B. Diferente de um ERP ou dashboard financeiro convencional, o objetivo declarado não é exibir números — é produzir **entendimento**: por que um número mudou, o que isso significa para a empresa, e o que fazer a respeito (`docs/03_PRODUCT/01_PRODUCT VISION.md`, "Não entregamos dashboards. Entregamos entendimento.").

## Objetivo do EFOS

EFOS (Executive Financial Operating System) é o nome interno da arquitetura/tecnologia que sustenta a NEXO — nunca usado externamente como nome de produto (`docs/PROJECT_RULES.md`, REGRA 14: EFOS e NEXO nunca devem ser conflados). Um EFOS integra múltiplas fontes de dados financeiros em um modelo unificado e produz, de forma determinística sempre que possível: diagnóstico, contexto, raciocínio explicável, simulação de cenários, recomendação de ação e registro de decisão — as 8 capacidades centrais definidas em `docs/00_FUNDACION/00_MANIFESTO.md`: Capturar, Organizar, Compreender, Raciocinar, Simular, Recomendar, Executar, Aprender.

O fluxo de raciocínio oficial (`docs/00_FUNDACION/03_EFOS REASONING MODEL.md`) é:

```
Dados → Informações → Evidências → Contexto → Hipóteses → Raciocínio → Simulação → Recomendação → Decisão
```

com bandas de confiança explícitas em cada etapa: 0–40% fraca, 40–70% moderada, 70–90% alta, 90–100% muito alta. Nenhuma conclusão é apresentada sem seu nível de confiança e sua origem (proveniência).

## Visão de produto

Cinco experiências-alvo definem a interface executiva (`docs/03_PRODUCT/03_EXECUTIVE JOURNEY.md`): Executive Overview, Decision Center, Executive Chat, Scenario Lab, Knowledge Timeline. Nenhuma delas está implementada ainda — a Experience atual (`app/`) reflete um modelo de produto anterior, pré-EFOS (Sidebar por módulo + Dashboard de cards), mantido funcional mas identificado como dívida de produto (ver `docs/ARCHITECTURE_AUDIT.md` e [ARCHITECTURE.md](ARCHITECTURE.md), seção Camadas → Experience).

## Contexto de negócio

Usuário final é o executivo/gestor de uma empresa (não um contador ou analista operacional) — a interface e a linguagem devem ser executivas, não técnicas ou contábeis. Cada empresa (`companies`) pertence a um usuário (`user_id`); todos os dados financeiros (documentos, indicadores, modelo financeiro) são escopados por empresa.

## Estratégia arquitetural

Duas camadas de sistema coexistem hoje no mesmo repositório (`nexo-platform/`), com fronteira explícita e ainda não integrada:

1. **Plataforma** — Next.js 16 + Supabase, autenticação, CRUD de empresas e documentos, Storage. Funcional e validada por build. Ver `docs/ARCHITECTURE_AUDIT.md`.
2. **EFOS Core** (`efos/`) — pipeline de 10 Engines na cadeia principal + 1 Engine auxiliar (Domain-Driven, Clean Architecture, SOLID), construído de forma incremental e isolada da Plataforma, sem nenhuma integração ainda entre os dois. Ver [ARCHITECTURE.md](ARCHITECTURE.md) para o detalhamento completo.

A estratégia deliberada (`docs/PROJECT_RULES.md`) foi construir o EFOS Core como um sistema correto e testável isoladamente primeiro — domínio puro, depois Engines um de cada vez, cada um com escopo único por missão — antes de conectá-lo à Plataforma via uma futura Application Layer. Essa fase está concluída: toda a cadeia principal do pipeline está implementada (Mission 015). A próxima fase natural é justamente essa Application Layer, ainda não iniciada.

## Pipeline oficial do EFOS Core

Cadeia principal (`efos/types/pipeline.ts`, `EFOS_PIPELINE`, reconciliada na Mission 014 — D-012):

```
Data → Financial Model → Indicators → Financial Knowledge Graph → Evidence →
Context → Reasoning → Recommendation → Decision → Learning
```

**Simulation** existe como Engine do EFOS Core, mas não é um estágio dessa cadeia — é um Engine **auxiliar/opcional** de projeção de cenários ("what-if"), consumido sob demanda, nunca um pré-requisito de execução de nenhum outro Engine (D-012). Ver [ARCHITECTURE.md](ARCHITECTURE.md), seção "Simulation Engine (auxiliar)", para o racional completo.

## Estado atual

Ver [HANDOFF.md](HANDOFF.md) para o estado detalhado e atualizado a cada missão. Resumo:

- **Plataforma**: autenticação, Workspace, Empresas (CRUD completo), Documentos (upload/listagem/download/exclusão lógica) implementados e validados por build.
- **EFOS Core**: **os 10 Engines da cadeia principal estão implementados** — Data, Financial Model, Indicators, Financial Knowledge Graph, Evidence, Context, Reasoning, Recommendation, Decision e Learning (Missions 004–015). O **Simulation Engine** é o único ainda sem implementação real — auxiliar, fora da cadeia principal (D-012). Domain modelado por completo, incluindo todas as extensões autorizadas por missão (D-003 a D-013 — ver [DECISIONS.md](DECISIONS.md)).
- **Documentação**: `docs/ARCHITECTURE.md`, `docs/CONTEXT.md` (este arquivo) e `docs/ROADMAP.md` foram preenchidos na Mission 006; mantidos sincronizados a cada missão de Engine desde então. `docs/CONTEXT.md` foi ressincronizado na Mission 016.5 (EFOS Core Cleanup) após ficar desatualizado entre as Missions 006 e 016.

## Tecnologias

- **Next.js 16.2.10** — atenção: convenções divergem do Next.js clássico nesta versão (ex.: `proxy.ts`/`proxy()` no lugar de `middleware.ts`/`middleware()`). Sempre consultar `node_modules/next/dist/docs/` antes de assumir comportamento.
- **React 19.2.4**, TypeScript, Tailwind CSS v4.
- **shadcn/ui**, estilo "base-nova", construído sobre `@base-ui/react` (não Radix).
- **Supabase** (Postgres, Auth, Storage, RLS) via `@supabase/ssr`.
- **Zod v4.4.3** — API com diferenças relevantes da v3 (ex.: `z.email()` top-level).
- **React Hook Form** + `@hookform/resolvers ^5.4.0` (versão fixada por incompatibilidade real com Zod v4 encontrada e corrigida na Sprint 02).

## Componentes implementados

- `proxy.ts`, `lib/supabase/{client,server,proxy}.ts` — Infraestrutura de autenticação/sessão.
- `modules/auth/**`, `modules/workspace/**`, `modules/companies/**`, `modules/documents/**`, `modules/dashboard/**` — módulos de produto da Plataforma.
- `app/(auth)/**`, `app/(app)/**` — rotas.
- `components/ui/**`, `components/shared/**` — biblioteca de componentes.
- `efos/types/`, `efos/interfaces/`, `efos/domain/`, `efos/shared/` — fundação completa do EFOS Core.
- `efos/engines/{data,financial-model,indicators,financial-knowledge-graph,evidence,context,reasoning,recommendation,decision,learning}/` — os 10 Engines da cadeia principal, todos com lógica real (Missions 004–015).

## Componentes pendentes

- **Simulation Engine** — único Engine do EFOS Core sem implementação real; auxiliar, fora da cadeia principal (D-012).
- Application Layer — orquestração entre Engines. Não existe ainda; nenhuma rota da Plataforma chama um Engine hoje.
- Domain Events — conceito reservado, não implementado.
- Integração entre EFOS Core e Plataforma.
- Experience executiva alinhada à visão de produto EFOS (as 5 experiências-alvo).
- Extração/OCR de documento binário → `RawFinancialLine[]` (pré-requisito real do Data Engine, hoje assumido como já pronto).
- Captura da escolha humana real sobre uma `Decision` (accept/reject, quem, quando) — conceito removido do domínio na Mission 013 (D-011), ainda não recriado; bloqueia `Outcome`/`Knowledge` de serem consumidos por qualquer Engine futuro.

## Regras fundamentais

Lista completa em [PROJECT_RULES.md](PROJECT_RULES.md). As mais estruturais para qualquer nova sessão:

- Domínio puro: `efos/domain/` nunca importa de nenhuma outra camada, nunca contém lógica de negócio.
- Um Engine, uma responsabilidade; Engines comunicam intenção (contratos de tipo), nunca implementação (chamada de `execute()` entre eles — D-002).
- Escopo único por missão (REGRA 9) — nunca expandir o pedido de uma missão além do que foi explicitamente solicitado.
- EFOS é o nome da arquitetura; NEXO é o nome do produto — nunca conflar.
- Toda missão deve encerrar com type-check, lint e build limpos.
