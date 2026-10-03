// Application Layer — Historical Financial Intelligence (Mission 085).
// Ver README.md deste diretorio.
export * from "./HistoricalExecution";
export * from "./HistoricalExecutionService";
export {
  compareHistoricalExecutionOrder,
  DefaultHistoricalExecutionService,
  toHistoricalExecution,
} from "./DefaultHistoricalExecutionService";
export * from "./ExecutionComparison";
export * from "./compareExecutions";
// Mission 174 — Production Temporal Evidence Input.
export { buildCanonicalPriorPeriods } from "./buildCanonicalPriorPeriods";
// Mission 209 — autoridade única de comparação temporal (D-134).
export * from "./resolveTemporalComparison";
