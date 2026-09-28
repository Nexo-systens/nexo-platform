import { SemanticBadge } from "@/components/shared/SemanticBadge";
import type { FinancialEpisodeStateResult } from "@/efos/application/financial-episodes";
import { formatPeriodLabel } from "@/modules/analysis/lib/period-label";
import {
  episodeStateTone,
  translateDeterminabilityReason,
  translateEpisodeState,
  translateMetricKey,
} from "@/modules/analysis/lib/executive-language";

const TONE: Record<ReturnType<typeof episodeStateTone>, "positive" | "negative" | "neutral"> = {
  positive: "positive",
  negative: "negative",
  neutral: "neutral",
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
 * de UI para `financialEpisodes` (D-087/Mission 171/172). Responde "O que
 * está mudando?": apresenta, exatamente na ordem em que
 * `financialEpisodes` já chega (nunca reordenado/filtrado aqui), cada
 * métrica temporal com seu estado, número de observações e período.
 *
 * `NOT_DETERMINABLE` é sempre mostrado, nunca ocultado — com o motivo
 * traduzido — mas nunca estilizado como erro.
 *
 * Mission 204 — lista compacta (uma linha por métrica, divisores em vez
 * de caixas) e período curto ("mai/2026 – ago/2026"). Puramente
 * apresentacional: nenhum estado é recalculado aqui.
 */
export function ExecutiveTrajectoryPanel({ financialEpisodes }: ExecutiveTrajectoryPanelProps) {
  return (
    <section aria-labelledby="trajetoria-titulo" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="type-eyebrow">O que está mudando</p>
        <h3 id="trajetoria-titulo" className="type-section-title">
          Trajetória financeira
        </h3>
      </div>

      {!financialEpisodes && (
        <p className="type-body">
          A trajetória financeira exige indicadores, evidências, contexto, raciocínio e recomendação completos nesta
          execução — uma ou mais etapas não foi alcançada, então nenhuma tendência é apresentada aqui.
        </p>
      )}

      {financialEpisodes && financialEpisodes.length === 0 && (
        <p className="type-body">Nenhuma métrica temporal aplicável nesta execução.</p>
      )}

      {financialEpisodes && financialEpisodes.length > 0 && (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {financialEpisodes.map((episode) => {
            const range =
              episode.firstObservedPeriod && episode.lastObservedPeriod
                ? `${formatPeriodLabel(episode.firstObservedPeriod).short} – ${formatPeriodLabel(episode.lastObservedPeriod).short}`
                : undefined;
            return (
              <li
                key={episode.episodeKey}
                className="grid grid-cols-1 gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="text-sm font-medium text-foreground">{translateMetricKey(episode.metricKey)}</span>
                <span className="type-meta num">
                  {/* O intervalo é o do episódio; a contagem é de todos os períodos examinados — rótulos distintos para não parecerem a mesma coisa. */}
                  {range ? `Observado em ${range} · ` : ""}
                  {episode.observationCount} {episode.observationCount === 1 ? "período analisado" : "períodos analisados"}
                  {episode.state === "NOT_DETERMINABLE" && episode.determinabilityReason
                    ? ` · ${translateDeterminabilityReason(episode.determinabilityReason)}`
                    : ""}
                </span>
                <SemanticBadge tone={TONE[episodeStateTone(episode.state)]} className="justify-self-start sm:justify-self-end">
                  {translateEpisodeState(episode.state)}
                </SemanticBadge>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
