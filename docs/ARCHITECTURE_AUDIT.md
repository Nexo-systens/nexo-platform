# NEXO — Architecture Audit (ARCHITECTURE_AUDIT.md)

> **Status:** Auditoria técnica — documento de análise, sem implementação
> **Referência normativa:** Avaliado contra `docs/00_FUNDACION/*`, `docs/01_ARCHITECTURE/*` e `docs/03_PRODUCT/*` (fundação EFOS vigente) e contra o código real de `nexo-platform/` no momento da auditoria.
> **Metodologia:** Inventário completo do repositório (`app/`, `modules/`, `components/`, `lib/`, `supabase/`, `types/`) + leitura integral dos documentos de fundação + verificação do schema do banco remoto. Nenhum arquivo de código foi alterado, criado ou removido nesta missão.

---

## 0. Achado prévio — a fundação documental mudou por completo

Antes de auditar o código, é preciso registrar um fato que muda o critério de avaliação de tudo abaixo: **toda a pasta `docs/` foi substituída** entre a última missão de implementação e esta auditoria. Os documentos que orientaram as Missões 1–6.2 (`00_MASTER.md`, `01_PRODUCT.md`, `03_DATABASE.md`, `04_DESIGN_SYSTEM.md`, `05_FRONTEND.md`, `06_BACKEND.md`, `07_COMPONENTS.md`, `08_CLAUDE.md`, `09_NEXO_OS.md`, `10_ROADMAP.md`, `AI Integration.md`, e os dois documentos de arquitetura que eu mesmo produzi nas Missões 6.1/6.2 — `11_FINANCIAL_ENGINE.md` e `12_FINANCIAL_REASONING_GRAPH.md`) **não existem mais no disco**. Em seu lugar, existe uma nova fundação:

```
docs/00_FUNDACION/00_MANIFESTO.md
docs/00_FUNDACION/01_WHY EFOS.md
docs/00_FUNDACION/02_EFOS FUNDATION.md
docs/00_FUNDACION/03_EFOS REASONING MODEL.md
docs/00_FUNDACION/EXECUTIVE FINANCIAL ONTOLOGY.md
docs/01_ARCHITECTURE/04_DOMAIN MODEL.md
docs/01_ARCHITECTURE/06_EFOS CORE.md
docs/01_ARCHITECTURE/07_SOFTWARE ARCHITECTURE.md
docs/03_PRODUCT/01_PRODUCT VISION.md
docs/03_PRODUCT/02_JOBS TO BE DONE.md
docs/03_PRODUCT/03_EXECUTIVE JOURNEY.md
```

Isso não é um detalhe administrativo — é o achado mais importante desta auditoria. Toda a plataforma construída até agora (Missões 1–5) foi implementada contra a visão de produto antiga: um SaaS convencional com Sidebar/Dashboard de cards e módulos (Empresas, Documentos, Diagnósticos, Relatórios, Configurações). A nova fundação define a NEXO como um **Executive Financial Operating System**, com uma experiência de produto radicalmente diferente (`docs/03_PRODUCT/01_PRODUCT VISION.md`: cinco experiências — Executive Overview, Decision Center, Executive Chat, Scenario Lab, Knowledge Timeline — e a frase explícita "Não entregamos dashboards. Entregamos entendimento.").

Consequência direta: partes do código que estavam corretas em relação à documentação antiga hoje estão **desalinhadas com a visão vigente**, não porque foram malfeitas, mas porque a visão mudou por baixo delas. Cada avaliação abaixo leva isso em conta explicitamente.

Um segundo ponto de atenção decorrente disso: meus próprios documentos de arquitetura anteriores (`11_FINANCIAL_ENGINE.md`, pipeline de 10 estágios; `12_FINANCIAL_REASONING_GRAPH.md`, grafo de raciocínio) não foram incorporados à nova fundação — `docs/01_ARCHITECTURE/06_EFOS CORE.md` define uma decomposição diferente (9 engines: Data, Financial Model, Evidence, Context, Reasoning, Simulation, Recommendation, Decision, Learning) e `docs/00_FUNDACION/03_EFOS REASONING MODEL.md` define um modelo de raciocínio com granularidade diferente da do FRG. Isso precisa de uma decisão explícita antes de qualquer implementação: reconciliar os dois modelos, ou tratar os documentos 11/12 como obsoletos e trabalhar exclusivamente a partir do EFOS Core. Esta auditoria **usa o EFOS Core (`06_EFOS CORE.md`) como referência**, por ser o documento vigente, e sinaliza a reconciliação como item do roadmap (Capítulo 6, Sprint 0).

