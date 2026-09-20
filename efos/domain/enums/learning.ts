/**
 * Vocabulario do Aprendizado (Mission 015 — Learning Engine). Conjuntos
 * fechados — qualquer LearningRecord fora deste vocabulario nao e um
 * LearningRecord valido. Enums proprios deste Engine, por instrucao
 * explicita da missao (docs/DECISIONS.md D-013).
 */

/**
 * Natureza do conhecimento consolidado. Nesta fase, so `recurring_risk`
 * e `methodology_note` sao produzidos — os demais estao reservados
 * para regras futuras (ver efos/engines/learning/README.md,
 * "Limitacoes").
 */
export const LEARNING_TYPES = [
  "pattern",
  "observation",
  "recurring_risk",
  "methodology_note",
  "executive_insight",
] as const;
export type LearningType = (typeof LEARNING_TYPES)[number];

/**
 * Confianca no conhecimento registrado. Enum proprio do Learning
 * Engine — nao reaproveita `RecommendationConfidence` nem
 * `ReasoningConfidence` nem `EvidenceConfidence`, por instrucao
 * explicita da missao ("enums proprios").
 */
export const LEARNING_CONFIDENCE_LEVELS = [
  "low",
  "medium",
  "high",
  "verified",
] as const;
export type LearningConfidence = (typeof LEARNING_CONFIDENCE_LEVELS)[number];

/**
 * Origem do conhecimento registrado. Nesta fase, so `execution` e
 * produzido — este Engine so tem acesso aos agregados de uma unica
 * execucao do pipeline, nunca a uma regra explicita, feedback humano
 * ou serie historica entre execucoes (ver
 * efos/engines/learning/README.md, "Limitacoes"). Os demais valores
 * permanecem reservados no vocabulario, mesmo sem uso hoje —
 * instrucao explicita da missao.
 */
export const LEARNING_SOURCES = [
  "rule",
  "execution",
  "user_feedback",
  "historical_pattern",
] as const;
export type LearningSource = (typeof LEARNING_SOURCES)[number];

/**
 * Classificação de evidência de um `LearningRecord` derivado de uma
 * `Decision` real e seu resultado observado (Mission 140 — EFOS
 * Continuous Financial Intelligence & Learning Loop). Ativa o vínculo
 * que D-013 deixou explicitamente pendente ("a promoção de
 * `LearningRecord` para `Knowledge`... exigirá uma decisão
 * arquitetural explícita, não uma reinterpretação silenciosa") —
 * mesmo espírito de D-011 sobre `Outcome.decisionId`.
 *
 * **Princípio absoluto preservado (Correlation ≠ Causation)**: nenhum
 * valor aqui afirma que uma `Decision` causou um resultado — apenas
 * classifica a EVIDÊNCIA disponível. Derivado exclusivamente do
 * julgamento humano já existente (`Outcome.status`, D-011) — nunca
 * uma interpretação nova inventada sobre se um indicador financeiro
 * "subiu" ou "desceu" é bom ou ruim (esse julgamento semântico não
 * existe em lugar nenhum do domínio hoje, e inventá-lo agora seria
 * exatamente o tipo de causalidade não comprovada que esta missão
 * proíbe explicitamente).
 *
 * - `TEMPORAL_ASSOCIATION` — existe uma `FinancialOutcomeObservation`
 *   (D-071) real, mas nenhum `Outcome` humano ainda: há movimento
 *   financeiro mensurável, mas nenhum julgamento humano para
 *   correlacionar.
 * - `EVIDENCE_FAVORABLE` — `Outcome.status === "positive"` (o humano
 *   já concluiu, com suas próprias palavras, que o resultado foi bom).
 * - `EVIDENCE_CONTRARY` — `Outcome.status === "negative"`.
 * - `INCONCLUSIVE` — `Outcome.status` é `"neutral"`, `"inconclusive"`
 *   ou `"pending"` — o próprio humano já registrou que não há
 *   conclusão clara ainda.
 *
 * `INSUFFICIENT_EVIDENCE` (nem `Outcome` nem `FinancialOutcomeObservation`
 * existem) é deliberadamente EXCLUÍDO deste vocabulário — nunca um
 * `LearningRecord` real é persistido nesse caso, mesma convenção já
 * usada por `DecisionExecutionStatus.NOT_STARTED`/`DiagnosisReviewStatus.PENDING`:
 * a ausência de evidência é representada pela AUSÊNCIA de qualquer
 * `LearningRecord`, nunca por um registro com esse status.
 */
export const LEARNING_EVIDENCE_CLASSIFICATIONS = [
  "TEMPORAL_ASSOCIATION",
  "EVIDENCE_FAVORABLE",
  "EVIDENCE_CONTRARY",
  "INCONCLUSIVE",
] as const;
export type LearningEvidenceClassification = (typeof LEARNING_EVIDENCE_CLASSIFICATIONS)[number];
