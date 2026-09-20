import type { ExecutionComparison } from "@/efos/application/history";
import type { IndicatorUnit } from "@/efos/domain";
import { formatIndicatorDelta, formatIndicatorValue } from "@/lib/format-indicator";
import { DIRECTION_LABEL, DIRECTION_SYMBOL } from "@/modules/history/lib/direction";

interface ComparisonSummaryProps {
  comparison: ExecutionComparison;
}

// `unit` de `MetricComparison` é `string | undefined` (D-046 — pode
// divergir entre períodos, "not-comparable"); só usamos o formatter
// dedicado quando o valor bate com um `IndicatorUnit` oficial —
// nenhum valor/unidade inventados quando não bate (Mission 099).
function isIndicatorUnit(unit: string | undefined): unit is IndicatorUnit {
  return (
    unit === "ratio" ||
    unit === "percentage" ||
    unit === "currency" ||
    unit === "days"
  );
}

function formatValue(value: number | undefined, unit: string | undefined): string {
  if (value === undefined) return "—";
  return isIndicatorUnit(unit) ? formatIndicatorValue(value, unit) : String(value);
}

// Mission 182 (Seção 32) — corrige um achado adversarial da Mission 181:
// esta função formatava o delta (`metric.absoluteChange`) reaproveitando
// `formatValue()`/`formatIndicatorValue()` diretamente, o que para
// indicadores `percentage` produzia um sufixo "%" (ex.: "+5,00%" para uma
// mudança de margem de 20 para 25 pontos) — ambíguo com uma variação
// percentual relativa. `formatIndicatorDelta()` (`lib/format-indicator.ts`,
// canônico, reaproveitado também pelo Scenario Lab) expressa esse mesmo
// caso como "+5,00 p.p." Quando a unidade não é uma `IndicatorUnit`
// reconhecida ("not-comparable", D-046), mantém o comportamento anterior
// (sinal + valor bruto, sem unidade — não há o que traduzir).
function formatDelta(value: number, unit: string | undefined): string {
  if (isIndicatorUnit(unit)) return formatIndicatorDelta(value, unit);
  return `${value > 0 ? "+" : ""}${formatValue(value, unit)}`;
}

// Apresenta exatamente `comparison.metrics` (Mission 085/086,
// `compareExecutions()`, D-045/D-046) — nenhum recalculo de
// `absoluteChange`, nenhuma nova classificacao de metrica, nenhum
// percentual (a missao proibe calcular percentual na UI). "Não
// comparável" (unidade divergente entre periodos) e mostrado
// explicitamente, nunca convertido/escondido (Mission 087).
// `formatValue()` (Mission 099/100) ja embute a unidade na string
// quando reconhece um `IndicatorUnit` oficial — nunca concatenar
// `metric.unit` bruto depois dela (mesmo defeito confirmado
// visualmente na Mission 100, Etapa 7, Tipo F: "8.090 → 8.090
// currency"). Quando `unit` nao bate com nenhum `IndicatorUnit`
// (`"not-comparable"`/D-046), o valor bruto continua sem unidade
// alguma — nao ha o que traduzir.
export function ComparisonSummary({ comparison }: ComparisonSummaryProps) {
  if (comparison.metrics.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum indicador comparável entre as duas execuções.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {comparison.metrics.map((metric) => (
        <li
          key={metric.metricName}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">
              {metric.metricName}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatValue(metric.previousValue, metric.unit)} → {formatValue(metric.currentValue, metric.unit)}
              {metric.unit && !isIndicatorUnit(metric.unit) ? ` ${metric.unit}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2 text-right">
            <span className="text-sm text-foreground">
              {DIRECTION_SYMBOL[metric.direction]} {DIRECTION_LABEL[metric.direction]}
            </span>
            {metric.absoluteChange !== undefined && (
              <span className="text-xs text-muted-foreground">
                {formatDelta(metric.absoluteChange, metric.unit)}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
