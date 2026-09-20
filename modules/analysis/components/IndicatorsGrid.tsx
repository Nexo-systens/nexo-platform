import { Button } from "@/components/ui/button";
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
// embutida na string ("R$ 8.090", "30,19%", "0 dias") — nunca
// concatenar `indicator.unit` (o nome literal do enum, em ingles)
// depois dela: produzia exatamente o defeito confirmado visualmente na
// Mission 100 ("100,00%percentage", "8.090currency", Tipo F).
// "Não disponível" quando `result.status === "unavailable"` — nunca
// "R$ 0,00" (Mission 098, D-052); acompanhado de uma explicacao
// generica e sempre verdadeira (`unavailable` so significa "dado
// insuficiente para calcular", nunca uma causa especifica que o
// contrato de `IndicatorResult` nao carrega, D-052) — sem isso, o
// usuario via apenas o texto sem nenhum "porque"/"o que fazer"
// (Mission 100, Etapa 19).
export function IndicatorsGrid({ indicators, onViewSource }: IndicatorsGridProps) {
  if (indicators.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum indicador calculado nesta seção.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {indicators.map((indicator) => (
        <div
          key={indicator.id}
          className="flex flex-col gap-1 rounded-lg border border-border p-3"
        >
          <span className="text-xs text-muted-foreground">
            {indicator.name}
          </span>
          {indicator.result.status === "available" ? (
            <span className="text-lg font-semibold text-foreground">
              {formatIndicatorValue(indicator.result.value, indicator.unit)}
            </span>
          ) : (
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-muted-foreground">
                Não disponível
              </span>
              <span className="text-xs text-muted-foreground">
                Dados insuficientes para calcular este indicador
              </span>
            </span>
          )}
          {onViewSource && indicator.result.status === "available" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 h-auto self-start px-0 text-xs font-normal text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => onViewSource(indicator)}
            >
              Ver origem
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
