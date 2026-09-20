// Application Layer — Historical Financial Intelligence (Mission 085).
// Ver README.md deste diretorio.
export * from "./HistoricalExecution";
export * from "./HistoricalExecutionService";
export { DefaultHistoricalExecutionService, toHistoricalExecution } from "./DefaultHistoricalExecutionService";
export * from "./ExecutionComparison";
export * from "./compareExecutions";
// Mission 174 — Production Temporal Evidence Input.
export { buildCanonicalPriorPeriods } from "./buildCanonicalPriorPeriods";