---

## 1. Inventário e Avaliação por Módulo

Convenção: **Manter** (correto, compatível com a visão vigente, não requer ação) · **Refatorar** (existe e é útil, mas precisa evoluir para se alinhar ao EFOS) · **Remover** (não serve mais ao produto) · **Criar** (não existe e é necessário).

O pedido cita `features`, `services` e `hooks` como diretórios a avaliar — eles não existem como pastas de topo neste projeto (foram deliberadamente removidos nas Missões 1–2 por violarem a arquitetura documentada à época); a lógica equivalente vive em `modules/<domínio>/{actions,services,components,validators,types,utils,constants}`. Avaliados abaixo sob essa forma real.

### 1.1. `app/`

| Caminho | Decisão | Justificativa |
|---|---|---|
| `app/(auth)/**`, `app/auth/confirm/route.ts` | **Manter** | Autenticação é infraestrutura permanente (`docs/01_ARCHITECTURE/07_SOFTWARE ARCHITECTURE.md`, Infrastructure Layer). Nenhuma regra de negócio aqui — correto por construção. |
| `app/(app)/layout.tsx` | **Refatorar** | A casca (Sidebar + Header) está tecnicamente correta, mas a navegação que ela sustenta reflete o modelo pré-EFOS. O layout em si (resolução de sessão + composição) permanece válido; o que muda é o conteúdo de `AppSidebar`/`AppHeader` (§1.2). |
| `app/(app)/dashboard/**` | **Refatorar (fortemente)** | Hoje é uma grade de `StatCard` (contagem de empresas). `docs/03_PRODUCT/01_PRODUCT VISION.md` e `03_EXECUTIVE JOURNEY.md` Etapa 1 definem a tela de abertura como "Estado Geral da Empresa, principais mudanças, riscos prioritários, oportunidades, decisões pendentes" — um conceito (Executive Overview) qualitativamente diferente de contadores. A infraestrutura (rota, loading/error, `dashboard.service.ts` como ponto único de composição) é reaproveitável; o conteúdo não. |
| `app/(app)/companies/page.tsx`, `[id]/page.tsx` | **Manter como Plataforma** | `Empresa` é a entidade raiz do Domain Model (`docs/01_ARCHITECTURE/04_DOMAIN MODEL.md`) — a listagem/CRUD continua necessária como camada de dados. Os "5 cards placeholder" do perfil da empresa (Saúde Financeira, Diagnósticos, Relatórios, IA Financeira) precisarão ser refeitos como pontos de entrada para os Engines do EFOS Core (§3), não como cards soltos — mas isso é trabalho futuro, não uma falha atual. |
| `app/(app)/documents/page.tsx` (placeholder de topo de menu) | **Remover (da navegação de topo)** | Documento não é uma "experiência executiva" — é insumo do Data Engine (`docs/01_ARCHITECTURE/06_EFOS CORE.md` §1). Já existe a forma correta de acessar documentos (seção dentro do perfil da empresa, Missão 5). Manter um item de Sidebar de primeiro nível para "Documentos" reforça o modelo de navegação por módulo que a nova visão de produto rejeita explicitamente. |
| `app/(app)/diagnostics/page.tsx`, `reports/page.tsx` | **Refatorar (conceitualmente, futuro)** | Hoje são placeholders soltos de navegação. Na visão EFOS, diagnóstico e relatório não são destinos de menu — são conteúdo dentro do Decision Center / Knowledge Timeline (`docs/03_PRODUCT/01_PRODUCT VISION.md`). Manter como placeholder até a Executive Experience ser redesenhada (Capítulo 6); não remover agora porque ainda não há para onde redirecionar. |
| `app/(app)/settings/page.tsx` | **Manter** | Configurações é um conceito estável em qualquer camada de produto, independente do pivô EFOS. |
| `app/globals.css`, `app/layout.tsx`, `app/page.tsx` | **Manter** | Infraestrutura de tema/fonte e redirecionamento raiz — não carregam decisão de produto. |

### 1.2. `modules/`

