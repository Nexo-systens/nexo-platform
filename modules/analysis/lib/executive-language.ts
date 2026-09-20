import { TEMPORAL_METRIC_DEFINITIONS } from "@/efos/engines/evidence";
import type {
  FinancialEpisodeDeterminabilityReason,
  FinancialEpisodeState,
} from "@/efos/application/financial-episodes";
import type { Period } from "@/efos/domain";

/**
 * Mission 177 — Executive Intelligence Experience. Única camada de
 * tradução entre o vocabulário canônico do EFOS (`FinancialEpisodeState`,
 * `FinancialEpisodeDeterminabilityReason`, `metricKey`, `Period`) e a
 * linguagem executiva apresentada na UI. Puramente apresentacional:
 * nenhuma função aqui reclassifica, recalcula ou reordena um estado —
 * apenas mapeia um valor canônico já produzido pelo EFOS para uma
 * string em português. Nunca altera os estados canônicos em si
 * (`FINANCIAL_EPISODE_STATES`/`FINANCIAL_EPISODE_DETERMINABILITY_REASONS`
 * continuam a única fonte de verdade).
 */

const EPISODE_STATE_LABEL: Record<FinancialEpisodeState, string> = {
  NEW_DETERIORATION: "Nova deterioração identificada",
  CONTINUING_DETERIORATION: "Deterioração financeira persistente",
  SUSTAINED_IMPROVEMENT: "Melhora consistente",
  NOT_DETERMINABLE: "Tendência ainda inconclusiva",
};

export function translateEpisodeState(state: FinancialEpisodeState): string {
  return EPISODE_STATE_LABEL[state];
}

/**
 * Tom visual associado a cada estado — usado apenas para escolher a
 * variante de cor já existente no design system (`success`/`warning`/
 * `destructive`/neutro), nunca para decidir o próprio estado.
 */
export type EpisodeStateTone = "positive" | "negative" | "neutral";

const EPISODE_STATE_TONE: Record<FinancialEpisodeState, EpisodeStateTone> = {
  NEW_DETERIORATION: "negative",
  CONTINUING_DETERIORATION: "negative",
  SUSTAINED_IMPROVEMENT: "positive",
  NOT_DETERMINABLE: "neutral",
};

export function episodeStateTone(state: FinancialEpisodeState): EpisodeStateTone {
  return EPISODE_STATE_TONE[state];
}

const DETERMINABILITY_REASON_LABEL: Record<
  FinancialEpisodeDeterminabilityReason,
  string
> = {
  INSUFFICIENT_HISTORY: "Histórico insuficiente para estabelecer uma tendência",
  SAME_PERIOD_CONFLICT:
    "Observações financeiras conflitantes para o mesmo período",
  INCOMPATIBLE_FINANCIAL_MODEL: "Histórico não pertence ao mesmo modelo financeiro",
  UNAVAILABLE_METRIC: "Métrica não pôde ser calculada nos períodos observados",
  NON_COMPARABLE_PERIOD: "Períodos observados não são comparáveis entre si",
  MISSING_EXECUTION: "Continuidade histórica incompleta",
  NO_EPISODE_SIGNAL: "Nenhuma trajetória defensável identificada até o momento",
};

export function translateDeterminabilityReason(
  reason: FinancialEpisodeDeterminabilityReason
): string {
  return DETERMINABILITY_REASON_LABEL[reason];
}

/**
 * Rótulo executivo de uma métrica temporal (D-087) — reaproveita
 * integralmente `TEMPORAL_METRIC_DEFINITIONS.label` (já em português,
 * já usado pelas regras de Evidence temporal desde a Mission 166).
 * Nunca cria um segundo dicionário de KPIs: quando a `metricKey` não é
 * reconhecida, devolve a própria chave (nunca inventa um rótulo).
 */
export function translateMetricKey(metricKey: string): string {
  return (
    TEMPORAL_METRIC_DEFINITIONS.find((definition) => definition.metricKey === metricKey)
      ?.label ?? metricKey
  );
}

/** Formata um `Period` (D-045) para exibição — mesma convenção pt-BR já usada por `formatExecutedAt()`. */
export function formatPeriod(period: Period): string {
  const format = (isoDate: string) =>
    new Date(isoDate).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  return `${format(period.startDate)} – ${format(period.endDate)}`;
}
