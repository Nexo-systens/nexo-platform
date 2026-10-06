# NEXO — Design System (EFOS)

Mission 203. Documento curto e operacional: o que usar, quando e por quê. A fonte de verdade dos valores é `styles/tokens.css`. `app/globals.css` expõe esses valores ao Tailwind (`@theme inline`) e define as classes tipográficas.

## Princípios

1. **O executivo entende em segundos.** Cada página abre com um `PageHeader` (eyebrow → título → descrição → metadados → ações) e responde a duas perguntas: onde estou e qual é o próximo passo.
2. **Hierarquia financeira.** A UI separa **o que sabemos** (dados dos documentos, indicadores calculados, evidências rastreáveis) de **o que o EFOS infere** (interpretação, hipótese, recomendação, proposta de decisão). A ordem das seções é a do `ExecutiveReport` e a UI nunca a reordena.
3. **Honestidade de dado.** Um dado ausente aparece como *Indisponível* com o motivo (`UnavailableValue`) e nunca como `0`. Um zero medido é um zero. Nenhum número é fabricado para preencher uma tela.
4. **Cor sinaliza, não decora.** Cor indica estado (positivo, atenção, negativo, informação) ou a natureza da informação. Nunca substitui texto: todo tom acompanha um rótulo.
5. **Linguagem executiva.** Enums do domínio (`high`, `interest_expense`, `cash`) nunca aparecem crus. Mensagens técnicas (validação de Engine, provedor de IA) viram orientação executiva, e o texto original fica recolhido em `TechnicalDetail`, sem ser descartado.
6. **Ações destrutivas são inconfundíveis.** Encerrar e excluir usam `variant="destructive"` e as confirmações das Missions 202/202B (diálogo e frase digitada). Estilo nenhum pode enfraquecê-las.
7. **Movimento discreto.** Só transições curtas de cor e opacidade. `prefers-reduced-motion` desliga animações e transições.

## Tokens (`styles/tokens.css`)

| Grupo | Tokens | Uso |
| --- | --- | --- |
| Superfície | `--background`, `--surface`, `--surface-subtle`, `--surface-sunken`, `--surface-inverse` | página em tom de papel, cartões, faixas secundárias, trilhos, painel de marca |
| Texto | `--foreground`, `--foreground-secondary`, `--muted-foreground`, `--foreground-inverse` | tinta principal, apoio, metadados |
| Borda | `--border`, `--border-strong`, `--input` | divisórias e contornos de controles |
| Identidade | `--primary` (azul-noite), `--primary-soft` | ação principal, item ativo, foco |
| Status | `--positive`, `--warning`, `--negative`, `--info`, cada um com `-soft` e `-soft-foreground` | badges, callouts, estados. `--destructive` é alias de `--negative` |
| Natureza | `--kind-fact`, `--kind-evidence`, `--kind-interpretation`, `--kind-hypothesis`, `--kind-recommendation`, `--kind-decision`, `--kind-outcome`, `--kind-learning` | marcadores e barras de acento de insight; resultado e aprendizado desde a Mission 208 |
| Institucional | `--brass` | só na página institucional: filetes, eyebrows e numerais sobre `--surface-inverse` |
| Elevação | `--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-overlay` | cartões (xs), menus e diálogos (overlay) |
| Layout | `--content-max` (76rem), `--sidebar-width`, `--header-height` | shell e largura de leitura |

Componentes não usam cores soltas da paleta do Tailwind (`amber-500`, `green-600`). Se falta um token, ele é criado em `tokens.css`, no tema claro e no escuro.

## Tipografia

Geist (texto) e Geist Mono (detalhe técnico). A escala é fixa, com classes em `globals.css`:

| Classe | Uso |
| --- | --- |
| `type-eyebrow` | contexto curto acima de títulos (maiúsculas espaçadas) |
| `type-page-title` | `h1`, um por página, via `PageHeader` |
| `type-section-title` | `h2` de seção, via `SectionShell` |
| `type-subsection-title` | `h3` dentro de seções |
| `type-body`, `type-label`, `type-meta` | texto, rótulos de campo, metadados |
| `type-metric` + `num` | números executivos; `num` aplica `tabular-nums` a qualquer valor |

## Componentes compartilhados (`components/shared/`)

