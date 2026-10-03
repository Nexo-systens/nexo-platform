import { UnavailableValue } from "@/components/shared/UnavailableValue";
import type { ScenarioMetricComparison } from "@/efos/application/scenario-simulation";
import { INDICATOR_DEFINITIONS } from "@/efos/engines/indicators";
import { formatIndicatorValue } from "@/lib/format-indicator";
import { cn } from "@/lib/utils";
import { formatScenarioMetricDelta } from "@/modules/scenarios/lib/scenario-language";

const IMPACT_LABEL: Readonly<Record<"favorable" | "unfavorable" | "neutral", string>> = {
  favorable: "melhora",
  unfavorable: "piora",
  neutral: "sem efeito",
};

const IMPACT_TONE: Readonly<Record<"favorable" | "unfavorable" | "neutral", string>> = {
  favorable: "text-positive-soft-foreground",
  unfavorable: "text-negative-soft-foreground",
  neutral: "text-muted-foreground",
};

/**
 * Mission 204 — comparação lado a lado: base (última análise) × cenário ×
 * diferença. Os valores, a diferença e o impacto (favorável/desfavorável)
 * vêm prontos do `ScenarioProjection` (Scenario Engine) — nada é
 * recalculado aqui. O impacto aparece em palavra e cor, nunca só em cor;
 * indicador indisponível continua "Indisponível", nunca zero.
 */
export function ScenarioImpactTable({
  metricKeys,
  comparison,
  caption,
  baselineLabel = "Base atual",
}: {
  metricKeys: readonly string[];
  comparison: Readonly<Record<string, ScenarioMetricComparison | undefined>>;
  caption: string;
  /** Mission 208 — no relatório executivo a base é a do período do relatório, não a "atual". */
  baselineLabel?: string;
}) {
  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-[32rem] border-collapse text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-border-strong text-left">
          <th scope="col" className="py-2 pr-4 type-meta font-medium">Indicador</th>
          <th scope="col" className="py-2 pr-4 text-right type-meta font-medium">{baselineLabel}</th>
          <th scope="col" className="py-2 pr-4 text-right type-meta font-medium">Com o cenário</th>
          <th scope="col" className="py-2 text-right type-meta font-medium">Diferença</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {metricKeys.map((key) => {
          const entry = comparison[key];
          const label = INDICATOR_DEFINITIONS[key as keyof typeof INDICATOR_DEFINITIONS]?.name ?? key;
          if (!entry || entry.status !== "compared") {
            return (
              <tr key={key}>
                <th scope="row" className="py-3 pr-4 text-left font-medium text-foreground">{label}</th>
                <td colSpan={3} className="py-3 text-right">
                  <UnavailableValue reason="Indisponível nesta empresa." />
                </td>
              </tr>
            );
          }
          return (
            <tr key={key}>
              <th scope="row" className="py-3 pr-4 text-left font-medium text-foreground">{label}</th>
              <td className="num whitespace-nowrap py-3 pr-4 text-right text-foreground-secondary">
                {formatIndicatorValue(entry.baselineValue, entry.unit)}
              </td>
              <td className="num whitespace-nowrap py-3 pr-4 text-right text-[0.9375rem] font-semibold text-foreground">
                {formatIndicatorValue(entry.projectedValue, entry.unit)}
              </td>
              <td className={cn("num whitespace-nowrap py-3 text-right font-medium", IMPACT_TONE[entry.impact])}>
                {formatScenarioMetricDelta(entry.delta, entry.unit)}
                <span className="ml-1.5 text-[0.75rem] font-normal">· {IMPACT_LABEL[entry.impact]}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
