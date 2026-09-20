import type { FinancialStateCategory, Indicator } from "@/efos/domain";

import type { FinancialRiskBuilder } from "./FinancialRiskBuilder";

/**
 * Os cinco grupos exigidos pela missão, nesta ordem exata
 * (Endividamento → Liquidez → Rentabilidade → Eficiência →
 * Crescimento), mais um grupo residual — nunca descartado, apenas
 * preservado ao final (ver README.md).
 */
type FinancialRiskGroup =
  | "debt"
  | "liquidity"
  | "profitability"
  | "efficiency"
  | "growth"
  | "residual";

const GROUP_ORDER: Readonly<Record<FinancialRiskGroup, number>> = {
  debt: 0,
  liquidity: 1,
  profitability: 2,
  efficiency: 3,
  growth: 4,
  residual: 5,
};

/**
 * `Indicator.category` já é um `FinancialStateCategory`
 * (`efos/domain/enums/domain-classification.ts`) — o vocabulário
 * oficial da Ontologia. Cinco dos oito valores desse enum correspondem
 * diretamente aos grupos exigidos por esta missão (mesmo nome, nenhuma
 * tradução/heurística: `debt`→Endividamento, `liquidity`→Liquidez,
 * `profitability`→Rentabilidade, `efficiency`→Eficiência,
 * `growth`→Crescimento); os três restantes (`solvency`, `risk`,
 * `competitiveness`, e qualquer categoria não reconhecida) não estão
 * explicitamente mapeados por esta missão e vão para o grupo residual
 * — regra explícita do "REGRAS": "Residual: qualquer categoria
 * existente que não esteja explicitamente mapeada acima". Diferente de
 * `FinancialHealthBuilder` (Mission 058), que agrupava `debt` como
 * "Solvência" e deixava `debt` no residual — esta missão pede
 * "Endividamento" para `debt`, mesmo mapeamento já usado por
 * `KPIBuilder` (Mission 057).
 */
const CATEGORY_GROUP: ReadonlyMap<
  FinancialStateCategory,
  Exclude<FinancialRiskGroup, "residual">
> = new Map([
  ["debt", "debt"],
  ["liquidity", "liquidity"],
  ["profitability", "profitability"],
  ["efficiency", "efficiency"],
  ["growth", "growth"],
]);

function groupOf(indicator: Indicator): FinancialRiskGroup {
  return CATEGORY_GROUP.get(indicator.category) ?? "residual";
}

/**
 * Primeira implementação concreta de `FinancialRiskBuilder` (Mission
 * 059 — Financial Risk Builder). Organiza indicadores financeiros
 * (`Indicator`, domínio oficial) nos cinco grupos exigidos pela missão
 * — Endividamento, Liquidez, Rentabilidade, Eficiência, Crescimento —
 * mais um grupo residual, usando exclusivamente `category` (campo já
 * existente). Desempate final por `name` — mesma resolução já
 * documentada em `KPIBuilder` (Mission 057) e `FinancialHealthBuilder`
 * (Mission 058): `Indicator` não tem um campo `code` separado; `name`
 * é o único campo do contrato oficial que identifica de forma legível
 * e estável qual indicador é qual.
 *
 * **Nunca calcula score, probabilidade ou risco; nunca cria rating ou
 * classificação; nunca infere alerta, perigo ou solvência.** Este
 * Builder organiza — ele não interpreta. Cada indicador devolvido é
 * exatamente o mesmo objeto recebido (mesma referência); apenas a
 * posição no array pode mudar. Como `name` é único por indicador
 * (`INDICATOR_DEFINITIONS`, `efos/engines/indicators/
 * indicators.constants.ts` — nenhum nome duplicado), o critério (grupo
 * → nome) forma uma ordem total determinística — idempotente por
 * construção: ordenar uma coleção já ordenada produz a mesma ordem.
 */
export class DefaultFinancialRiskBuilder implements FinancialRiskBuilder {
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
