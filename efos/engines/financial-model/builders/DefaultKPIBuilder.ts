import type { FinancialStateCategory, Indicator } from "@/efos/domain";

import type { KPIBuilder } from "./KPIBuilder";

/**
 * Os cinco grupos exigidos pela missão, nesta ordem exata (Liquidez →
 * Rentabilidade → Endividamento → Eficiência → Crescimento), mais um
 * grupo residual — nunca descartado, apenas preservado ao final (ver
 * README.md).
 */
type KPIGroup =
  | "liquidity"
  | "profitability"
  | "debt"
  | "efficiency"
  | "growth"
  | "residual";

const GROUP_ORDER: Readonly<Record<KPIGroup, number>> = {
  liquidity: 0,
  profitability: 1,
  debt: 2,
  efficiency: 3,
  growth: 4,
  residual: 5,
};

/**
 * `Indicator.category` já é um `FinancialStateCategory`
 * (`efos/domain/enums/domain-classification.ts`) — o vocabulário
 * oficial da Ontologia. Quatro dos oito valores desse enum
 * correspondem diretamente aos grupos pedidos pela missão (mesmo
 * nome, nenhuma tradução/heurística: `liquidity`→Liquidez,
 * `profitability`→Rentabilidade, `debt`→Endividamento,
 * `efficiency`→Eficiência, `growth`→Crescimento); os quatro restantes
 * (`solvency`, `risk`, `competitiveness`, e qualquer categoria não
 * reconhecida) não têm grupo pedido pela missão e vão para o grupo
 * residual.
 */
const CATEGORY_GROUP: ReadonlyMap<
  FinancialStateCategory,
  Exclude<KPIGroup, "residual">
> = new Map([
  ["liquidity", "liquidity"],
  ["profitability", "profitability"],
  ["debt", "debt"],
  ["efficiency", "efficiency"],
  ["growth", "growth"],
]);

function groupOf(indicator: Indicator): KPIGroup {
  return CATEGORY_GROUP.get(indicator.category) ?? "residual";
}

/**
 * Primeira implementação concreta de `KPIBuilder` (Mission 057 — KPI
 * Builder). Organiza indicadores financeiros (`Indicator`, domínio
 * oficial) nos cinco grupos exigidos pela missão — Liquidez,
 * Rentabilidade, Endividamento, Eficiência, Crescimento — mais um
 * grupo residual, usando exclusivamente `category` (campo já
 * existente). Desempate final por `name` — `Indicator` não tem um
 * campo `code` separado; `name` é o único campo do contrato oficial
 * que identifica de forma legível e estável qual indicador é qual
 * (mesmo racional já documentado pelo Evidence Engine,
 * `efos/engines/evidence/evidence.constants.ts`,
 * `RECOGNIZED_INDICATOR_NAMES`), cumprindo o papel de "código oficial
 * do indicador" pedido pela missão.
 *
 * **Nunca recalcula, cria, remove ou altera nada.** Cada indicador
 * devolvido é exatamente o mesmo objeto recebido (mesma referência);
 * apenas a posição no array pode mudar. Como `name` é único por
 * indicador (`INDICATOR_DEFINITIONS`, `efos/engines/indicators/
 * indicators.constants.ts` — nenhum nome duplicado), o critério
 * (grupo → nome) forma uma ordem total determinística — idempotente
 * por construção: ordenar uma coleção já ordenada produz a mesma
 * ordem.
 */
export class DefaultKPIBuilder implements KPIBuilder {
  build(indicators: readonly Indicator[]): readonly Indicator[] {
    return [...indicators].sort((a, b) => {
      const byGroup = GROUP_ORDER[groupOf(a)] - GROUP_ORDER[groupOf(b)];
      if (byGroup !== 0) {
        return byGroup;
      }

      return a.name.localeCompare(b.name);
    });
  }
}
