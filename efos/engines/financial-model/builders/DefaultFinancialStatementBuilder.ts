import {
  FINANCIAL_EVENT_TYPES,
  RESOURCE_TYPES,
  STATEMENT_LINE_CATEGORIES,
  type FinancialEventType,
  type ResourceType,
} from "@/efos/domain";
import type { CandidateFinancialRecord } from "@/efos/engines/data";

import type { FinancialStatementBuilder } from "./FinancialStatementBuilder";

/**
 * Ordem canônica de `kind` na demonstração: recursos (Camada 1 da
 * Ontologia) antes de eventos (Camada 2) — mesma convenção estrutural
 * já usada por `FinancialModelAggregate` (`root` + `resources` +
 * `events`, `efos/domain`), nenhuma ordem inventada. `statement_line`
 * (Mission 192 — Canonical Financial Statement Ingestion & Period
 * Semantics, D-106) ordenado por último — este builder permanece
 * definitivamente não integrado a `FinancialModelEngine.execute()`
 * (D-033/D-041), então esta é apenas uma atualização mecânica de tipo
 * para o `kind` fechado ter crescido, nunca uma decisão de produto
 * nova sobre como demonstrativos deveriam aparecer aqui.
 */
const KIND_ORDER: Readonly<Record<CandidateFinancialRecord["kind"], number>> = {
  resource: 0,
  event: 1,
  statement_line: 2,
};

const STATEMENT_CATEGORY_ORDER: ReadonlyMap<string, number> = new Map(
  STATEMENT_LINE_CATEGORIES.map((category, index) => [category, index])
);

/**
 * Ordem canônica de `resourceType`/`eventType` dentro de cada `kind` —
 * a mesma ordem já declarada pelo vocabulário oficial da Ontologia
 * (`RESOURCE_TYPES`/`FINANCIAL_EVENT_TYPES`, `efos/domain/enums/
 * domain-classification.ts`), nenhuma heurística nova. Registros sem
 * `resourceType`/`eventType` detectado ficam ao final do seu grupo de
 * `kind` (índice maior que qualquer tipo conhecido).
 */
const RESOURCE_TYPE_ORDER: ReadonlyMap<ResourceType, number> = new Map(
  RESOURCE_TYPES.map((type, index) => [type, index])
);
const EVENT_TYPE_ORDER: ReadonlyMap<FinancialEventType, number> = new Map(
  FINANCIAL_EVENT_TYPES.map((type, index) => [type, index])
);

function typeOrderOf(record: CandidateFinancialRecord): number {
  if (record.kind === "resource") {
    return record.resourceType === undefined
      ? RESOURCE_TYPES.length
      : (RESOURCE_TYPE_ORDER.get(record.resourceType) ?? RESOURCE_TYPES.length);
  }

  if (record.kind === "statement_line") {
    return record.statementCategory === undefined
      ? STATEMENT_LINE_CATEGORIES.length
      : (STATEMENT_CATEGORY_ORDER.get(record.statementCategory) ??
          STATEMENT_LINE_CATEGORIES.length);
  }

  return record.eventType === undefined
    ? FINANCIAL_EVENT_TYPES.length
    : (EVENT_TYPE_ORDER.get(record.eventType) ?? FINANCIAL_EVENT_TYPES.length);
}

/**
 * Primeira implementação concreta de `FinancialStatementBuilder`
 * (Mission 053 — Financial Statement Builder). Consolida registros
 * financeiros candidatos em uma demonstração organizada: agrupa por
 * `kind` (recursos antes de eventos, "separar por tipo"/"separar
 * recursos"/"separar eventos"), depois por `resourceType`/`eventType`
 * na ordem canônica já declarada pela Ontologia ("agrupar registros",
 * "consolidar estrutura"), e por fim por `recordId` (sempre único) como
 * desempate determinístico final ("ordenar registros").
 *
 * **Nunca cria, altera ou recalcula nada.** Cada registro devolvido é
 * exatamente o mesmo objeto recebido (mesma referência); apenas a
 * posição no array pode mudar. Como o critério de ordenação usa
 * `recordId` como desempate final e `recordId` é sempre único, o
 * critério forma uma ordem total determinística — idempotente por
 * construção: ordenar uma coleção já ordenada produz a mesma ordem.
 */
export class DefaultFinancialStatementBuilder
  implements FinancialStatementBuilder
{
  build(
    records: readonly CandidateFinancialRecord[]
  ): readonly CandidateFinancialRecord[] {
    return [...records].sort((a, b) => {
      const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
      if (byKind !== 0) {
        return byKind;
      }

      const byType = typeOrderOf(a) - typeOrderOf(b);
      if (byType !== 0) {
        return byType;
      }

      return a.recordId.localeCompare(b.recordId);
    });
  }
}
