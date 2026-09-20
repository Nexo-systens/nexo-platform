/**
 * Vocabulário de `Knowledge` (Mission 141 — Knowledge Formation &
 * Cross-Decision Learning). Conjunto fechado — mesma disciplina
 * estrutural de `FinancialCorrelationClassification` (D-071) e
 * `LearningEvidenceClassification` (D-072): nenhum valor causal existe
 * no TIPO, uma garantia estrutural, nunca uma convenção que um código
 * futuro poderia contornar. Valores como `"proven_causation"`,
 * `"guaranteed_result"`, `"caused_by_decision"` são proibidos por
 * instrução explícita da missão e nunca são adicionados a este
 * vocabulário.
 *
 * Distinção com critério real, não arbitrária (derivada da presença ou
 * ausência de julgamento humano no grupo de `LearningRecord`s de
 * origem — `LearningEvidenceClassification`, D-072):
 *
 * - `"recurring_observation"` — todo `LearningRecord` do grupo de
 *   origem tem `evidenceClassification === "TEMPORAL_ASSOCIATION"`:
 *   recorrência de movimento financeiro observado, SEM nenhum
 *   `Outcome` humano associado ainda em nenhum dos casos.
 * - `"historical_pattern"` — o grupo de origem tem
 *   `evidenceClassification` refletindo julgamento humano
 *   (`EVIDENCE_FAVORABLE`/`EVIDENCE_CONTRARY`/`INCONCLUSIVE`):
 *   recorrência de um padrão de resultado já avaliado por humanos em
 *   `Decision`s independentes.
 * - `"accumulated_learning"` — reservado, não produzido por esta
 *   missão (mesma convenção de `LEARNING_TYPES`/`LEARNING_SOURCES`,
 *   D-013: valores reservados no vocabulário mesmo sem uso hoje,
 *   destinado a uma futura consolidação de múltiplos
 *   `historical_pattern`/`recurring_observation` já existentes — não
 *   decidido nem implementado agora).
 */
export const KNOWLEDGE_CATEGORIES = [
  "historical_pattern",
  "recurring_observation",
  "accumulated_learning",
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];
