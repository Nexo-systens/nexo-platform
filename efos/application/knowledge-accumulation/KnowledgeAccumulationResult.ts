import type { Knowledge } from "@/efos/domain";

/**
 * Vocabulário fechado do resultado de `accumulateKnowledge()` (Mission
 * 144 — Knowledge Accumulation & Historical Pattern Formation, Etapa 4
 * da missão). Distingue explicitamente os 4 estados possíveis — nunca
 * apenas `Knowledge[]` (proibido explicitamente pela missão):
 *
 * - `NO_ELIGIBLE_LEARNING` — nenhum `LearningRecord` elegível existe
 *   para esta empresa (lista vazia após o filtro de company boundary,
 *   Etapa 6) — nada para considerar.
 * - `NO_SUFFICIENT_RECURRING_LEARNING` — existem `LearningRecord`s
 *   elegíveis, mas nenhum grupo atinge o threshold de recorrência
 *   (`MINIMUM_DISTINCT_DECISIONS_FOR_KNOWLEDGE`, D-073) — mesmo código
 *   de `buildKnowledgeFromLearningRecords()` (Mission 141), nunca
 *   reinterpretado.
 * - `KNOWLEDGE_ALREADY_EXISTS` — todo `Knowledge` que a recorrência
 *   atual produziria já existe (`existing`, reconhecido pelo `id`
 *   determinístico, D-073) — nenhum novo registro é necessário.
 * - `KNOWLEDGE_CREATED` — pelo menos 1 `Knowledge` novo foi criado
 *   (`created`) nesta execução.
 */
export const KNOWLEDGE_ACCUMULATION_OUTCOMES = [
  "KNOWLEDGE_CREATED",
  "KNOWLEDGE_ALREADY_EXISTS",
  "NO_SUFFICIENT_RECURRING_LEARNING",
  "NO_ELIGIBLE_LEARNING",
] as const;
export type KnowledgeAccumulationOutcome = (typeof KNOWLEDGE_ACCUMULATION_OUTCOMES)[number];

/**
 * Vocabulário fechado de motivos de REJEIÇÃO — auditável, nunca texto
 * livre sem código (mesma disciplina de `KnowledgeRelevanceReason`,
 * D-074).
 *
 * - `COMPANY_MISMATCH` — um `LearningRecord` de entrada pertence a uma
 *   empresa diferente da `companyId` explicitamente informada (Etapa
 *   6 da missão — "separar corretamente OU rejeitar explicitamente,
 *   nunca agrupar silenciosamente").
 * - `INVALID_KNOWLEDGE_CANDIDATE` — `buildKnowledgeFromLearningRecords()`
 *   computou um candidato que `validateKnowledge()` (D-073) rejeitou —
 *   nunca persistido (Etapa 12.P da missão).
 */
export const KNOWLEDGE_ACCUMULATION_REJECTION_CODES = ["COMPANY_MISMATCH", "INVALID_KNOWLEDGE_CANDIDATE"] as const;
export type KnowledgeAccumulationRejectionCode = (typeof KNOWLEDGE_ACCUMULATION_REJECTION_CODES)[number];

export interface KnowledgeAccumulationRejection {
  readonly code: KnowledgeAccumulationRejectionCode;
  readonly learningRecordId?: string;
  readonly message: string;
}

/**
 * Resultado explicável de `accumulateKnowledge()` — `created`/`existing`
 * são sempre `Knowledge` reais (nunca uma referência fabricada);
 * `rejected` é sempre rastreável até um `learningRecordId` real quando
 * aplicável (`COMPANY_MISMATCH`) ou até a mensagem de validação real
 * (`INVALID_KNOWLEDGE_CANDIDATE`).
 */
export interface KnowledgeAccumulationResult {
  readonly outcome: KnowledgeAccumulationOutcome;
  readonly created: readonly Knowledge[];
  readonly existing: readonly Knowledge[];
  readonly rejected: readonly KnowledgeAccumulationRejection[];
}
