import {
  FINANCIAL_EVENT_TYPES,
  type FinancialEventType,
} from "@/efos/domain";
import type { NormalizedFinancialRecord } from "@/efos/engines/data";

import type { CashFlowBuilder } from "./CashFlowBuilder";

/**
 * Os únicos dois grupos com classificação oficial já estabelecida,
 * mais o grupo residual — "Investimento"/"Financiamento" não existem
 * porque nenhuma convenção oficial os define (ver README.md).
 */
type CashFlowGroup = "operatingInflow" | "operatingOutflow" | "residual";

const GROUP_ORDER: Readonly<Record<CashFlowGroup, number>> = {
  operatingInflow: 0,
  operatingOutflow: 1,
  residual: 2,
};

/**
 * Mesma classificação de `FinancialEventType` já usada por
 * `IncomeStatementBuilder` (Mission 055) para Receitas/Custos/Despesas
 * — aqui reagrupada por direção de caixa em vez de categoria de
 * resultado: `sale`/`receipt` → entrada de caixa operacional,
 * `purchase`/`payment` → saída de caixa operacional. Mesmos valores já
 * documentados pelo Evidence Engine
 * (`efos/engines/evidence/evidence.constants.ts`,
 * `OPERATING_CASH_INFLOW_EVENT_TYPES`/`OPERATING_CASH_OUTFLOW_EVENT_TYPES`,
 * "mesmo espírito de D-004") — reproduzidos aqui como constante local,
 * não importados do Evidence Engine, porque o Evidence Engine é um
 * estágio posterior na cadeia principal do pipeline (D-006); o
 * Financial Model Engine (estágio 2) nunca deve depender de um Engine
 * posterior (estágio 5). Nenhuma heurística nova — os mesmos quatro
 * `FinancialEventType` já classificados em duas missões anteriores.
 */
const EVENT_TYPE_GROUP: ReadonlyMap<
  FinancialEventType,
  "operatingInflow" | "operatingOutflow"
> = new Map([
  ["sale", "operatingInflow"],
  ["receipt", "operatingInflow"],
  ["purchase", "operatingOutflow"],
  ["payment", "operatingOutflow"],
]);

/**
 * Ordem dentro de cada grupo — mesma ordem canônica já declarada pelo
 * vocabulário oficial da Ontologia (`FINANCIAL_EVENT_TYPES`,
 * `efos/domain/enums/domain-classification.ts`), reaproveitada dos
 * dois Builders anteriores (Missions 053/055).
 */
const EVENT_TYPE_ORDER: ReadonlyMap<FinancialEventType, number> = new Map(
  FINANCIAL_EVENT_TYPES.map((type, index) => [type, index])
);

function groupOf(record: NormalizedFinancialRecord): CashFlowGroup {
  if (record.kind !== "event" || record.eventType === undefined) {
    return "residual";
  }

  return EVENT_TYPE_GROUP.get(record.eventType) ?? "residual";
}

function typeOrderOf(record: NormalizedFinancialRecord): number {
  if (record.eventType === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  return EVENT_TYPE_ORDER.get(record.eventType) ?? Number.POSITIVE_INFINITY;
}

/**
 * Primeira implementação concreta de `CashFlowBuilder` (Mission 056 —
 * Cash Flow Builder). Organiza registros financeiros já normalizados
 * em dois grupos com classificação oficial já estabelecida — Entrada e
 * Saída de Caixa Operacional — mais um grupo residual, usando
 * exclusivamente `kind` e `eventType` (campos já existentes).
 *
 * Não existe, hoje, classificação oficial de Fluxo de Caixa de
 * Investimento ou Financiamento na Ontologia — por instrução explícita
 * da missão, nenhuma convenção nova foi criada para esses grupos.
 *
 * **Nunca cria, remove, altera ou recalcula nada.** Cada registro
 * devolvido é exatamente o mesmo objeto recebido (mesma referência);
 * apenas a posição no array pode mudar. Como o critério de ordenação
 * usa `recordId` como desempate final e `recordId` é sempre único, o
 * critério forma uma ordem total determinística — idempotente por
 * construção: ordenar uma coleção já ordenada produz a mesma ordem.
 */
export class DefaultCashFlowBuilder implements CashFlowBuilder {
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
