import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ChangeIndicator } from "@/components/shared/ChangeIndicator";
import { SemanticBadge } from "@/components/shared/SemanticBadge";
import type { HeadlineMetric } from "@/modules/analysis/lib/executive-situation";
import { comparisonUnavailableShort } from "@/modules/analysis/lib/temporal-comparison-language";
import type { PortfolioPriority, PortfolioRow } from "@/modules/dashboard/lib/portfolio-command";

const TREND_LABEL: Readonly<Record<PortfolioRow["trend"], { label: string; tone: "negative" | "positive" | "warning" | "neutral" }>> = {
  worsening: { label: "Piorando", tone: "negative" },
  improving: { label: "Melhorando", tone: "positive" },
  mixed: { label: "Sinais mistos", tone: "warning" },
  stable: { label: "Estável", tone: "neutral" },
  unknown: { label: "Sem comparação", tone: "neutral" },
};

function MetricCell({ metric }: { metric?: HeadlineMetric }) {
  if (!metric) return <span className="type-meta">—</span>;
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="num font-medium text-foreground">{metric.valueText ?? "Indisponível"}</span>
      {metric.change && <ChangeIndicator change={metric.change} showWord={false} className="text-[0.75rem]" />}
    </div>
  );
}

/**
 * Mission 204 — movimento do portfólio: uma linha por empresa, com o
 * período analisado, as duas métricas de manchete mais lidas por um CFO
 * (margem líquida e liquidez corrente) com variação, a tendência segundo
 * o EFOS, as decisões pendentes e o próximo passo.
 */
export function PortfolioMovementTable({ rows }: { rows: readonly PortfolioRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <caption className="sr-only">Movimento das empresas desde o período anterior</caption>
        <thead>
          <tr className="border-b border-border-strong text-left">
            <th scope="col" className="py-2.5 pr-4 whitespace-nowrap type-meta font-medium">Empresa</th>
            <th scope="col" className="py-2.5 pr-4 whitespace-nowrap type-meta font-medium">Período</th>
            <th scope="col" className="py-2.5 pr-4 text-right whitespace-nowrap type-meta font-medium">Margem líquida</th>
            <th scope="col" className="py-2.5 pr-4 text-right whitespace-nowrap type-meta font-medium">Liquidez corrente</th>
            <th scope="col" className="py-2.5 pr-4 whitespace-nowrap type-meta font-medium">Tendência</th>
            <th scope="col" className="py-2.5 pr-4 text-right whitespace-nowrap type-meta font-medium">Decisões</th>
            <th scope="col" className="py-2.5 type-meta font-medium">
              <span className="sr-only">Próximo passo</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const trend =
              row.trend === "unknown" ? { ...TREND_LABEL.unknown, label: comparisonUnavailableShort(row.comparisonState) } : TREND_LABEL[row.trend];
            return (
              <tr key={row.company.id} className="align-top transition-colors duration-150 hover:bg-surface-subtle/60">
                <th scope="row" className="py-4 pr-4 text-left font-normal">
                  <Link href={row.company.href} className="font-medium text-foreground underline-offset-4 hover:underline">
                    {row.company.name}
                  </Link>
                  <p className="type-meta mt-0.5">{row.company.stageLabel}</p>
                </th>
                <td className="num whitespace-nowrap py-4 pr-4 text-foreground-secondary">{row.periodShort ?? "—"}</td>
                <td className="whitespace-nowrap py-4 pr-4 text-right">
                  <MetricCell metric={row.netMargin} />
                </td>
                <td className="whitespace-nowrap py-4 pr-4 text-right">
                  <MetricCell metric={row.currentLiquidity} />
                </td>
                <td className="py-4 pr-4">
                  <SemanticBadge tone={trend.tone}>{trend.label}</SemanticBadge>
                </td>
                <td className="num py-4 pr-4 text-right">
                  {row.pendingDecisions > 0 ? (
                    <span className="font-semibold text-foreground">{row.pendingDecisions}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap py-4 text-right">
                  <Link
                    href={row.company.nextStep.href}
                    className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {row.company.nextStep.label}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PortfolioPriorities({ priorities }: { priorities: readonly PortfolioPriority[] }) {
  if (priorities.length === 0) {
    return <p className="type-body">Nenhum sinal adverso nas últimas análises.</p>;
  }
  return (
    <ol className="flex flex-col divide-y divide-border border-y border-border">
      {priorities.slice(0, 5).map((priority, index) => (
        <li key={`${priority.companyId}-${priority.signal.id}`} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-3 py-3.5">
          <span className="num pt-0.5 text-[0.75rem] font-semibold text-muted-foreground">{index + 1}</span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm font-medium text-foreground">{priority.signal.title}</p>
            <Link href={priority.href} className="type-meta w-fit underline-offset-4 hover:underline">
              {priority.companyName}
            </Link>
          </div>
          <SemanticBadge tone={priority.signal.tag.tone}>{priority.signal.tag.label}</SemanticBadge>
        </li>
      ))}
    </ol>
  );
}