| Componente | Quando usar |
| --- | --- |
| `PageHeader` | topo de toda página autenticada |
| `SectionShell` | seção âncora da página da empresa (`id` + `aria-labelledby`), segura em server components |
| `Callout` | orientação ou aviso inline (tons neutral, info, positive, warning e negative) |
| `SemanticBadge` | estado com tom e texto em português |
| `KindMarker` | natureza de um bloco: ponto cheio para o que é conhecido, anel vazado para o que é inferido |
| `UnavailableValue` | valor que não pôde ser calculado, sempre com o motivo |
| `TechnicalDetail` | texto técnico original recolhido ("Detalhe técnico para o suporte") |
| `EmptyState` (`compact`), `ErrorState`, `PlaceholderPage` | estados vazio, erro e "em breve" |
| `ChangeIndicator` | variação de uma métrica entre análises: símbolo, valor com sinal e "melhora/piora" |

**Formulários.**
- Todo `Select` recebe `items` (os mesmos rótulos das opções). Sem isso, o Base UI mostra no gatilho o valor cru: `lucro_presumido`, o UUID da empresa.
- A frase de confirmação de uma ação destrutiva aparece na própria instrução (`Label` com `block`), em fonte mono, para ser digitada exatamente.
- Todo `SelectTrigger` tem nome acessível (`id` ligado ao `Label` ou `aria-label`).

Os rótulos semânticos ficam em `modules/analysis/lib/insight-semantics.ts` (natureza, camada, severidade, confiança e prioridade) e em `modules/analysis/lib/recordTypeLabels.ts` (tipos de recurso e evento, com mapeamento exaustivo). As mensagens de erro executivas ficam em `modules/analysis/lib/analysis-error-message.ts`.

## Shell e navegação

- `modules/workspace/config/navigation.ts` é a fonte única da sidebar e do contexto do header.
- Os grupos seguem a função executiva: acompanhar (Visão executiva e Relatórios, desde a Mission 208), Empresas (Empresas e Documentos), Decisão (Central de Decisões) e conta (Configurações, "em breve").
- As rotas não mudaram.
- O layout autenticado tem skip link ("Pular para o conteúdo") → `main#conteudo`. A navegação é rotulada, o item ativo usa `aria-current="page"` e o foco é visível em todos os controles.
- A página da empresa é um **workspace em visões** (`?secao=`, `modules/companies/lib/workspace-views.ts`): Visão geral · Análise · Decisões · Cenários · Executive Chat · Conhecimento · Documentos · Cadastro. Só a visão ativa é renderizada; cada uma tem URL própria. `CompanyWorkspaceNav` é a navegação (links reais, `aria-current="page"`, contador de decisões pendentes). Antes da primeira análise só existem Documentos, Análise, Decisões e Cadastro.
- Links internos apontam para visões (`companyWorkspaceHref(id, view)`), nunca para âncoras.
- Abaixo de `xl` a lista de visões pode não caber: ela rola na horizontal e a borda direita esmaece para indicar que continua.

## Números financeiros (Mission 204)

- **Variação:** `describeMetricChange` (`modules/analysis/lib/metric-change.ts`) + `ChangeIndicator`. Direção sempre em símbolo e texto (↑ subiu, ↓ caiu); a cor só reforça.
- **Melhora/piora:** só para as métricas que o EFOS classifica em `TEMPORAL_METRIC_DEFINITIONS` (D-087: margens, liquidezes, prazo de recebimento, fluxo operacional). As demais ficam neutras — a UI não inventa juízo financeiro.
- **Unidades:** percentual como "27,35%", diferença em pontos percentuais ("-3,85 p.p."), moeda "R$ 460.000", dias "13 dias"; variação em dias abaixo de 1 mantém uma casa ("+0,3 dia").
- **Ausência:** "—" ou `UnavailableValue`, nunca 0.
- **Período:** `formatPeriodLabel` ("agosto de 2026", "ago/2026"). Análises são nomeadas pelo período analisado; a data de execução é detalhe.
- **Comparação temporal (Mission 209, D-134):** toda variação "desde" é contra o período anterior canônico, resolvido em `efos/application/history` — nunca contra a execução imediatamente anterior. Sem comparação válida, o texto vem de `temporal-comparison-language.ts` ("Sem período anterior comparável", "Comparação indisponível — histórico anterior ambíguo"), uma vez no cabeçalho; nunca "0 p.p.", "estável" ou "sem mudança".
- **Versões do mesmo período:** reanálise aparece como "versão anterior"; comparar duas versões é "Diferença entre versões", com "maior/menor/sem diferença" e sem "melhora/piora" (`describeMetricChange(…, { temporal: false })`).
- **Resultado de uma decisão (Mission 211, D-136):** sempre com o período — "Base da decisão: agosto de 2026 → Resultado observado — setembro de 2026"; sem período posterior, o estado diz isso (nunca 0, nunca a reanálise do mesmo mês); decisão manual diz que não tem base financeira explícita.
- **Decisão a partir do Executive Chat (Mission 210, D-135):** a proposta é sempre proposta ("Ações sugeridas sobre a análise de {período} — só acontecem se você confirmar"); a decisão é "Decisão da empresa" com "Origem: Executive Chat — proposta na conversa e confirmada pela empresa" (`DECISION_PROPOSER_LABELS`), nunca "decisão da IA"; sem UUID e sem seção separada na Central de Decisões. Se a análise mudou depois da resposta, a recusa diz isso e pede uma nova pergunta.
- **Texto dos Engines:** `formatEngineText` converte só a forma de carimbos ISO e decimais com ponto; a redação não muda.
- **Tabelas numéricas:** colunas alinhadas à direita, `num` + `whitespace-nowrap`; rolagem horizontal dentro do próprio contêiner, nunca da página.

