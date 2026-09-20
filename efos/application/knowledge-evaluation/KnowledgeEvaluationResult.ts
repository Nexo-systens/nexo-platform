import type { LearningRecord } from "@/efos/domain";

/**
 * Vocabulário fechado do resultado de `evaluateKnowledgeAgainstLearning()`
 * (Mission 145 — Knowledge-Driven Continuous Improvement, Etapa 4 da
 * missão). Sempre EVIDENCIAL, nunca causal — nenhum destes valores
 * afirma que uma `Decision` causou um resultado, apenas classifica
 * como novas evidências se relacionam com um `Knowledge` já formado.
 * Proibido explicitamente pela missão, e nunca presente neste
 * vocabulário: `PROVEN`, `CAUSED`, `CAUSED_BY`, `GUARANTEED`,
 * `CERTAIN`, `CONFIRMED_CAUSALITY`.
 *
 * - `REINFORCED` — pelo menos 1 `LearningRecord` novo, estruturalmente
 *   compatível com o padrão do `Knowledge` (mesma `evidenceClassification`
 *   do grupo de origem), e nenhum contraditório.
 * - `CONTRADICTED` — pelo menos 1 `LearningRecord` novo com
 *   classificação diretamente oposta (`EVIDENCE_FAVORABLE` ↔
 *   `EVIDENCE_CONTRARY`), e nenhum de reforço.
 * - `MIXED` — existem `LearningRecord`s novos de reforço E de
 *   contradição simultaneamente. Incluído nesta missão porque é um
 *   estado real e honesto (evidência genuinamente dividida), auditado
 *   como necessário — a alternativa (forçar `REINFORCED` ou
 *   `CONTRADICTED` por maioria) fabricaria uma certeza que os dados
 *   não sustentam.
 * - `INSUFFICIENT_EVIDENCE` — nenhum `LearningRecord` novo elegível
 *   existe (ou nenhum é estruturalmente comparável ao padrão de
 *   origem) — nunca inventar neutralidade além deste código honesto.
 */
export const KNOWLEDGE_EVALUATION_OUTCOMES = [
  "REINFORCED",
  "CONTRADICTED",
  "MIXED",
  "INSUFFICIENT_EVIDENCE",
] as const;
export type KnowledgeEvaluationOutcome = (typeof KNOWLEDGE_EVALUATION_OUTCOMES)[number];

/**
 * Vocabulário fechado de motivos de REJEIÇÃO — mesma disciplina de
 * `KnowledgeAccumulationRejection` (D-076).
 *
 * - `COMPANY_MISMATCH` — um `LearningRecord` de entrada pertence a
 *   empresa diferente do `Knowledge` avaliado (Etapa 6.1).
 * - `INVALID_KNOWLEDGE` — o próprio `Knowledge` avaliado não passa em
 *   `validateKnowledge()` (D-073) — nunca avaliado como se fosse
 *   válido.
 * - `INVALID_LEARNING_RECORD` — um `LearningRecord` de entrada não
 *   passa em `validateLearningRecord()` (D-072) — nunca usado como
 *   evidência.
 */
export const KNOWLEDGE_EVALUATION_REJECTION_CODES = [
  "COMPANY_MISMATCH",
  "INVALID_KNOWLEDGE",
  "INVALID_LEARNING_RECORD",
] as const;
export type KnowledgeEvaluationRejectionCode = (typeof KNOWLEDGE_EVALUATION_REJECTION_CODES)[number];

export interface KnowledgeEvaluationRejection {
  readonly code: KnowledgeEvaluationRejectionCode;
  readonly learningRecordId?: string;
  readonly message: string;
}

/**
 * Resultado explicável de `evaluateKnowledgeAgainstLearning()` — nunca
 * apenas um `boolean` (Etapa 5 da missão). `supporting`/`contradicting`/
 * `insufficient` são sempre `LearningRecord`s reais (nunca uma
 * referência fabricada) — cada um já carrega `id`/`outcomeIds`/
 * `financialObservationIds` (D-072), garantindo rastreabilidade
 * completa até `Outcome`/`FinancialOutcomeObservation` sem precisar de
 * um tipo intermediário novo (Etapa 6.3).
 *
 * `insufficient` contém os `LearningRecord`s novos que FORAM
 * considerados mas não são estruturalmente comparáveis ao padrão de
 * origem do `Knowledge` (eixo diferente, ex.: `TEMPORAL_ASSOCIATION`
 * contra um `Knowledge` de `historical_pattern`) — nunca descartados
 * silenciosamente, sempre presentes para auditoria.
 */
export interface KnowledgeEvaluationResult {
  readonly outcome: KnowledgeEvaluationOutcome;
  readonly knowledgeId: string;
  readonly supporting: readonly LearningRecord[];
  readonly contradicting: readonly LearningRecord[];
  readonly insufficient: readonly LearningRecord[];
  readonly rejected: readonly KnowledgeEvaluationRejection[];
}
