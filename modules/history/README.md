# Módulo History — Histórico e Comparação Executiva

Status: **implementado (Mission 087 — NEXO Historical & Comparative Intelligence Experience).** Primeiro consumidor real da inteligência histórica/comparativa do EFOS (`efos/application/history/`, Missions 085/086, D-045/D-046).

## Objetivo

Responder "o que mudou desde a última análise?" dentro da página da empresa (`app/(app)/companies/[id]/`) — nunca "por que mudou?", nunca "o que fazer?".

## Fluxo

```
GET /api/efos/history/{companyId}
        ↓
ExecutionRepository.findByCompany() (RLS)
        ↓
HistoricalExecutionService.getHistory()
        ↓
compareExecutions() (quando há ≥2 execuções)
        ↓
HistoryResponse (app/api/efos/_shared/HistoryResponse.ts — contrato de apresentação, nunca ExecutionSnapshot/ExecutiveReport inteiros)
        ↓
HistoricalAnalysisPanel (client)
        ↓
ExecutionHistoryList / ComparisonSummary (puramente apresentacionais)
```

## Regra central

**EFOS calcula. NEXO apresenta.** Nenhum componente deste módulo soma, subtrai, calcula percentual, reclassifica direção ou inventa uma métrica — `direction`/`absoluteChange`/`metricName` chegam prontos de `ExecutionComparison` (`compareExecutions()`, D-046). `ChangeDirection` (`increased`/`decreased`/`unchanged`/`added`/`removed`/`not-comparable`) é usado exatamente como o EFOS o produz — nenhuma taxonomia nova.

## Estados

- **Sem execuções**: `EmptyState` — "Ainda não existem análises para esta empresa."
- **Uma execução**: histórico mostrado, sem seção de comparação — "Esta é a primeira análise. Ainda não existe período anterior."
- **Duas ou mais execuções**: histórico + comparação, com seletor de execução anterior.
- **Carregando**: `Skeleton`.
- **Erro**: `ErrorState` com mensagem real (`ApplicationError.message`), nunca uma mensagem fictícia.

## Unidades incompatíveis

Quando `ChangeDirection === "not-comparable"` (métrica presente nos dois períodos, mas `Indicator.unit` diverge, D-046), `ComparisonSummary` mostra o rótulo "Não comparável" e os dois valores brutos (sem símbolo de unidade unificado) — nunca converte, nunca escolhe uma unidade arbitrariamente.

## Seleção de período anterior

O `Select` em `HistoricalAnalysisPanel` dispara uma nova chamada `GET` com `?previousExecutionId=`, nunca recalcula a comparação no cliente — o servidor sempre chama `compareExecutions()` de novo com o par escolhido. A execução atual nunca aparece como opção de "anterior" (filtrada na própria lista do `Select`); o servidor (`buildHistoryResponse()`) também ignora silenciosamente um `previousExecutionId` igual ao da execução atual.

## Dependências permitidas

- `@/app/api/efos/_shared/HistoryResponse` — apenas por tipo, contrato de apresentação já existente.
- `@/efos/application/history` — apenas por tipo (`ExecutionComparison`, `ChangeDirection`).
- `@/efos/application/contracts` — apenas por tipo (`ApplicationResult`).

## Dependências proibidas

- **Repository/Supabase/Domain/Infrastructure** — nenhum componente deste módulo os importa; o único ponto de contato é o `fetch()` para `GET /api/efos/history/{companyId}`.
- **Cálculo financeiro** — nenhum componente soma, subtrai ou calcula percentual.
