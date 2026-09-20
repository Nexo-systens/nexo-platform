import type { PipelineExecutionSnapshot } from "../orchestrators";
import type { ExecutiveReport } from "../report";

/**
 * Representação oficial de uma execução completa do EFOS que poderá
 * ser salva futuramente (Mission 027 — Execution Persistence
 * Contracts). Puramente estrutural — nenhuma implementação de banco,
 * Supabase ou SQL nesta missão.
 *
 * Estende `PipelineExecutionSnapshot` (`efos/application/
 * orchestrators/PipelineExecutionSnapshot.ts`, Mission 020B), que já
 * combina `PipelineMetadata` + `PipelineExecution` — nenhum campo
 * redeclarado. Ganha apenas `report`, o `ExecutiveReport`
 * (`efos/application/report/`, Mission 022) já produzido para essa
 * execução, quando existir — opcional porque uma execução pode ser
 * persistida antes de um relatório ter sido gerado (`ReportService` é
 * um passo separado de `AnalysisService`, nunca acoplado a ele).
 *
 * Nenhum campo é copiado de `PipelineExecution`/`PipelineMetadata`/
 * `ExecutiveReport` — todos os três tipos são reaproveitados por
 * completo, nunca duplicados (mesmo princípio de D-015/D-016/D-017:
 * nunca uma segunda fonte de verdade para um contrato já oficial).
 */
export interface ExecutionSnapshot extends PipelineExecutionSnapshot {
  readonly report?: ExecutiveReport;
}
