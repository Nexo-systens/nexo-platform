# Application Layer — Executive Report Presentation

Status: **implementado (Mission 078 — Executive Report Presentation Layer).** Primeira camada de apresentação do EFOS — transforma um `ExecutiveReport` (`efos/application/report/`, Mission 022) já produzido em Markdown, consumível diretamente por um ser humano. Nenhum cálculo, nenhuma classificação, nenhuma inferência nova.

## Objetivo

Responder à pergunta deixada em aberto desde a Mission 022 (D-019) e reconfirmada pela Mission 077: o EFOS já sabe *estruturar* um relatório executivo, mas ainda não sabia *apresentá-lo*. Este módulo fecha essa lacuna com a menor implementação possível — sem UI, sem dashboard, sem design system, sem PDF, sem gráficos.

## Contrato

```ts
interface ExecutiveReportRenderer {
  render(report: ExecutiveReport): string;
}
```

`render()` é síncrono, puro e determinístico — mesma entrada sempre produz a mesma saída. Nunca modifica o `ExecutiveReport` recebido; nunca acessa banco, rede ou IA; nunca recalcula nem reclassifica nada — apenas formata como texto os dados já presentes.

## `DefaultExecutiveReportRenderer` — por que Markdown

Markdown foi escolhido como o primeiro formato por ser o menor passo útil: nenhuma biblioteca nova, nenhum motor de template, texto simples e legível, fácil de validar em teste (comparação de string), e pode servir de representação intermediária para uma futura conversão a HTML/PDF sem precisar refazer a lógica de extração de dados do `ExecutiveReport`. HTML foi considerado e descartado como primeira implementação — exigiria decisões de escaping/segurança e não traz benefício imediato sobre Markdown para o objetivo desta missão (representação textual consumível). PDF foi descartado por exigir dependência externa (biblioteca de geração de PDF) sem evidência de necessidade imediata.

`render()` itera exatamente `report.sections`, na ordem em que já chegam — a ordem executiva determinística decidida pela Mission 065 (Financial Health → Financial Risk → KPI → Balance Sheet → Income Statement → Cash Flow → Indicators → Evidence → Context → Reasoning → Recommendation → Decision) — nunca reordena, nunca insere uma seção ausente. Cada tipo de seção é renderizado com a tabela apropriada ao seu conteúdo:

- `financialHealth`/`financialRisk`/`kpi`/`indicators` — tabela de `Indicator` (nome, categoria, valor, unidade, fórmula).
- `balanceSheet`/`incomeStatement`/`cashFlow` — tabela de `NormalizedFinancialRecord` (registro, valor, data, tipo).
- `evidence`/`context` — tabela (título, severidade, confiança, descrição).
- `reasoning` — tabela (título, confiança, descrição).
- `recommendation` — tabela (título, prioridade, confiança, descrição, impacto esperado).
- `decision` — tabela (título, prioridade, confiança, descrição, racional).

Uma seção presente mas com coleção vazia (ex.: `execution.evidence` existe mas `evidences: []`) é renderizada com uma mensagem explícita ("_Nenhum item nesta seção._"), nunca com uma tabela quebrada nem conteúdo inventado.

## Escaping de tabela (não é sanitização de segurança)

`escapeMarkdownCell()` troca `|` por `\|` e quebras de linha por espaço dentro de cada célula — o mínimo necessário para a tabela Markdown permanecer bem formada mesmo que um `label`/`title`/`description` já existente contenha esses caracteres. Markdown não é executado como código (diferente de HTML), então isso não é uma camada de segurança contra injeção — é apenas correção estrutural da tabela. Nenhum dado original é alterado, apenas sua representação textual dentro da célula.

## Dependências permitidas

- `@/efos/domain` (`Indicator`) — apenas por tipo.
- `@/efos/engines/data` (`NormalizedFinancialRecord`) — apenas por tipo, contrato oficial do Data Engine (D-002).
- `efos/application/report` (`ExecutiveReport`, `ExecutiveReportSection`) — apenas por tipo, a única entrada aceita.

## Dependências proibidas

- **Engines** (`efos/engines/*`) — nenhum Engine é executado; `render()` só lê campos já existentes nos tipos importados.
- **Domain além de tipos** — nenhuma entidade é instanciada, apenas lida por tipo.
- **Infraestrutura** (Supabase, banco, HTTP, IA) — este módulo é puro, síncrono, sem I/O algum.
- **Cálculo/classificação/inferência nova** — nenhum valor é somado, comparado, arredondado ou reinterpretado; apenas formatado como texto.