| Módulo | Decisão | Justificativa |
|---|---|---|
| `modules/auth/**` | **Manter** | `Usuário` é entidade permanente do Domain Model (`04_DOMAIN MODEL.md`). Nada aqui depende da visão de produto — é Infraestrutura pura. |
| `modules/workspace/**` (`AppSidebar`, `AppHeader`, `UserMenu`, `navigation.ts`) | **Refatorar** | `navigation.ts` hoje modela seis itens de módulo (Dashboard/Empresas/Documentos/Diagnósticos/Relatórios/Configurações) — o modelo de informação de um SaaS tradicional. Precisa ser redesenhado em torno das cinco experiências de `docs/03_PRODUCT/01_PRODUCT VISION.md`. `AppSidebar`/`AppHeader` como componentes (breadcrumb, menu de usuário, responsividade) continuam tecnicamente corretos — só o conteúdo de navegação muda. |
| `modules/companies/**` | **Manter** | CRUD da entidade raiz (`Empresa`). RLS, service, validators — nada aqui contradiz a nova visão; é a base de dados sobre a qual o EFOS Core vai operar. |
| `modules/dashboard/**` (`StatCard`, `RecentActivity`, `dashboard.service.ts`) | **Refatorar/substituir** | `docs/03_PRODUCT/01_PRODUCT VISION.md`, linha 121: *"Não entregamos dashboards... Entregamos entendimento."* O padrão `StatCard` (número + label) é exatamente o antipadrão que o documento de produto rejeita explicitamente. `dashboard.service.ts` como ponto único de composição de dados da tela inicial é uma estrutura reaproveitável — a forma de apresentar (cards numéricos) não é. |
| `modules/documents/**` | **Manter como Plataforma** | É a fonte de dado bruto que o futuro Data Engine (§3) vai consumir. Nenhuma mudança estrutural necessária agora; pertence conceitualmente à camada de Plataforma, não à Executive Experience. |

### 1.3. `components/`

| Caminho | Decisão | Justificativa |
|---|---|---|
| `components/ui/**` (shadcn/Base UI) | **Manter** | Primitivos de interface agnósticos de domínio — corretos independentemente de qualquer pivô de produto. |
| `components/shared/EmptyState.tsx`, `ErrorState.tsx` | **Manter** | Genéricos, reaproveitáveis por qualquer Experience futura. |
| `components/shared/PlaceholderCard.tsx`, `PlaceholderPage.tsx` | **Manter (uso temporário)** | Corretos como ferramenta de transição — o próprio conceito de "placeholder" deixará de ser necessário à medida que os Engines forem implementados (Capítulo 6), mas não há razão para remover agora. |

### 1.4. `lib/`

| Caminho | Decisão | Justificativa |
|---|---|---|
| `lib/supabase/client.ts`, `server.ts`, `proxy.ts` | **Manter** | Infrastructure Layer (`07_SOFTWARE ARCHITECTURE.md` §4) — cliente Supabase SSR-aware, corretamente isolado, sem regra de negócio. |
| `lib/utils.ts` (`cn`) | **Manter** | Utilitário puro de composição de classes CSS. |
| `proxy.ts` (raiz) | **Manter** | Proteção de rota via Next 16 Proxy — Infrastructure Layer, independe do pivô de produto. |

### 1.5. `supabase/` e Banco de Dados

| Item | Decisão | Justificativa |
|---|---|---|
| `companies` (+RLS) | **Manter** | Mapeia diretamente a entidade raiz `Empresa` do novo Domain Model. |
| `users` (+RLS) | **Manter** | Mapeia `Usuário`. |
| `documents` (+RLS) + bucket `documents` (+policies) | **Manter** | Mapeia `Documento` (`04_DOMAIN MODEL.md`) — fonte de dado do Data Engine. |
| `financial_metrics` (+RLS, protegida na auditoria de segurança anterior) | **Manter, mas vazia/não alimentada** | Corresponde a `Indicador` na Ontologia (`EXECUTIVE FINANCIAL ONTOLOGY.md`, Camada 3 "Estados" / Domain Model "Indicador") — porém nenhum código hoje escreve nela. É estrutura correta esperando o Financial Model Engine (§3). |
| Restante da Ontologia: Modelo Financeiro, Evidência, Hipótese, Cenário, Recomendação, Decisão, Resultado, Conhecimento | **Criar** | Nenhuma dessas dez camadas da Ontologia (`EXECUTIVE FINANCIAL ONTOLOGY.md`) tem tabela hoje, exceto Indicador (parcial). Este é o maior vazio estrutural do banco de dados — detalhado no Capítulo 4. |
| Fila/orquestração assíncrona (jobs, eventos) | **Criar** | `docs/01_ARCHITECTURE/07_SOFTWARE ARCHITECTURE.md` exige comunicação orientada a eventos entre camadas ("DocumentoImportado → DadosNormalizados → ModeloAtualizado → ..."). Nada disso existe — hoje não há nenhum processamento assíncrono no projeto; upload de documento só grava metadado, não dispara pipeline algum. |

