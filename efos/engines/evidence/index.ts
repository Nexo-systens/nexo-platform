// Evidence Engine — ponto de entrada. Ver README.md deste diretorio.
export * from "./evidence.constants";
export * from "./evidence.engine";
export * from "./evidence.types";
// Mission 171 — TEMPORAL_METRIC_DEFINITIONS (D-087) exportado para reuso
// por efos/application/financial-episodes/ (não duplicação: a mesma
// tabela de métricas/direcionalidade/extração já usada pelo Evidence
// Engine, nunca reimplementada).
export type {
  MetricDirectionality,
  TemporalMetricDefinition,
  TemporalMetricValue,
  TemporalSnapshot,
} from "./evidence.temporal.builder";
export { TEMPORAL_METRIC_DEFINITIONS } from "./evidence.temporal.builder";
export { periodOf } from "./evidence.validator";
