# Simulation Engine

Status: **esqueleto, sem implementação.**

## Natureza — Engine auxiliar, fora da cadeia principal

A partir da Mission 014 (D-012, `docs/DECISIONS.md`), o Simulation Engine **não faz parte da cadeia principal de inferência** (`efos/types/pipeline.ts`, `EFOS_PIPELINE`). É um Engine auxiliar/opcional de projeção de cenários ("what-if"), consumido sob demanda por Engines da cadeia principal — nunca uma etapa sequencial obrigatória. `Recommendation` e `Decision` (Missions 012 e 013) não dependem dele, e foram implementados e validados sem ele. Ver `docs/ARCHITECTURE.md`, seção "Simulation Engine (auxiliar)", para o racional completo.

## Responsabilidade

Projetar cenários futuros e estimar consequências (ex.: contratar, buscar crédito, abrir filial). O objetivo não é prever o futuro — é estimar consequências. (`docs/01_ARCHITECTURE/06_EFOS CORE.md`, §6)

## Quando deve ser utilizado

Sob demanda, quando um consumidor explícito precisar explorar hipóteses "e se" a partir de conclusões já existentes — não como pré-requisito de nenhum outro Engine.

## Entrada

`ReasoningAggregate` (conclusões executivas do Reasoning Engine) — mesmo contrato de entrada usado pelo Recommendation Engine, para que Simulation possa ser inserido opcionalmente no mesmo ponto do fluxo sem alterar o contrato de nenhum Engine já implementado.

## Saída

Cenários projetados, cada um com premissas explícitas.

## Engines que podem consumi-lo futuramente

`Recommendation` e `Decision` — ambos já implementados sem depender de `Simulation`, mas poderiam, no futuro, aceitar cenários projetados como entrada opcional adicional (nunca obrigatória) para enriquecer suas regras, caso uma missão futura decida estender seus contratos formalmente. Nenhuma extensão desse tipo está implementada ou decidida hoje.

## Dependências

`reasoning` (mesma entrada do Recommendation Engine — ver acima).

## Erros possíveis (referência futura)

Série histórica insuficiente para projeção confiável; premissa incoerente com a tendência observada. Nenhum tratamento implementado nesta fase.
