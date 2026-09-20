import {
  FINANCIAL_EVENT_TYPES,
  STATEMENT_LINE_CATEGORIES,
  type FinancialEventType,
  type StatementCategory,
} from "@/efos/domain";
import type { NormalizedFinancialRecord } from "@/efos/engines/data";

import type { IncomeStatementBuilder } from "./IncomeStatementBuilder";

/**
 * Os seis grupos exigidos pela missão, nesta ordem — "Residual" é o
 * grupo de destino de qualquer registro que as convenções já
 * estabelecidas (abaixo) não cobrem; nunca descartado, apenas
 * preservado ao final (ver README.md).
 */
type IncomeStatementGroup =
  | "revenue"
  | "cost"
  | "expense"
  | "financial"
  | "tax"
  | "residual";

const GROUP_ORDER: Readonly<Record<IncomeStatementGroup, number>> = {
  revenue: 0,
  cost: 1,
  expense: 2,
  financial: 3,
  tax: 4,
  residual: 5,
};

/**
 * Convenção de classificação de `FinancialEventType` já estabelecida:
 * `sale` → Receita, `purchase` → CMV (Custos), `payment` → Despesas
 * Operacionais (D-004, `docs/DECISIONS.md`,
 * `efos/engines/indicators/indicators.calculator.ts`,
 * `extractFinancialStatementInputs`); `receipt` → Receita, mesma
 * classificação de `sale` como entrada de caixa operacional, já
 * documentada pelo Evidence Engine ("mesmo espírito de D-004",
 * `efos/engines/evidence/evidence.constants.ts`,
 * `OPERATING_CASH_INFLOW_EVENT_TYPES`) — reaproveitadas aqui sem
 * nenhuma alteração, nenhuma heurística nova.
 *
 * Nenhum `FinancialEventType` mapeia para Financeiro ou Tributos —
 * nenhuma convenção já estabelecida no projeto classifica
 * `financing`/`renegotiation`/`delinquency`/`hiring`/`termination`/
 * `investment` (evento) como um desses grupos, e inventar essa
 * classificação seria uma heurística nova, proibida pela missão.
 */
const EVENT_TYPE_GROUP: ReadonlyMap<
  FinancialEventType,
  "revenue" | "cost" | "expense"
> = new Map([
  ["sale", "revenue"],
  ["receipt", "revenue"],
  ["purchase", "cost"],
  ["payment", "expense"],
]);

/**
 * Mission 194 — Production Executive Report Truth & Presentation Audit,
 * Seção 7/41. Confirma e corrige o defeito nomeado por três missões
 * consecutivas (191/192/193): `StatementLine` (Mission 192, D-106) —
 * uma linha de DRE já agregada por período — nunca tinha uma entrada
 * aqui, então TODA linha de demonstrativo caía em "residual" junto de
 * eventos genuinamente não classificados (`hiring`/`financing`/etc.),
 * independentemente de sua `StatementCategory` já declarada pelo
 * próprio documento. `STATEMENT_LINE_CATEGORIES` (`efos/domain/enums/
 * financial-statement.ts`) já é o vocabulário fechado e oficial — o
 * mapeamento abaixo é literal, um-para-um, para os mesmos seis grupos
 * desta demonstração (nenhuma categoria nova inventada, nenhum cálculo
 * novo): `gross_revenue`/`revenue_deductions`/`net_revenue` → Receitas
 * (a mesma seção que já recebe `sale`/`receipt`); `cost_of_goods_services`/
 * `gross_profit` → Custos (Lucro Bruto é a subtotal que fecha a seção
 * de Custos, nunca uma seção própria — a demonstração não pede um
 * sétimo grupo); `operating_expense` → Despesas; `financial_income`/
 * `financial_expense`/`financial_result` → Financeiro (grupo que já
 * existia, mas nunca recebia registro algum antes de D-106); `taxes`/
 * `net_income` → Tributos (Lucro Líquido é a última linha da
 * demonstração inteira — cai no último grupo não-residual, exatamente
 * onde uma DRE real o apresenta).
 */
