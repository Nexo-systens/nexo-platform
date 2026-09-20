import type { FinancialStateCategory, Indicator } from "@/efos/domain";

import type { FinancialHealthBuilder } from "./FinancialHealthBuilder";

/**
 * Os cinco grupos exigidos pela missão, nesta ordem exata (Liquidez →
 * Solvência → Rentabilidade → Eficiência → Crescimento), mais um grupo
 * residual — nunca descartado, apenas preservado ao final (ver
 * README.md).
 */
type FinancialHealthGroup =
  | "liquidity"
  | "solvency"
  | "profitability"
  | "efficiency"
  | "growth"
  | "residual";

const GROUP_ORDER: Readonly<Record<FinancialHealthGroup, number>> = {
  liquidity: 0,
  solvency: 1,
  profitability: 2,
  efficiency: 3,
  growth: 4,
  residual: 5,
};

/**
 * `Indicator.category` já é um `FinancialStateCategory`
 * (`efos/domain/enums/domain-classification.ts`) — o vocabulário
 * oficial da Ontologia. Cinco dos oito valores desse enum correspondem
 * diretamente aos grupos pedidos por esta missão (mesmo nome, nenhuma
 * tradução/heurística: `liquidity`→Liquidez, `solvency`→Solvência,
 * `profitability`→Rentabilidade, `efficiency`→Eficiência,
 * `growth`→Crescimento); os três restantes (`debt`, `risk`,
 * `competitiveness`, e qualquer categoria não reconhecida) não têm
 * grupo pedido por esta missão e vão para o grupo residual. Diferente
 * de `KPIBuilder` (Mission 057), que agrupava `debt` como
 * "Endividamento" — esta missão pede "Solvência" no lugar, não
 * "Endividamento"; nenhum dos vinte indicadores hoje calculados pelo
 * Indicators Engine usa `category: "solvency"`
 * (`efos/engines/indicators/indicators.constants.ts`,
 * `INDICATOR_DEFINITIONS`), então o grupo Solvência é estruturalmente
 * vazio nesta implementação — não por omissão, mas porque nenhum
 * indicador existente pertence a ele hoje.
 */
const CATEGORY_GROUP: ReadonlyMap<
  FinancialStateCategory,
  Exclude<FinancialHealthGroup, "residual">
> = new Map([
  ["liquidity", "liquidity"],
  ["solvency", "solvency"],
  ["profitability", "profitability"],
  ["efficiency", "efficiency"],
  ["growth", "growth"],
]);

function groupOf(indicator: Indicator): FinancialHealthGroup {
  return CATEGORY_GROUP.get(indicator.category) ?? "residual";
}

/**
 * Primeira implementação concreta de `FinancialHealthBuilder` (Mission
 * 058 — Financial Health Builder). Organiza indicadores financeiros
 * (`Indicator`, domínio oficial) nos cinco grupos exigidos pela missão
 * — Liquidez, Solvência, Rentabilidade, Eficiência, Crescimento — mais
 * um grupo residual, usando exclusivamente `category` (campo já
 * existente). Desempate final por `name` — mesma resolução já
 * documentada em `KPIBuilder` (Mission 057): `Indicator` não tem um
 * campo `code` separado; `name` é o único campo do contrato oficial
 * que identifica de forma legível e estável qual indicador é qual,
 * cumprindo o papel de "código oficial do indicador" pedido pela
 * missão.
 *
 * **Nunca recalcula, cria, remove ou altera nada — nenhum score, nota
 * ou classificação é criado.** Cada indicador devolvido é exatamente o
 * mesmo objeto recebido (mesma referência); apenas a posição no array
 * pode mudar. Como `name` é único por indicador
 * (`INDICATOR_DEFINITIONS`, `efos/engines/indicators/
 * indicators.constants.ts` — nenhum nome duplicado), o critério (grupo
 * → nome) forma uma ordem total determinística — idempotente por
 * construção: ordenar uma coleção já ordenada produz a mesma ordem.
 */
export class DefaultFinancialHealthBuilder implements FinancialHealthBuilder {
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
