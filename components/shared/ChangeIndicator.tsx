import { cn } from "@/lib/utils";
import type { MetricChangePresentation } from "@/modules/analysis/lib/metric-change";

const TONE: Readonly<Record<MetricChangePresentation["desirability"], string>> = {
  favorable: "text-positive-soft-foreground",
  unfavorable: "text-negative-soft-foreground",
  neutral: "text-foreground-secondary",
};

/**
 * Mission 204 — variação de uma métrica entre análises. Símbolo, valor
 * com sinal e, quando o EFOS classifica a métrica, a palavra "melhora"/
 * "piora": a cor só reforça, nunca é a única informação.
 */
export function ChangeIndicator({
  change,
  className,
  showWord = true,
}: {
  change: MetricChangePresentation;
  className?: string;
  showWord?: boolean;
}) {
  return (
    <span className={cn("num inline-flex items-baseline gap-1 text-[0.8125rem] font-medium", TONE[change.desirability], className)}>
      {change.symbol && <span aria-hidden="true">{change.symbol}</span>}
      <span aria-hidden="true">{change.deltaText ?? change.directionLabel}</span>
      {showWord && change.desirabilityLabel && (
        <span aria-hidden="true" className="text-[0.75rem] font-normal">
          · {change.desirabilityLabel.toLowerCase()}
        </span>
      )}
      <span className="sr-only">{change.accessibleText}</span>
    </span>
  );
}