### 1.6. `types/`

| Caminho | Decisão | Justificativa |
|---|---|---|
| `types/database.ts` | **Manter e expandir** | Espelha corretamente o schema atual (`companies`, `users`, `documents` + enums). Crescerá organicamente conforme as entidades do Capítulo 4 forem criadas — nenhuma mudança estrutural necessária hoje, só extensão futura. |

---

## 2. Reorganização em Três Camadas

O pedido desta missão usa três camadas; `docs/01_ARCHITECTURE/07_SOFTWARE ARCHITECTURE.md` define quatro (Executive Experience / Application / EFOS Core / Infrastructure). Mapeamento adotado nesta auditoria: **Plataforma = Application + Infrastructure Layer** (tudo que orquestra e sustenta, sem conter inteligência de negócio).

### 2.1. Plataforma
*(Infrastructure + Application Layer — "nunca conhece regras financeiras", `07_SOFTWARE ARCHITECTURE.md` §4)*

- `lib/supabase/**`, `proxy.ts` — cliente, sessão, proteção de rota.
- `modules/auth/**` — identidade.
- `modules/companies/**` — entidade raiz de domínio (dado, não inteligência).
- `modules/documents/**` — ingestão bruta (dado, não inteligência).
- `components/ui/**`, `components/shared/**` — primitivos de interface.
- Banco de dados: `companies`, `users`, `documents`, Storage.
- **Ausente:** fila de jobs/orquestração por evento (Capítulo 4, Sprint 1).

**Estado: majoritariamente construído e correto.** É a camada mais madura do projeto hoje — resultado direto de cinco missões de implementação bem-sucedidas.

### 2.2. EFOS Core
*(`docs/01_ARCHITECTURE/06_EFOS CORE.md` — os nove engines: Data, Financial Model, Evidence, Context, Reasoning, Simulation, Recommendation, Decision, Learning)*

**Estado: 0% implementado.** Nenhum dos nove engines existe em código. `financial_metrics` é a única estrutura de dado que antecipa parte do Financial Model Engine, e está vazia. Este é o núcleo do produto ("o cérebro permanente da plataforma", `06_EFOS CORE.md`) e é inteiramente trabalho futuro — ver Capítulo 4 e o roadmap (Capítulo 6).

### 2.3. Executive Experience
*(`docs/01_ARCHITECTURE/07_SOFTWARE ARCHITECTURE.md` §1 — "nenhuma regra de negócio pode existir nesta camada"; `docs/03_PRODUCT/01_PRODUCT VISION.md` — as cinco experiências)*

**Estado: existe uma casca de navegação (Sidebar/Header/Dashboard), mas modelada segundo o produto antigo, não segundo as cinco experiências vigentes.** Nenhuma das cinco — Executive Overview, Decision Center, Executive Chat, Scenario Lab, Knowledge Timeline — existe na forma descrita pela documentação atual. O que existe (listagem/perfil de empresa, upload de documento) são operações de dado que continuarão existindo, mas como *insumo* dessas experiências, não como a experiência em si.

---

## 3. Componentes Ausentes

Lista consolidada, cruzando Domain Model + EFOS Core + Product Vision contra o inventário real:

