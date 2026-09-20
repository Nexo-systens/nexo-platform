import type { KnowledgeEvaluationResult } from "@/efos/application/knowledge-evaluation";

/**
 * Um `KnowledgeEvaluationResult` (D-077, Mission 145) já IDENTIFICADO
 * e TIMESTAMPADO — o tipo puro de Mission 145 nunca carrega `id` nem
 * `evaluatedAt` (a função que o produz nunca lê o relógio do sistema
 * nem gera identificadores). `deriveKnowledgeState()` (esta missão)
 * precisa dos dois: `id` para referenciar cada evento de avaliação
 * nos arrays de rastreabilidade do resultado (Etapa 8), `evaluatedAt`
 * para computar `latestEvaluationAt` e aplicar temporalidade (`asOf?`)
 * sobre o HISTÓRICO. Definido aqui (Application Layer, nunca em
 * `modules/`) para que a camada de persistência
 * (`modules/decisions/services/knowledge-evaluation-persistence.service.ts`)
 * o estenda, nunca o contrário — `efos/application/` nunca importa de
 * `modules/` (mesma regra de camadas de todo o EFOS).
 */
export interface TimestampedKnowledgeEvaluation extends KnowledgeEvaluationResult {
  readonly id: string;
  readonly evaluatedAt: string;
}

/**
 * Vocabulário fechado do estado de ciclo de vida derivado de um
 * `Knowledge` (Mission 146 — Knowledge Lifecycle & Historical
 * Intelligence Maturity, Etapa 3 da missão). Os 5 valores formam uma
 * partição COMPLETA e MUTUAMENTE EXCLUSIVA do espaço de estados
 * possível — cada `Knowledge` cai em exatamente 1, determinado
 * inteiramente por `evaluationCount`/`supportingCount`/
 * `contradictingCount` (nunca um score arbitrário):
 *
 * - `EMERGING` — `evaluationCount === 0`. Nunca avaliado ainda —
 *   diferente de "avaliado e sem sinal" (`INSUFFICIENT`): aqui o
 *   sistema simplesmente ainda não verificou o Knowledge contra a
 *   realidade.
 * - `INSUFFICIENT` — `evaluationCount > 0`, mas `supportingCount === 0
 *   && contradictingCount === 0` — o Knowledge já foi checado, mas
 *   nenhuma avaliação encontrou evidência de reforço ou contradição
 *   (todas as avaliações retornaram `INSUFFICIENT_EVIDENCE`,
 *   D-077) — distinto de `EMERGING` porque aqui HOUVE verificação.
 * - `SUPPORTED` — `supportingCount > 0 && contradictingCount === 0`.
 * - `WEAKENED` — `supportingCount === 0 && contradictingCount > 0` —
 *   nomeado deliberadamente diferente de "CONTRADICTED" (o outcome de
 *   uma avaliação individual, D-077) para nunca confundir "esta
 *   avaliação encontrou contradição" com "este é o estado agregado do
 *   Knowledge" — dois conceitos em camadas diferentes.
 * - `MIXED` — `supportingCount > 0 && contradictingCount > 0` — Etapa
 *   7 da missão: um único evento contraditório NUNCA promove
 *   automaticamente um Knowledge amplamente reforçado a "contradito"
 *   — o histórico completo (nunca só a última avaliação) decide.
 *
 * Proibido, nunca presente: `PROVEN`, `CAUSAL`, `GUARANTEED`,
 * `CERTAIN`.
 */
export const KNOWLEDGE_STATES = ["EMERGING", "INSUFFICIENT", "SUPPORTED", "WEAKENED", "MIXED"] as const;
export type KnowledgeState = (typeof KNOWLEDGE_STATES)[number];

/**
 * Resultado explicável de `deriveKnowledgeState()` (Etapa 8 da
 * missão). `supportingEvaluationIds`/`contradictingEvaluationIds`/
 * `insufficientEvaluationIds` são contados por EVENTO DE AVALIAÇÃO
 * (não por `LearningRecord` bruto — a mesma evidência poderia
 * aparecer em múltiplas avaliações ao longo do tempo, contar por
 * `LearningRecord` inflaria o histórico artificialmente); uma
 * avaliação `MIXED` conta em AMBOS os arrays (genuinamente carrega os
 * dois sinais). `rationale` é sempre um template determinístico —
 * nunca texto gerado por IA (Etapa 8: "não escrever justificativas
 * geradas por IA").
 */
export interface KnowledgeStateResult {
  readonly knowledgeId: string;
  readonly state: KnowledgeState;
  readonly evaluationCount: number;
  readonly supportingCount: number;
  readonly contradictingCount: number;
  readonly insufficientCount: number;
  readonly latestEvaluationAt?: string;
  readonly supportingEvaluationIds: readonly string[];
  readonly contradictingEvaluationIds: readonly string[];
  readonly insufficientEvaluationIds: readonly string[];
  readonly rationale: string;
}