const STATEMENT_CATEGORY_GROUP: ReadonlyMap<StatementCategory, IncomeStatementGroup> =
  new Map([
    ["gross_revenue", "revenue"],
    ["revenue_deductions", "revenue"],
    ["net_revenue", "revenue"],
    ["cost_of_goods_services", "cost"],
    ["gross_profit", "cost"],
    ["operating_expense", "expense"],
    ["financial_income", "financial"],
    ["financial_expense", "financial"],
    ["financial_result", "financial"],
    ["taxes", "tax"],
    ["net_income", "tax"],
  ]);

/**
 * Ordem dentro de cada grupo — mesma ordem canônica já declarada pelo
 * vocabulário oficial da Ontologia (`FINANCIAL_EVENT_TYPES`,
 * `efos/domain/enums/domain-classification.ts`), reaproveitada do
 * `FinancialStatementBuilder` (Mission 053).
 */
const EVENT_TYPE_ORDER: ReadonlyMap<FinancialEventType, number> = new Map(
  FINANCIAL_EVENT_TYPES.map((type, index) => [type, index])
);

/**
 * Ordem dentro do grupo de uma `StatementCategory` — a ordem em que
 * `STATEMENT_LINE_CATEGORIES` já declara as onze categorias (ela
 * própria já em ordem de leitura de uma DRE real: Receita Bruta →
 * Deduções → Receita Líquida → CPV → Lucro Bruto → Despesas → ... →
 * Lucro Líquido), reaproveitada sem nenhuma heurística nova — mesmo
 * princípio de `EVENT_TYPE_ORDER` acima.
 */
const STATEMENT_CATEGORY_ORDER: ReadonlyMap<StatementCategory, number> = new Map(
  STATEMENT_LINE_CATEGORIES.map((category, index) => [category, index])
);

function groupOf(record: NormalizedFinancialRecord): IncomeStatementGroup {
  if (record.kind === "statement_line") {
    return record.statementCategory === undefined
      ? "residual"
      : (STATEMENT_CATEGORY_GROUP.get(record.statementCategory) ?? "residual");
  }

  if (record.kind !== "event" || record.eventType === undefined) {
    return "residual";
  }

  return EVENT_TYPE_GROUP.get(record.eventType) ?? "residual";
}

function typeOrderOf(record: NormalizedFinancialRecord): number {
  if (record.kind === "statement_line") {
    return record.statementCategory === undefined
      ? Number.POSITIVE_INFINITY
      : (STATEMENT_CATEGORY_ORDER.get(record.statementCategory) ?? Number.POSITIVE_INFINITY);
  }

  if (record.eventType === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  return EVENT_TYPE_ORDER.get(record.eventType) ?? Number.POSITIVE_INFINITY;
}

/**
 * Primeira implementação concreta de `IncomeStatementBuilder`
 * (Mission 055 — Income Statement Builder; classificação de
 * `StatementLine` adicionada na Mission 194 — Production Executive
 * Report Truth & Presentation Audit, D-118). Organiza registros
 * financeiros já normalizados nos seis grupos da Demonstração do
 * Resultado — Receitas, Custos, Despesas, Financeiro, Tributos,
 * Residual — usando exclusivamente `kind`/`eventType`/`statementCategory`
 * (campos já existentes) e convenções já estabelecidas (D-004;
 * D-106; Evidence Engine). Desde a Mission 194, `DefaultReportService`
 * só repassa a este Builder registros com `kind !== "resource"`
 * (Resources pertencem exclusivamente ao Balanço Patrimonial) — o
 * grupo Residual, portanto, hoje só recebe `eventType` sem convenção
 * de DRE oficial (`hiring`/`termination`/`investment`/`financing`/
 * `renegotiation`/`delinquency`), nunca mais uma `StatementLine`
 * genuína (Seção 41 da missão: nenhuma categoria de `StatementCategory`
 * fica sem grupo).
 *
 * **Nunca cria, remove, altera ou recalcula nada.** Cada registro
 * devolvido é exatamente o mesmo objeto recebido (mesma referência);
 * apenas a posição no array pode mudar. Como o critério de ordenação
 * usa `recordId` como desempate final e `recordId` é sempre único, o
 * critério forma uma ordem total determinística — idempotente por
 * construção: ordenar uma coleção já ordenada produz a mesma ordem.
 */
export class DefaultIncomeStatementBuilder implements IncomeStatementBuilder {
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
