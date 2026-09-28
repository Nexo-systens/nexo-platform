import { ChangeIndicator } from "@/components/shared/ChangeIndicator";
import type { ExecutionComparison } from "@/efos/application/history";
import { describeMetricChange, isIndicatorUnit } from "@/modules/analysis/lib/metric-change";

interface ComparisonSummaryProps {
  comparison: ExecutionComparison;
}

// Comparação canônica entre duas execuções (`compareExecutions()`,
// D-045/D-046) — nenhum recálculo de `absoluteChange`, nenhum
// percentual novo. "Não comparável" (unidade divergente) continua
// explícito. Mission 204 — tabela com antes → agora e a variação pelo
// sistema de números (símbolo + valor + "melhora"/"piora" só para as
// métricas que o EFOS classifica, D-087).
export function ComparisonSummary({ comparison }: ComparisonSummaryProps) {
  if (comparison.metrics.length === 0) {
    return <p className="type-body">Nenhum indicador comparável entre as duas execuções.</p>;
  }

  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-[32rem] border-collapse text-sm">
      <caption className="sr-only">Variação dos indicadores entre as duas análises</caption>
      <thead>
        <tr className="border-b border-border text-left">
          <th scope="col" className="py-2 pr-4 type-meta font-medium">Indicador</th>
          <th scope="col" className="py-2 pr-4 text-right type-meta font-medium">Antes</th>
          <th scope="col" className="py-2 pr-4 text-right type-meta font-medium">Agora</th>
          <th scope="col" className="py-2 text-right type-meta font-medium">Variação</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {comparison.metrics.map((metric) => {
          const change = describeMetricChange(metric);
          const rawUnit = metric.unit && !isIndicatorUnit(metric.unit) ? ` ${metric.unit}` : "";
          return (
            <tr key={metric.metricName}>
              <th scope="row" className="py-2.5 pr-4 text-left font-medium text-foreground">
                {metric.metricName}
              </th>
              <td className="num whitespace-nowrap py-2.5 pr-4 text-right text-foreground-secondary">
                {change.previousText}
                {rawUnit}
              </td>
              <td className="num whitespace-nowrap py-2.5 pr-4 text-right font-medium text-foreground">
                {change.currentText}
                {rawUnit}
              </td>
              <td className="whitespace-nowrap py-2.5 text-right">
                <ChangeIndicator change={change} className="justify-end" />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
