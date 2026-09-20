import type { Period } from "@/efos/domain";

/**
 * Mission 171 — Implement Derived Financial Episode State.
 *
 * União fechada de estados EXECUTÁVEIS — apenas os 4 que
 * `deriveFinancialEpisodeState()` consegue hoje comprovar
 * deterministicamente, conforme a Option B aprovada pela Mission 170B
 * e reconfirmada pela Mission 170C. `PARTIAL_RECOVERY`/`FULL_RECOVERY`/
 * `RECURRENCE` permanecem vocabulário de domínio FUTURO — nunca
 * incluídos neste tipo, para nunca expor uma capacidade que o EFOS
 * ainda não pode provar (Mission 170C, Etapa 8: "superfície semântica
 * morta nunca é expressividade"). Adicioná-los aqui exigiria primeiro
 * uma referência de recuperação defensável (D-088), que não existe.
 */
export const FINANCIAL_EPISODE_STATES = [
  "NEW_DETERIORATION",
  "CONTINUING_DETERIORATION",
  "SUSTAINED_IMPROVEMENT",
  "NOT_DETERMINABLE",
] as const;
export type FinancialEpisodeState = (typeof FINANCIAL_EPISODE_STATES)[number];

/**
 * Vocabulário fechado de motivos de indeterminação (Mission 170C,
 * Etapa 9, com uma adição justificada por esta missão).
 *
 * As 6 primeiras entradas são as propostas pela Mission 170C. `NO_EPISODE_SIGNAL`
 * é adicionada por esta missão (Mission 171) — condição genuinamente
 * distinta, não coberta pelas 6 originais: a observação canônica mais
 * recente é `NONE_DETECTED` (nenhuma Evidence de declínio nem de
 * melhora, mas um período financeiro real e comparável) e não existe
 * nenhum episódio adverso aberto anteriormente — não é um problema de
 * dado insuficiente/conflitante/incompatível, é a ausência genuína de
 * qualquer sinal de episódio a reportar. Nunca reutilizar
 * `INSUFFICIENT_HISTORY` para este caso — o histórico pode ser
 * perfeitamente suficiente, apenas não há nada para classificar.
 */
export const FINANCIAL_EPISODE_DETERMINABILITY_REASONS = [
  "INSUFFICIENT_HISTORY",
  "SAME_PERIOD_CONFLICT",
  "INCOMPATIBLE_FINANCIAL_MODEL",
  "UNAVAILABLE_METRIC",
  "NON_COMPARABLE_PERIOD",
  "MISSING_EXECUTION",
  "NO_EPISODE_SIGNAL",
] as const;
export type FinancialEpisodeDeterminabilityReason =
  (typeof FINANCIAL_EPISODE_DETERMINABILITY_REASONS)[number];

/**
 * Resultado explicável de `deriveFinancialEpisodeState()` — mesmo
 * espírito de `KnowledgeStateResult` (Mission 146, D-078): imutável,
 * nunca persistido, nunca duplica Evidence/FinancialModel, sempre
 * recomputado sob demanda a partir de `HistoricalExecution[]`.
 *
 * Diferenças deliberadas em relação à proposta original da Mission
 * 170 (corrigidas pelas Missions 170B/170C/171): sem
 * `originatingEvidenceId` (nunca populável deterministicamente sob o
 * escopo executável dos 4 estados — esse campo só faria sentido para
 * `PARTIAL_RECOVERY`/`FULL_RECOVERY`/`RECURRENCE`, fora do tipo);
 * `firstObservedPeriod`/`lastObservedPeriod` são `Period` financeiro
 * (Mission 170B/D-088: cronologia de episódio é sempre financeira,
 * nunca de execução) — nunca `executedAt`.
 */
export interface FinancialEpisodeStateResult {
  readonly companyId: string;
  readonly financialModelId: string;
  readonly metricKey: string;
  readonly episodeKey: string;
  readonly state: FinancialEpisodeState;
  readonly currentEvidenceId?: string;
  readonly firstObservedPeriod?: Period;
  readonly lastObservedPeriod?: Period;
  readonly observationCount: number;
  readonly determinabilityReason?: FinancialEpisodeDeterminabilityReason;
}
