# modules/reports — Relatórios executivos (Mission 208, D-133)

O relatório executivo é o `ExecutiveReport` de uma execução (`efos/application/report/`, D-043), gravado uma vez em `public.executions.report` e imutável. Este módulo **não gera relatório** e não escreve nada: lê o que a análise gravou e organiza a leitura.

## Semântica

- **Snapshot:** se os dados mudarem amanhã, o relatório de ontem não muda. Uma nova análise gera um novo relatório.
- **Versão = execução:** reanalisar o mesmo período cria outra versão. A mais recente na ordem canônica do histórico é a "versão mais recente do período"; as demais continuam abertas como "versão anterior".
- **Período, comparação e versões:** resolvidos pela autoridade temporal única de `efos/application/history/resolveTemporalComparison.ts` (Mission 209, D-134) — o mesmo resolver da Visão geral, do Dashboard, do histórico da Análise e do contexto da IA. Histórico anterior divergente é dito como ambíguo, sem escolher uma versão.
- **Linhagem, nunca janela de datas:** leitura da IA por `execution_id`; decisões por `diagnosis_id` ou por cenário avaliado sobre esta mesma verdade financeira; resultados observados pela execução de observação; aprendizados pela origem nessas decisões. Tudo filtrado pela empresa do relatório.
- **Ciclo de decisão derivado na leitura (D-085):** execução, resultados e aprendizados aparecem com "estado em {instante}".

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `lib/report-lineage.ts` | o que pertence ao relatório além do `ExecutiveReport` |
| `lib/report-reading.ts` | leitura executiva (projeção de apresentação; o `ExecutiveReport` vai por referência) |
| `lib/report-index.ts` | índice por empresa e período, a partir de metadados |
| `lib/report-language.ts` | frases montadas só de contagens e estados |
| `services/report-queries.ts` | consultas com a sessão (RLS), cliente injetado |
| `services/report.service.ts` | carregamento das duas páginas |
| `components/` | documento, índice, anexo, botão de impressão, CSS de impressão |

## Regras

- Nenhum cálculo financeiro: valores, variações e classificações vêm dos Engines e das funções canônicas de apresentação.
- Nenhuma chamada de IA, nenhum `service_role`, nenhuma escrita.
- Seção só existe quando o objeto canônico que a sustenta existe.
- Testes: `tests/production-surface/mission-208-executive-reports.test.ts` (pipeline real, sem rede) e `tests/reports-local/` (fronteira entre empresas contra Supabase local).