## Composição (Mission 204)

- **Menos caixas:** listas com divisores (`divide-y`) em vez de um card por item; card só para objetos (ex.: uma decisão em execução).
- **Divulgação progressiva:** a primeira seção de indicadores fica aberta; as demais seções de indicadores e as demonstrações ficam em `<details>` com resumo (título · contagem · período), na ordem do relatório. Seção inferida vazia vira uma linha discreta, nunca título + lista vazia.
- **Decisão como objeto:** ciclo (aguardando → decididas → concluídas) no topo; passos numerados (revisar a leitura da IA, registrar a decisão); por decisão, uma trilha Decidida → Em execução → Concluída → Resultado → Aprendizado.
- **Proveniência:** ids técnicos nunca são UX primária. O diagnóstico mostra a base pelos nomes da análise de origem (`modules/decisions/lib/diagnosis-references.ts`); id de usuário vira "Conta da empresa" com o id no `title`.
- **Ação já exercida fica recolhida:** quando o objeto já tem o registro (ex.: um resultado observado), o formulário para registrar outro continua disponível, mas atrás de um `<details>` ("Registrar outro resultado").
- **Frases e contagens:** plural real ("1 avaliação", "2 avaliações"), nunca "avaliação(ões)"; contagem zero vira palavra ("e nenhuma melhorou"), nunca "e 0 melhoraram".
- **Intervalo × contagem:** quando uma linha mostra o intervalo de um episódio e o número de períodos examinados, os dois têm rótulos distintos ("Observado em jul/2026 – ago/2026 · 4 períodos analisados").
- **Consulta executiva (Chat):** a pergunta vem primeiro; cada consulta é um registro (pergunta como título, resposta como documento em camadas), mais recente primeiro.

## Inspeção visual local (Mission 204)

- `scripts/visual-fixtures/seed-local.ts` cria três empresas fictícias com documentos no formato da ingestão real, em cadência mensal (`FIXTURE_THROUGH=AAAA-MM`). Recusa qualquer host que não seja 127.0.0.1/localhost.
- Com `NEXO_LOCAL_SYNTHETIC_AI=1` num `.env.development.local` apontando para o Supabase local, diagnóstico e Executive Chat usam os stand-ins determinísticos da Mission 160 (`lib/ai/executive-ai-providers.ts`) — nunca a Anthropic. Desliga sozinho em produção e contra qualquer host remoto; o `providerName` persistido identifica o conteúdo sintético.

## Página institucional (Mission 205)

A landing em `/` (`app/(site)/`, `modules/site/`) herda os tokens do produto e pode ser mais expressiva que ele. Padrões reutilizáveis:

- **Título serifado só no site:** Newsreader (`.site-display`), carregada apenas no layout do grupo `(site)`. O produto continua em Geist.
- **Latão (`--brass`):** só filetes, eyebrows e numerais sobre `--surface-inverse`. Nunca texto corrido, nunca status.
- **Filetes de balanço (`.site-ledger`):** linhas horizontais a ~3% sobre as superfícies escuras. Sem gradientes, blobs, partículas ou glassmorphism.
- **Quadro de produto (`ProductFrame`):** recorte de uma tela real montado com os componentes do produto (`ChangeIndicator`, `KindMarker`, `SemanticBadge`, `ScenarioImpactTable`), sempre com o selo "Dados fictícios" e `figcaption` acessível. Nada dentro dele é focável. Não simula navegador nem usa captura com dado real.
- **Movimento:** só CSS — entrada do hero e revelação ligada à rolagem (`animation-timeline: view()`) dentro de `prefers-reduced-motion: no-preference`. Sem suporte, o conteúdo aparece direto.
- **Grades de seção:** sempre `grid-cols-[minmax(0,1fr)]` na base. Conteúdo sem quebra (tabela, badge) não pode alargar a coluna em telas estreitas.
- **CTAs:** o canal comercial vem de `NEXT_PUBLIC_NEXO_CONTACT_URL` (`mailto:` ou `https:`). Sem ele, o botão leva à seção `#conversar`, que não exibe contato fictício. "Entrar na plataforma" sempre leva ao `/login`.

