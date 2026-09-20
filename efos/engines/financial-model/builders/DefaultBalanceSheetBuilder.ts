import type { ResourceType } from "@/efos/domain";
import type { NormalizedFinancialRecord } from "@/efos/engines/data";

import type { BalanceSheetBuilder } from "./BalanceSheetBuilder";

/**
 * Os três grupos oficiais do Balanço Patrimonial exigidos pela missão,
 * mais um grupo residual para registros que a convenção de
 * classificação já estabelecida (D-004) não cobre — nunca descartados,
 * apenas preservados ao final (ver README.md).
 */
type BalanceSheetGroup = "asset" | "liability" | "equity" | "unclassified";

const GROUP_ORDER: Readonly<Record<BalanceSheetGroup, number>> = {
  asset: 0,
  liability: 1,
  equity: 2,
  unclassified: 3,
};

/**
 * Convenção de classificação de `ResourceType` já estabelecida em D-004
 * (`docs/DECISIONS.md`, `efos/engines/indicators/indicators.calculator.ts`,
 * `extractFinancialStatementInputs`) — reaproveitada aqui sem nenhuma
 * alteração, nenhuma heurística nova: `cash`/`client`/`inventory`
 * (Ativo Circulante) e `asset`/`investment` (Ativo Não Circulante) →
 * ATIVO; `supplier` (Passivo Circulante) e `loan` (Passivo Não
 * Circulante) → PASSIVO. Nenhum `ResourceType` mapeia para PATRIMÔNIO
 * LÍQUIDO — D-004 o define como identidade contábil (Ativo Total menos
 * Passivo Total), nunca como classificação de registro individual.
 * `employee`/`contract`/`product`/`service` não fazem parte da
 * convenção de D-004 e ficam no grupo residual.
 */
const RESOURCE_TYPE_GROUP: ReadonlyMap<ResourceType, "asset" | "liability"> =
  new Map([
    // Ativo Circulante, nesta ordem em D-004.
    ["cash", "asset"],
    ["client", "asset"],
    ["inventory", "asset"],
    // Ativo Não Circulante.
    ["asset", "asset"],
    ["investment", "asset"],
    // Passivo Circulante.
    ["supplier", "liability"],
    // Passivo Não Circulante.
    ["loan", "liability"],
  ]);

/**
 * Ordem dentro de cada grupo — mesma ordem circulante-antes-de-não-
 * circulante já usada por D-004/`extractFinancialStatementInputs`.
 */
const RESOURCE_TYPE_ORDER: ReadonlyMap<ResourceType, number> = new Map([
  ["cash", 0],
  ["client", 1],
  ["inventory", 2],
  ["asset", 3],
  ["investment", 4],
  ["supplier", 0],
  ["loan", 1],
]);

function groupOf(record: NormalizedFinancialRecord): BalanceSheetGroup {
  if (record.kind !== "resource" || record.resourceType === undefined) {
    return "unclassified";
  }

  return RESOURCE_TYPE_GROUP.get(record.resourceType) ?? "unclassified";
}

function typeOrderOf(record: NormalizedFinancialRecord): number {
  if (record.resourceType === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  return RESOURCE_TYPE_ORDER.get(record.resourceType) ?? Number.POSITIVE_INFINITY;
}

/**
 * Primeira implementação concreta de `BalanceSheetBuilder`
 * (Mission 054 — Balance Sheet Builder). Organiza registros financeiros
 * já normalizados nos três grupos oficiais do Balanço Patrimonial —
 * ATIVO, PASSIVO, PATRIMÔNIO LÍQUIDO — usando exclusivamente `kind` e
 * `resourceType` (campos já existentes) e a convenção de classificação
 * já estabelecida em D-004. Um quarto grupo residual ("não
 * classificado") preserva, sem descartar, qualquer registro que a
 * convenção de D-004 não cubra (eventos e os `ResourceType`
 * `employee`/`contract`/`product`/`service`).
 *
 * **Nunca cria, altera ou recalcula nada.** Cada registro devolvido é
 * exatamente o mesmo objeto recebido (mesma referência); apenas a
 * posição no array pode mudar. Como o critério de ordenação usa
 * `recordId` como desempate final e `recordId` é sempre único, o
 * critério forma uma ordem total determinística — idempotente por
 * construção: ordenar uma coleção já ordenada produz a mesma ordem.
 */
export class DefaultBalanceSheetBuilder implements BalanceSheetBuilder {
  build(
    records: readonly NormalizedFinancialRecord[]
  ): readonly NormalizedFinancialRecord[] {
    return [...records].sort((a, b) => {
      const byGroup = GROUP_ORDER[groupOf(a)] - GROUP_ORDER[groupOf(b)];
      if (byGroup !== 0) {
        return byGroup;
      }

      const byType = typeOrderOf(a) - typeOrderOf(b);
      if (byType !== 0) {
        return byType;
      }

      return a.recordId.localeCompare(b.recordId);
    });
  }
}
