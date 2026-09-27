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
| Natureza | `--kind-fact`, `--kind-evidence`, `--kind-interpretation`, `--kind-hypothesis`, `--kind-recommendation`, `--kind-decision` | marcadores e barras de acento de insight |
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

**Formulários.**
- Todo `Select` recebe `items` (os mesmos rótulos das opções). Sem isso, o Base UI mostra no gatilho o valor cru: `lucro_presumido`, o UUID da empresa.
- A frase de confirmação de uma ação destrutiva aparece na própria instrução (`Label` com `block`), em fonte mono, para ser digitada exatamente.

Os rótulos semânticos ficam em `modules/analysis/lib/insight-semantics.ts` (natureza, camada, severidade, confiança e prioridade) e em `modules/analysis/lib/recordTypeLabels.ts` (tipos de recurso e evento, com mapeamento exaustivo). As mensagens de erro executivas ficam em `modules/analysis/lib/analysis-error-message.ts`.

## Shell e navegação

- `modules/workspace/config/navigation.ts` é a fonte única da sidebar e do contexto do header.
- Os grupos seguem a função executiva: Visão executiva, Empresas (Empresas e Documentos), Decisão (Central de Decisões) e conta (itens "em breve").
- As rotas não mudaram.
- O layout autenticado tem skip link ("Pular para o conteúdo") → `main#conteudo`. A navegação é rotulada, o item ativo usa `aria-current="page"` e o foco é visível em todos os controles.
- A página da empresa segue a cadeia EFOS: cabeçalho executivo → próximo passo → Análise (O que sabemos / O que o EFOS infere) → Diagnóstico e decisões → Linha do tempo → Scenario Lab → Executive Chat → Documentos → Dados cadastrais. `CompanySectionNav` fixa a navegação entre essas seções.

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

`tests/production-surface/premium-experience.test.ts` fixa:

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
- a integridade das confirmações destrutivas.
