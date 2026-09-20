import type { StatementCategory, StatementType } from "../enums";
import type { Money, Period } from "../value-objects";
import type { DomainEntity } from "./base";

/**
 * Linha de demonstrativo financeiro — um valor agregado por PERIODO
 * (Mission 192 — Canonical Financial Statement Ingestion & Period
 * Semantics), nunca uma transacao datada (`FinancialEvent`) nem um
 * saldo pontual (`Resource`). Representa exatamente o que um DRE/
 * Balancete real declara: "Despesas Administrativas de Julho/2026
 * somaram R$ 80.000,00" — um fato ja agregado pelo proprio documento,
 * nunca decomposto em eventos individuais que o documento nao fornece
 * (ver docs/DECISIONS.md D-106).
 *
 * `period` (nunca `occurredAt`): o intervalo que o demonstrativo cobre
 * (ex.: `2026-07-01` a `2026-07-31`) — sempre o mesmo para todas as
 * `StatementLine`s do mesmo documento (Secao 9 da Mission 192: o
 * periodo pertence ao DOCUMENTO, nunca a uma linha individual).
 *
 * `isTotalLine` (Secao 32 da Mission 192): quando `true`, esta linha e
 * um total/subtotal explicito do documento para esta `category` (ex.:
 * "Total de Despesas Operacionais") — usado por
 * `extractFinancialStatementInputs()` para preferir o total sobre a
 * soma dos componentes da mesma categoria, evitando contagem em
 * dobro quando o documento lista componentes E o total.
 *
 * `id` segue exatamente a mesma convencao de `recordId` ja usada por
 * `Resource`/`FinancialEvent` (`"${documentId}-${lineIndex}"`, Mission
 * 108/D-055) e `provenance.source` carrega o nome do arquivo de
 * origem (mesmo padrao de `buildProvenance()`,
 * `financial-model.mapper.ts`) — nenhum mecanismo de rastreabilidade
 * novo, apenas reaproveitado.
 */
export interface StatementLine extends DomainEntity {
  readonly companyId: string;
  readonly financialModelId: string;
  readonly statementType: StatementType;
  readonly category: StatementCategory;
  readonly label: string;
  readonly amount?: Money;
  readonly period: Period;
  readonly isTotalLine: boolean;
}
