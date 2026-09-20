import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinancialEpisodeStateResult } from "@/efos/application/financial-episodes";
import { cn } from "@/lib/utils";
import {
  episodeStateTone,
  formatPeriod,
  translateDeterminabilityReason,
  translateEpisodeState,
  translateMetricKey,
} from "@/modules/analysis/lib/executive-language";

const TONE_BADGE_CLASSNAME: Record<
  ReturnType<typeof episodeStateTone>,
  string
> = {
  positive: "border-success/30 bg-success/10 text-success",
  negative: "border-destructive/30 bg-destructive/10 text-destructive",
  neutral: "border-warning/30 bg-warning/10 text-warning",
};

interface ExecutiveTrajectoryPanelProps {
  /**
   * `ExecutiveFinancialContext.financialEpisodes` (D-087/Mission 172) —
   * `undefined` quando a execução não alcançou os 5 estágios
   * necessários (indicadores/evidência/contexto/raciocínio/
   * recomendação) ou quando o período atual não pôde ser derivado
   * (`DefaultEFOSFacade.buildExecutiveContext()`) — nunca uma trajetória
   * fabricada nesse caso.
   */
  financialEpisodes?: readonly FinancialEpisodeStateResult[];
}

/**
 * Mission 177 — Executive Intelligence Experience. Primeira superfície
 * de UI para `financialEpisodes` (D-087/Mission 171/172) — até esta
 * missão, essa inteligência só alcançava o prompt da Executive AI
 * (`activateExecutiveDiagnosisAction()`), nunca um humano diretamente.
 * Responde "O que está mudando?" (Seção 7 da missão): apresenta,
 * exatamente na ordem em que `financialEpisodes` já chega (nunca
 * reordenado/filtrado aqui), cada uma das 8 métricas temporais (D-087)
 * com seu estado, contagem de observações e período observado.
 *
 * `NOT_DETERMINABLE` é sempre mostrado, nunca ocultado (Seção 9 da
 * missão) — com o motivo traduzido para linguagem executiva — mas
 * nunca estilizado como erro (tom neutro/`warning`, não
 * `destructive`), para não sugerir que o painel está quebrado.
 *
 * Puramente apresentacional: nenhum estado é recalculado/reclassificado
 * aqui — apenas traduzido via `executive-language.ts`.
 */
export function ExecutiveTrajectoryPanel({
  financialEpisodes,
}: ExecutiveTrajectoryPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trajetória Financeira</CardTitle>
      </CardHeader>
      <CardContent>
        {!financialEpisodes && (
          <p className="text-sm text-muted-foreground">
            A trajetória financeira exige indicadores, evidências, contexto,
            raciocínio e recomendação completos nesta execução — uma ou mais
            etapas não foi alcançada, então nenhuma tendência é apresentada
            aqui.
          </p>
        )}

        {financialEpisodes && financialEpisodes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma métrica temporal aplicável nesta execução.
          </p>
        )}

        {financialEpisodes && financialEpisodes.length > 0 && (
          <ul className="flex flex-col gap-2">
            {financialEpisodes.map((episode) => (
              <li
                key={episode.episodeKey}
                className="flex flex-col gap-1 rounded-md border border-border px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {translateMetricKey(episode.metricKey)}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(TONE_BADGE_CLASSNAME[episodeStateTone(episode.state)])}
                  >
                    {translateEpisodeState(episode.state)}
                  </Badge>
                </div>

                {episode.state === "NOT_DETERMINABLE" && episode.determinabilityReason && (
                  <p className="text-xs text-muted-foreground">
                    {translateDeterminabilityReason(episode.determinabilityReason)}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>
                    {episode.observationCount}{" "}
                    {episode.observationCount === 1
                      ? "período observado"
                      : "períodos observados"}
                  </span>
                  {episode.firstObservedPeriod && episode.lastObservedPeriod && (
                    <span>
                      {formatPeriod(episode.firstObservedPeriod)} até{" "}
                      {formatPeriod(episode.lastObservedPeriod)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
