import type { NormalizedFinancialRecord } from "@/efos/engines/data";
import type { Period } from "@/efos/domain";

/**
 * Mission 156 — Synthetic Company Validation Foundation.
 *
 * **Achado real da auditoria (Etapa 1/B)**: `Resource` (Domain) não
 * carrega nenhum campo de data — `extractFinancialStatementInputs()`
 * (`efos/engines/indicators/indicators.calculator.ts`) SOMA todos os
 * `Resource`s de um `FinancialModelAggregate` de uma vez, sem nenhuma
 * noção de "saldo em uma data". Isso significa que um `FinancialModelAggregate`
 * representa sempre um ÚNICO instante (o saldo atual), nunca uma série
 * temporal de saldos dentro de si mesmo — a evolução mês a mês só pode
 * ser representada como MÚLTIPLOS `FinancialModelAggregate`s
 * independentes (um por período), exatamente como o pipeline real já
 * faz entre execuções sucessivas (`compareExecutions()`, D-045/D-046,
 * reaproveitado por `FinancialOutcomeObservation`, D-071). Por isso
 * `SyntheticFinancialDataset` é uma coleção de períodos independentes,
 * nunca um único `NormalizedFinancialRecord[]` combinando saldos de
 * meses diferentes (que a engine somaria incorretamente).
 *
 * Cada período contém: `resources` (saldos de fim de período — cash/
 * client/inventory/supplier/loan/asset, D-004) e `events` (fluxos
 * ocorridos DURANTE o período — sale/purchase/payment/interest_expense).
 * `records` é a junção dos dois, no formato oficial de saída do Data
 * Engine (`NormalizedFinancialRecord`, D-002) — pronta para
 * `FinancialModelEngine.execute({ companyId, records })` sem nenhuma
 * transformação adicional.
 */
export interface SyntheticFinancialPeriod {
  readonly periodIndex: number;
  readonly period: Period;
  readonly records: readonly NormalizedFinancialRecord[];
}

export interface SyntheticFinancialDataset {
  readonly companyId: string;
  readonly periods: readonly SyntheticFinancialPeriod[];
}
