/**
 * Mission 151 — Recommendation Outcome Learning & Cross-Decision
 * Pattern Engine (D-083).
 *
 * **Vocabulário fechado, sempre não-causal (Regra Central da missão)**:
 * responde apenas "o que foi historicamente observado quando
 * Recommendations estruturalmente semelhantes foram escolhidas" —
 * nunca "esta Recommendation causou este resultado". Mesmo princípio
 * de `KnowledgeState` (D-078) — 5 valores, partição completa do espaço
 * `(decisionCount, favorableCount, unfavorableCount)`:
 *
 * - `EMERGING` — nenhuma `Decision` com este fingerprint observada
 *   ainda (`decisionCount === 0`).
 * - `INSUFFICIENT` — há `Decision`s observadas, mas nenhuma produziu
 *   evidência favorável nem contrária ainda (todo `LearningRecord`
 *   relevante é `INCONCLUSIVE`/`TEMPORAL_ASSOCIATION`, ou nenhuma
 *   `Decision` tem `LearningRecord` ainda).
 * - `FAVORABLE` — só evidência favorável (`favorableCount > 0 &&
 *   unfavorableCount === 0`).
 * - `UNFAVORABLE` — só evidência contrária (`favorableCount === 0 &&
 *   unfavorableCount > 0`) — nomeado deliberadamente diferente de
 *   `EVIDENCE_CONTRARY` (o outcome de um `LearningRecord` individual,
 *   D-072) para nunca confundir um único evento com o padrão agregado
 *   através de múltiplas Decisions.
 * - `MIXED` — evidência favorável E contrária coexistem (nunca um dos
 *   dois lados é descartado ou escolhido por maioria).
 *
 * Proibidos e nunca presentes: `CAUSED_BY_RECOMMENDATION`/
 * `PROVEN_EFFECTIVE`/`GUARANTEED_SUCCESS`/`RECOMMENDATION_WORKS`, ou
 * qualquer variante causal equivalente.
 */
export const RECOMMENDATION_OUTCOME_PATTERN_STATES = ["EMERGING", "INSUFFICIENT", "FAVORABLE", "UNFAVORABLE", "MIXED"] as const;
export type RecommendationOutcomePatternState = (typeof RECOMMENDATION_OUTCOME_PATTERN_STATES)[number];

/**
 * Um `LearningRecord` real (já classificado por `deriveEvidenceClassification()`,
 * D-072, Mission 140) associado a uma `Decision` que compartilha o
 * fingerprint sendo avaliado — o insumo atômico de evidência, mesmo
 * princípio de `TimestampedKnowledgeEvaluation` (D-078): nunca
 * recalculado aqui, apenas agregado. `evidenceClassification` ausente
 * (LearningRecord produzido pelo LearningEngine determinístico
 * pipeline-scoped, Mission 015, nunca vinculado a Decision/Outcome)
 * nunca contribui para a contagem — não é nem "insuficiente", é
 * simplesmente irrelevante para este mecanismo.
 */
export interface RecommendationOutcomeLearningRecordInput {
  readonly id: string;
  readonly evidenceClassification?: string;
  readonly createdAt: string;
}

/**
 * Uma `Decision` real já resolvida como pertencente a este fingerprint
 * (`resolveRecommendationStructuralShape()` já executado pelo
 * chamador) — junto de todos os `LearningRecord`s reais associados a
 * ela. Nunca contém a `ExecutiveDiagnosis`/`InterpretationBasis`
 * original (já consumida na resolução do fingerprint, antes deste
 * ponto) — evita duplicar dado já processado.
 */
export interface RecommendationOutcomeDecisionInput {
  readonly decisionId: string;
  readonly companyId: string;
  readonly decisionCreatedAt: string;
  readonly learningRecords: readonly RecommendationOutcomeLearningRecordInput[];
}

/**
 * Vocabulário fechado de rejeição (Etapa 8) — mesma disciplina de
 * `KNOWLEDGE_EVALUATION_REJECTION_CODES` (D-077)/`KNOWLEDGE_RELEVANCE_EXCLUSION_CODES`
 * (D-074): um código, não uma frase livre, é a fonte de verdade
 * testável. Apenas fronteira de empresa é reportada explicitamente —
 * exclusão temporal (`Decision`/`LearningRecord` posteriores a `asOf`)
 * é silenciosa, mesmo princípio já estabelecido desde D-077/D-078
 * ("elegível, só posterior ao ponto de avaliação" nunca é um erro).
 */
export const RECOMMENDATION_OUTCOME_REJECTION_CODES = ["COMPANY_MISMATCH"] as const;
export type RecommendationOutcomeRejectionCode = (typeof RECOMMENDATION_OUTCOME_REJECTION_CODES)[number];

export interface RecommendationOutcomeRejection {
  readonly code: RecommendationOutcomeRejectionCode;
  readonly decisionId: string;
  readonly message: string;
}

/**
 * Resultado explicável (Etapa 15) — toda contagem é rastreável até
 * ids reais (`supportingDecisionIds`/`contradictingDecisionIds`),
 * nunca um score opaco. `rationale` é sempre um template
 * determinístico — nunca texto gerado por IA, mesmo padrão de
 * `KnowledgeStateResult.rationale` (D-078).
 */
export interface RecommendationOutcomePatternResult {
  readonly fingerprint: string;
  readonly companyId: string;
  readonly state: RecommendationOutcomePatternState;
  readonly decisionCount: number;
  readonly learningRecordCount: number;
  readonly favorableCount: number;
  readonly unfavorableCount: number;
  readonly insufficientCount: number;
  readonly latestDecisionAt?: string;
  readonly supportingDecisionIds: readonly string[];
  readonly contradictingDecisionIds: readonly string[];
  readonly rejected: readonly RecommendationOutcomeRejection[];
  readonly rationale: string;
}
