import type { HistoricalExecution } from "./HistoricalExecution";

/**
 * Camada oficial responsável por transformar as execuções já
 * persistidas de uma empresa (`ExecutionRepository.findByCompany()`,
 * Mission 027/035) numa visão histórica ordenada (Mission 085 —
 * Historical Financial Intelligence / Multi-Period Execution). Nunca
 * cria uma segunda persistência, nunca recalcula um `ExecutiveReport`,
 * nunca modifica os `ExecutionSnapshot`s originais — apenas lê,
 * extrai (`HistoricalExecution`) e ordena deterministicamente.
 *
 * Primeira implementação concreta: `DefaultHistoricalExecutionService`
 * (`DefaultHistoricalExecutionService.ts`). Único método público:
 * `getHistory()`.
 */
export interface HistoricalExecutionService {
  /**
   * Todas as execuções já persistidas da empresa, ordenadas por
   * `executedAt` crescente (mais antiga primeiro) — critério temporal
   * único e determinístico. Empresa sem execuções devolve `[]`, nunca
   * `undefined`.
   */
  getHistory(companyId: string): Promise<readonly HistoricalExecution[]>;
}
