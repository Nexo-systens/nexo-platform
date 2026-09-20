import type { IndicatorUnit } from "@/efos/domain";

/**
 * Formata o valor numérico de um `IndicatorResult.value` para
 * apresentação executiva (Mission 099 — Historical Intelligence &
 * Executive Presentation Integrity; unidade embutida na string desde a
 * Mission 100 — Final Executive UI Validation, Etapa 7/25, Tipo F).
 * Nunca altera o valor matemático armazenado — recebe `number`, devolve
 * `string`; o `number` original continua disponível para qualquer
 * cálculo/comparação. `Intl.NumberFormat` (`pt-BR`) evita tanto a
 * precisão bruta de ponto flutuante do JavaScript (ex.:
 * `30.186567164179106`) quanto separadores de milhar ausentes (ex.:
 * `18710` em vez de `18.710`).
 *
 * A string devolvida já é a apresentação **completa** — nenhum
 * consumidor deve concatenar `indicator.unit`/`metric.unit` (o texto
 * literal do enum, em inglês — `"currency"`/`"percentage"`/`"ratio"`/
 * `"days"`) depois desta função; fazer isso produzia exatamente o
 * defeito confirmado visualmente na Mission 100 (`"100,00%percentage"`,
 * `"8.090currency"`) — o nome técnico do enum vazando para um usuário
 * final não técnico (Tipo F — Linguagem).
 *
 * `currency`: prefixo `R$` (ex.: `8090` → `"R$ 8.090"`), sem casas à
 * força quando o valor é inteiro. `percentage`: sempre 2 casas
 * decimais fixas, sufixo `%` — os valores de indicadores de margem já
 * chegam multiplicados por 100 (`scaleResult(..., 100)`,
 * `indicators.calculator.ts`), nunca divididos aqui de novo. `days`:
 * sufixo `"dias"`, sempre arredondado para inteiro — não existe fração
 * de dia útil na apresentação executiva. `ratio`: sempre 2 casas
 * decimais fixas (ex.: `1.5` → `"1,50"`, exemplo explícito da Mission
 * 100, Etapa 7), sem sufixo — a própria grandeza (ex.: liquidez) já é
 * adimensional.
 */
export function formatIndicatorValue(value: number, unit: IndicatorUnit): string {
  switch (unit) {
    case "percentage":
      return `${new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)}%`;
    case "days": {
      const formatted = new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 0,
      }).format(value);
      return `${formatted} dias`;
    }
    case "currency": {
      const formatted = new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
      return `R$ ${formatted}`;
    }
    case "ratio":
      return new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
  }
}

/**
 * Formata um DELTA (a diferença entre dois valores do mesmo indicador —
 * nunca um valor absoluto isolado, usar `formatIndicatorValue()` para
 * isso) preservando a distinção entre ponto percentual e variação
 * percentual relativa (Mission 180 — Scenario Intelligence Foundation,
 * Seção 26; Mission 181, Seção 13; extraída para este arquivo canônico
 * pela Mission 182 — Scenario Engine Generalization, Seção 32, para que
 * qualquer consumidor de delta de indicador — Scenario Lab e a
 * comparação histórica de execuções, `ComparisonSummary.tsx` —
 * reaproveite a MESMA implementação, nunca uma segunda).
 *
 * Para `unit === "percentage"`, o delta é SEMPRE expresso em PONTOS
 * PERCENTUAIS ("p.p."), nunca como se fosse uma variação percentual
 * relativa — ex.: margem 20%→25% produz
 * `formatIndicatorDelta(5, "percentage") === "+5,00 p.p."`, nunca
 * `"+25,00%"` (que seria `(25-20)/20*100`, um cálculo que esta função
 * nunca realiza — `delta` já chega pronto, calculado como
 * `projetado - base`, nunca recalculado aqui).
 *
 * **Achado da Mission 181, corrigido pela Mission 182**: antes desta
 * missão, `ComparisonSummary.tsx` (`modules/history/`, Mission 099/100)
 * formatava seu delta reaproveitando `formatIndicatorValue()`
 * diretamente — para indicadores `percentage`, isso produzia um sufixo
 * `"%"` no delta (ex.: `"+5,00%"` para uma mudança de margem de 20
 * pontos para 25), exatamente a ambiguidade que esta função evita.
 */
export function formatIndicatorDelta(delta: number, unit: IndicatorUnit): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  const magnitude = Math.abs(delta);

  switch (unit) {
    case "percentage": {
      const formatted = new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(magnitude);
      return `${sign}${formatted} p.p.`;
    }
    case "currency": {
      const formatted = new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(magnitude);
      return `${sign}R$ ${formatted}`;
    }
    case "days": {
      const formatted = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(magnitude);
      return `${sign}${formatted} dias`;
    }
    case "ratio": {
      const formatted = new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(magnitude);
      return `${sign}${formatted}`;
    }
  }
}
