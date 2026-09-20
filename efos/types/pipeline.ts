import type { EngineId } from "./common";

/**
 * Fluxo oficial do EFOS Core — a cadeia principal de inferencia.
 * Fonte unica da ordem do pipeline — qualquer orquestracao futura deve
 * ler esta constante, nunca reordenar engines livremente. Ordem
 * reconciliada uma primeira vez com a ordem real de implementacao na
 * Mission 008.5 (D-006, docs/DECISIONS.md); reconciliada uma segunda
 * vez na Mission 014 (D-012) — `simulation` removido desta constante.
 *
 * Data -> Financial Model -> Indicators -> Financial Knowledge Graph ->
 * Evidence -> Context -> Reasoning -> Recommendation -> Decision ->
 * Learning
 *
 * O Simulation Engine nao faz parte da cadeia principal — e um Engine
 * auxiliar/opcional de projecao de cenarios ("what-if"), consumido sob
 * demanda por Engines da cadeia principal, nunca uma etapa obrigatoria
 * do fluxo sequencial. Ver `SIMULATION_ENGINE_ID` abaixo e
 * docs/DECISIONS.md D-012 para a decisao completa.
 */
export const EFOS_PIPELINE = [
  "data",
  "financial-model",
  "indicators",
  "financial-knowledge-graph",
  "evidence",
  "context",
  "reasoning",
  "recommendation",
  "decision",
  "learning",
] as const satisfies readonly EngineId[];

export type PipelineStage = (typeof EFOS_PIPELINE)[number];

/**
 * Identificador do Simulation Engine — permanece um `EngineId` valido
 * (efos/types/common.ts) e continua catalogado em
 * `efos/shared/engine-registry.ts`, mas deliberadamente fora de
 * `EFOS_PIPELINE`/`PipelineStage` a partir da Mission 014 (D-012):
 * nao e uma etapa sequencial da cadeia principal, e um Engine auxiliar
 * consumido sob demanda.
 */
export const SIMULATION_ENGINE_ID: EngineId = "simulation";
