# EFOS Core

Status: **cadeia principal completa (Mission 015).** Os 10 estágios sequenciais do pipeline oficial estão implementados e validados (type-check + lint + build limpos a cada missão). O Simulation Engine é o único Engine do EFOS Core sem implementação real — auxiliar, fora da cadeia principal (D-012, `docs/DECISIONS.md`).

Referência normativa: `docs/ARCHITECTURE.md` (arquitetura consolidada e autocontida, referência a partir da Mission 006) e `docs/DECISIONS.md` (D-001 a D-013, histórico completo de decisões arquiteturais).

## Estrutura

```
efos/
  types/          tipos compartilhados por todo o EFOS Core (EngineId, EngineStatus, EFOS_PIPELINE)
  interfaces/      contrato comum implementado por todo Engine real (EfosEngine, EfosEngineContext, EfosEngineResult)
  domain/          modelo de domínio canônico (entidades, value objects, enums, agregados) — camada mais interna, zero dependência de infraestrutura
  shared/          metadados descritivos dos 11 Engines (registro de introspecção, sem lógica de execução)
  engines/         uma pasta por Engine — 10 com implementação real, 1 (simulation) ainda esqueleto
```

## Pipeline oficial (cadeia principal)

```
Data
  ↓
Financial Model
  ↓
Indicators
  ↓
Financial Knowledge Graph
  ↓
Evidence
  ↓
Context
  ↓
Reasoning
  ↓
Recommendation
  ↓
Decision
  ↓
Learning
```

A ordem está formalizada em `efos/types/pipeline.ts` (`EFOS_PIPELINE`) — fonte única da verdade sobre a sequência. Reconciliada duas vezes: Mission 008.5 (D-006, ordem real de implementação de Indicators/Financial Knowledge Graph) e Mission 014 (D-012, remoção do Simulation Engine da cadeia principal). Nenhuma orquestração futura deve reordenar Engines fora desta constante sem registrar uma nova decisão em `docs/DECISIONS.md` primeiro.

### Simulation Engine — auxiliar, fora da cadeia principal

O Simulation Engine **não é um estágio de `EFOS_PIPELINE`**. É um Engine auxiliar/opcional de projeção de cenários ("what-if"), consumido sob demanda por Engines da cadeia principal — nunca uma etapa sequencial obrigatória. Recommendation e Decision (Missions 012 e 013) foram implementados e validados sem nenhuma dependência real dele. Ver `docs/ARCHITECTURE.md`, seção "Simulation Engine (auxiliar)", e `docs/DECISIONS.md` D-012 para o racional completo.

## Responsabilidade de cada Engine

| Estágio | Engine | Responsabilidade | Status |
|---|---|---|---|
| 1 | Data | Transforma documentos financeiros brutos em `NormalizedFinancialRecord[]` — sem cálculo, sem OCR. | Implementado |
| 2 | Financial Model | Transforma registros normalizados em `FinancialModelAggregate` canônico. | Implementado |
| 3 | Indicators | Calcula indicadores financeiros determinísticos a partir do Financial Model. Nunca usa IA. | Implementado |
| 4 | Financial Knowledge Graph | Estrutura Financial Model + Indicadores como grafo de nós e arestas tipados. | Implementado |
| 5 | Evidence | Transforma modelo/indicadores/grafo em fatos objetivos e auditáveis. Nunca interpreta causa. | Implementado |
| 6 | Context | Agrupa Evidências relacionadas em situações financeiras compostas. Apenas descreve. | Implementado |
| 7 | Reasoning | Combina Contextos relacionados em conclusões executivas determinísticas. Nunca recomenda. | Implementado |
| 8 | Recommendation | Propõe ações executivas a partir de Reasonings reconhecidos. Nunca decide qual será executada. | Implementado |
| 9 | Decision | Prioriza Recommendations de forma determinística — proposta estruturada, não escolha humana. | Implementado |
| 10 | Learning | Registra conhecimento consolidado a partir do que já foi produzido. Nunca altera comportamento. | Implementado |
| — | Simulation (auxiliar) | Projeta cenários futuros e estima consequências. Consumido sob demanda, fora da cadeia principal. | Esqueleto |

Detalhamento completo de cada Engine (entrada, saída, regras, limitações) está no `README.md` de cada `efos/engines/<nome>/`.

## Cada Engine implementado contém

- `README.md` — objetivo, responsabilidade, fluxo, entrada/saída, estrutura, estratégia de regras, rastreabilidade, limitações, exemplo de uso.
- `index.ts` — ponto de entrada público do módulo.
- `<engine>.types.ts` — contrato de entrada/saída (`EngineInput`/`EngineOutput`/`Draft`).
- `<engine>.constants.ts` — id, nome, versão, mensagens de validação, constantes de regra.
- `<engine>.validator.ts` — validação estrutural e de consistência entre agregados de entrada.
- `<engine>.builder.ts` (ou `.calculator.ts`/`.normalizer.ts`/`.mapper.ts` conforme o estágio) — toda a lógica determinística de regra.
- `<engine>.mapper.ts` — conversão do resultado interno para o contrato oficial de domínio.
- `<engine>.engine.ts` — classe que implementa `EfosEngine`, orquestra validator → builder → mapper.

O Simulation Engine (único ainda esqueleto) contém apenas `README.md`, `index.ts` e `types.ts` — sem lógica implementada.

## Regras arquiteturais que todo Engine implementado respeita

- Nenhum Engine usa IA/LLM/Machine Learning sob nenhuma circunstância.
- Nenhum Engine chama `execute()`/instancia a classe de outro Engine — contratos só por tipo (D-002).
- Nenhum Engine persiste dados nem acessa infraestrutura (Supabase, banco, rede).
- Toda referência entre entidades é por ID — nunca objeto embutido.
- Cada Engine é uma unidade isolada e substituível — a orquestração real (fila de execução, encadeamento sequencial) é responsabilidade da futura Application Layer, que ainda não existe.

## Como isso sustenta a evolução futura

O contrato comum (`efos/interfaces/engine.ts`, `EfosEngine<TInput, TOutput>`) garante que a orquestração futura possa tratar qualquer Engine de forma genérica, sem conhecer sua implementação interna. Com a cadeia principal completa, o próximo passo estrutural é a Application Layer — orquestração real entre os 10 Engines, hoje inexistente (nenhuma rota da Plataforma chama um Engine). Ver `docs/ROADMAP.md`, "Fases futuras", para o levantamento completo de prioridades identificadas e ainda não decididas.