## Documento executivo (Mission 208)

O relatório executivo (`/reports/[executionId]`, `modules/reports/components/`) é um documento, não um painel. Padrões reutilizáveis:

- **Cabeçalho de documento:** eyebrow → nome da empresa (`h1`) → período em destaque → metadados em `dl` (período analisado, comparado com, gerado em, versão) → uma frase de natureza ("registro imutável…; ciclo de decisão no estado de…") → sumário numerado das seções presentes.
- **Seções numeradas (`DocSection`):** filete superior, número em eyebrow (`01`), `h2`, frase de abertura. A numeração conta só as seções que existem — seção sem objeto canônico não aparece.
- **Natureza por bloco:** `KindMarker` antes de cada bloco. Ponto cheio para o que é conhecido (indicador, evidência, **decisão da empresa**, **resultado observado**); anel para o que é inferido (interpretação, hipótese, recomendação, proposta do EFOS, **aprendizado**). A proposta do Decision Engine ("Proposta de decisão") e a decisão registrada pela empresa ("Decisão da empresa") nunca dividem rótulo.
- **Itens como texto:** lista com divisores; título, descrição e uma linha de metadados em texto ("Severidade alta · Confiança do EFOS: alta · Indicador: Margem Líquida"). Selos só onde o componente reaproveitado já os usa (leitura da IA).
- **Confiança:** "Confiança do EFOS: …" para Engines; a leitura da IA mantém "Confiança média" dentro da própria seção. Nunca percentual.
- **Anexo:** catálogo completo de indicadores e demonstrações recolhidas (`<details>`), proveniência com o identificador técnico só ali.
- **Impressão:** `print:hidden!` no shell (sidebar, cabeçalho, skip link), `print:hidden` nos controles; `report-document.css` define `@page` A4, quebras (`report-item`, `report-keep`, anexo em página nova) e tabelas sem rolagem. O botão "Imprimir ou salvar PDF" e o evento `beforeprint` (Ctrl+P) abrem todos os `<details>` antes de imprimir.
- **Período de um único dia** (só Balanço): título "Posição em 31/08/2026", metadado "Data-base 31/08/2026" — `formatPeriodLabel` devolve a data, não "31/08/2026 – 31/08/2026".

## Estados

| Estado | Tratamento |
| --- | --- |
| Carregando | skeleton com a forma da página real (`aria-busy`) |
| Vazio | `EmptyState` com o próximo passo concreto |
| Erro | `ErrorState` (`role="alert"`) com tentar novamente, mais `TechnicalDetail` quando houver texto interno |
| Indisponível | `UnavailableValue` com o motivo |
| Em breve | `PlaceholderPage` com o que já está disponível hoje |
| Não encontrado | `app/(app)/not-found.tsx` (no shell) e `app/not-found.tsx` (raiz); o mesmo texto para qualquer ausência, sem revelar o motivo |

## Testes

`tests/production-surface/premium-experience.test.ts` (Mission 203) e `mission-204-experience.test.ts` (Mission 204) fixam:

- as rotas da navegação;
- a camada de cada seção do relatório, na ordem real do `DefaultReportService`;
- os rótulos sem enum cru;
- "indisponível ≠ 0" na visão executiva;
- as mensagens executivas com o detalhe preservado;
- o erro de consulta observável;
- a ausência de cores soltas da paleta;
- que todo `Select` mostre o rótulo, nunca o valor cru;
- que o 404 próprio e a rota do operador não revelem a existência da rota;
- a acessibilidade do shell;
- a integridade das confirmações destrutivas;
- visões do workspace, sistema de números, situação sem dado fabricado, proveniência legível, comando do portfólio, IA sintética só local e nomes acessíveis dos selects (Mission 204);
- documento executivo: verdade do relatório, período e versões, linhagem do ciclo de decisão, fronteira de empresa, títulos e tabelas acessíveis, impressão (`mission-208-executive-reports.test.ts`).
