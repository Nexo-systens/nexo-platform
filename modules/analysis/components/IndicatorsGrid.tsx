import { UnavailableValue } from "@/components/shared/UnavailableValue";
import type { Indicator } from "@/efos/domain";
import { formatIndicatorValue } from "@/lib/format-indicator";

interface IndicatorsGridProps {
  indicators: readonly Indicator[];
  // "Ver origem" (Mission 109) — opcional: sem isso, o componente
  // continua funcionando exatamente como antes (nenhum botão extra).
  onViewSource?: (indicator: Indicator) => void;
}

// Grade de metricas — apresenta exatamente `indicator.result`/`unit`
// (Indicators Engine), nenhum calculo/derivacao novo aqui (REGRA
// CENTRAL da Mission 081: "EFOS calcula, NEXO apresenta").
// `formatIndicatorValue()` (Mission 099/100) ja devolve a unidade
// embutida na string — nunca concatenar `indicator.unit` depois dela.
// "Indisponível" quando `result.status === "unavailable"` — nunca
// "R$ 0,00" (Mission 098, D-052), com a explicação genérica e sempre
// verdadeira (dado insuficiente). Mission 203: algarismos tabulares e
// escala tipográfica canônica.
export function IndicatorsGrid({ indicators, onViewSource }: IndicatorsGridProps) {
  if (indicators.length === 0) {
    return <p className="type-meta">Nenhum indicador calculado nesta seção.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-4">
      {indicators.map((indicator) => (
        <div key={indicator.id} className="flex flex-col gap-1.5 bg-surface p-4">
          <span className="type-meta">{indicator.name}</span>
          {indicator.result.status === "available" ? (
            <span className="num text-xl font-semibold tracking-tight text-foreground">
              {formatIndicatorValue(indicator.result.value, indicator.unit)}
            </span>
          ) : (
            <UnavailableValue reason="Dados insuficientes para calcular este indicador." />
          )}
          {onViewSource && indicator.result.status === "available" && (
            <button
              type="button"
              className="mt-auto self-start text-[0.6875rem] text-muted-foreground underline-offset-4 transition-colors duration-150 hover:text-primary hover:underline"
              onClick={() => onViewSource(indicator)}
            >
              Ver origem
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
