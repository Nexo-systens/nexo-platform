import { TEMPORAL_METRIC_DEFINITIONS } from "@/efos/engines/evidence";

import {
  FINANCIAL_EPISODE_DETERMINABILITY_REASONS,
  FINANCIAL_EPISODE_STATES,
  type FinancialEpisodeStateResult,
} from "./FinancialEpisodeState";

export interface FinancialEpisodeValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const SUPPORTED_METRIC_KEYS = new Set(TEMPORAL_METRIC_DEFINITIONS.map((d) => d.metricKey));
const VALID_STATES = new Set<string>(FINANCIAL_EPISODE_STATES);
const VALID_REASONS = new Set<string>(FINANCIAL_EPISODE_DETERMINABILITY_REASONS);

/**
 * Mission 172, Requisito 12 — validação das invariantes de um array
 * de `FinancialEpisodeStateResult` antes de compor um
 * `ExecutiveFinancialContext`. Toda invariante checada aqui já é
 * garantida POR CONSTRUÇÃO pelo único caminho de produção existente
 * (`buildFinancialEpisodeIntelligence()`, que itera
 * `TEMPORAL_METRIC_DEFINITIONS` exatamente uma vez, sempre com o
 * mesmo `companyId`/`financialModelId`, sempre delegando a
 * `deriveFinancialEpisodeState()` — que por sua vez já garante
 * vocabulário fechado de estado/motivo e presença condicional de
 * `determinabilityReason`) — esta função existe como a mesma
 * disciplina defensiva já usada por `evidence.validator.ts` para
 * `priorPeriods` (Mission 166): nunca reimplementa a regra de
 * derivação, apenas confirma que um array de episódios, VINDO DE
 * QUALQUER FONTE (incluindo uma futura composição alternativa,
 * fixture de teste, ou dado desserializado), respeita o contrato.
 * Nunca reimplementa nenhuma regra de `deriveFinancialEpisodeState()`
 * — apenas confirma o formato do resultado já produzido.
 */
export function validateFinancialEpisodes(
  companyId: string,
  financialModelId: string,
  episodes: readonly FinancialEpisodeStateResult[]
): FinancialEpisodeValidationResult {
  const errors: string[] = [];
  const seenMetricKeys = new Set<string>();

  for (const episode of episodes) {
    const label = `financialEpisodes[metricKey="${episode.metricKey}"]`;

    if (!SUPPORTED_METRIC_KEYS.has(episode.metricKey)) {
      errors.push(`${label}: metricKey não é uma das métricas suportadas por D-087 (TEMPORAL_METRIC_DEFINITIONS).`);
    }

    if (episode.companyId !== companyId) {
      errors.push(`${label}: companyId ("${episode.companyId}") diverge do companyId do contexto ("${companyId}") — nunca misturar episódios de empresas diferentes.`);
    }

    if (episode.financialModelId !== financialModelId) {
      errors.push(`${label}: financialModelId ("${episode.financialModelId}") diverge do financialModelId do contexto ("${financialModelId}").`);
    }

    if (episode.episodeKey !== episode.metricKey) {
      errors.push(`${label}: episodeKey ("${episode.episodeKey}") deve ser sempre igual a metricKey (Mission 170, Etapa 3 — identidade metric-specific).`);
    }

    if (!VALID_STATES.has(episode.state)) {
      errors.push(`${label}: state ("${episode.state}") não pertence ao vocabulário fechado de 4 estados executáveis.`);
    }

    if (episode.state === "NOT_DETERMINABLE") {
      if (!episode.determinabilityReason) {
        errors.push(`${label}: state é NOT_DETERMINABLE mas determinabilityReason está ausente — todo NOT_DETERMINABLE deve explicar por quê.`);
      } else if (!VALID_REASONS.has(episode.determinabilityReason)) {
        errors.push(`${label}: determinabilityReason ("${episode.determinabilityReason}") não pertence ao vocabulário fechado de motivos.`);
      }
    } else if (episode.determinabilityReason) {
      errors.push(`${label}: state é "${episode.state}" (determinável) mas determinabilityReason está presente ("${episode.determinabilityReason}") — motivo de indeterminação nunca acompanha um estado determinável.`);
    }

    if (episode.firstObservedPeriod && episode.lastObservedPeriod) {
      const firstStart = new Date(episode.firstObservedPeriod.startDate).getTime();
      const lastStart = new Date(episode.lastObservedPeriod.startDate).getTime();
      if (firstStart > lastStart) {
        errors.push(`${label}: firstObservedPeriod (${episode.firstObservedPeriod.startDate}) é posterior a lastObservedPeriod (${episode.lastObservedPeriod.startDate}) — ordem de período inválida.`);
      }
    }

    if (seenMetricKeys.has(episode.metricKey)) {
      errors.push(`${label}: metricKey duplicada — cada métrica deve aparecer no máximo uma vez em financialEpisodes.`);
    }
    seenMetricKeys.add(episode.metricKey);
  }

  return { valid: errors.length === 0, errors };
}