| Componente | Camada | Status |
|---|---|---|
| Data Engine (validação, normalização, consolidação de dados de múltiplas fontes) | EFOS Core | Ausente. Upload existe (Plataforma); processamento não. |
| Financial Model Engine (modelo financeiro único e vivo por empresa) | EFOS Core | Ausente. |
| Evidence Engine | EFOS Core | Ausente. |
| Context Engine (interpretação por setor/porte/sazonalidade) | EFOS Core | Ausente. |
| Reasoning Engine (hipóteses, causas, eliminação de inconsistência) | EFOS Core | Ausente. |
| Simulation Engine (cenários "e se") | EFOS Core | Ausente. |
| Recommendation Engine | EFOS Core | Ausente. |
| Decision Engine (registro de decisão humana) | EFOS Core | Ausente. |
| Learning Engine | EFOS Core | Ausente. |
| Entidades: Modelo Financeiro, Evidência, Hipótese, Cenário, Recomendação, Decisão, Resultado, Conhecimento | Banco de Dados | Ausentes (só `Indicador`/`financial_metrics` existe, vazio). |
| Orquestração por evento / fila de jobs | Plataforma | Ausente — nenhum processamento assíncrono no projeto hoje. |
| Executive Overview | Executive Experience | Ausente (existe um Dashboard de contagens, conceitualmente diferente). |
| Decision Center | Executive Experience | Ausente. |
| Executive Chat | Executive Experience | Ausente. |
| Scenario Lab | Executive Experience | Ausente. |
| Knowledge Timeline | Executive Experience | Ausente. |
| Integrações externas (ERP, Open Finance, bancos, contabilidade) | Plataforma/Data Engine | Ausentes — hoje só upload manual de arquivo. |

---

## 4. Roadmap de Implementação (Sprints)

Sequenciamento por dependência real, não por conveniência: EFOS Core não tem para onde alimentar dado sem a Plataforma; Executive Experience não tem o que mostrar sem o EFOS Core produzir algo. A ordem abaixo intercala os dois propositalmente para manter o produto demonstrável a cada sprint, em vez de nove sprints de backend sem nada visível.

| Sprint | Entrega | Depende de |
|---|---|---|
| **Sprint 0** | Reconciliação documental: decidir explicitamente o destino de `11_FINANCIAL_ENGINE.md`/`12_FINANCIAL_REASONING_GRAPH.md` frente ao EFOS Core vigente; formalizar o schema mínimo da Ontologia (Capítulo 3) como migrations reais | Esta auditoria |
| **Sprint 1** | Fila de jobs + orquestração por evento (Plataforma) — pré-requisito técnico de todo o EFOS Core | Sprint 0 |
| **Sprint 2** | Data Engine: validação + normalização real dos documentos já enviados (hoje só armazenados) | Sprint 1 |
| **Sprint 3** | Financial Model Engine + cálculo determinístico de Indicadores, alimentando `financial_metrics` de verdade | Sprint 2 |
| **Sprint 4** | Executive Overview mínimo (substitui o Dashboard atual) consumindo indicadores reais — primeiro ponto em que a Executive Experience reflete a nova visão de produto | Sprint 3 |
| **Sprint 5** | Evidence Engine + Context Engine | Sprint 3 |
| **Sprint 6** | Reasoning Engine (hipóteses e causa raiz) | Sprint 5 |
| **Sprint 7** | Decision Center (primeira experiência real de exploração de causa, `03_EXECUTIVE JOURNEY.md` Etapas 2–4) | Sprint 6 |
| **Sprint 8** | Simulation Engine + Scenario Lab | Sprint 6 |
| **Sprint 9** | Recommendation Engine + Decision Engine (registro de decisão humana) | Sprint 6, 8 |
| **Sprint 10** | Executive Chat (consome todo o EFOS Core já construído) | Sprint 9 |
| **Sprint 11** | Knowledge Timeline + Learning Engine (fecha o loop de aprendizado) | Sprint 9 |
| **Sprint 12** | Reformulação definitiva da navegação (`modules/workspace/config/navigation.ts`) em torno das cinco experiências, remoção dos placeholders remanescentes | Sprints 4, 7, 8, 10, 11 |

---

## 5. Síntese

A Plataforma está sólida e majoritariamente reaproveitável. O EFOS Core, que é onde a nova visão de produto concentra seu valor central, ainda não existe — nem em código, nem, até a leitura desta auditoria, reconciliado com os documentos de arquitetura que eu próprio havia produzido antes do pivô. A Executive Experience atual é funcional como esqueleto técnico, mas modela o produto errado: um SaaS de módulos, não um sistema de decisão executiva. Nenhuma dessas conclusões implica retrabalho destrutivo — a base de dados, autenticação e infraestrutura seguem válidas; o que falta é, em sua maior parte, **construir**, não desfazer.

---

*Fim do documento ARCHITECTURE_AUDIT.md.*
