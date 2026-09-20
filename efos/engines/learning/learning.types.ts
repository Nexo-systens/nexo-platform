import type {
  ContextAggregate,
  DecisionAggregate,
  EvidenceAggregate,
  LearningAggregate,
  LearningConfidence,
  LearningSource,
  LearningType,
  ReasoningAggregate,
  RecommendationAggregate,
} from "@/efos/domain";

/**
 * Entrada do Learning Engine: os cinco agregados ja calculados pelos
 * Engines anteriores do pipeline, da mesma empresa e do mesmo
 * Financial Model. Este Engine nunca chama `execute()` de nenhum
 * deles — recebe os cinco agregados prontos (D-002).
 */
export interface LearningEngineInput {
  readonly companyId: string;
  readonly evidence: EvidenceAggregate;
  readonly context: ContextAggregate;
  readonly reasoning: ReasoningAggregate;
  readonly recommendation: RecommendationAggregate;
  readonly decision: DecisionAggregate;
}

export type LearningEngineOutput = LearningAggregate;

/**
 * Resultado intermediario de uma regra de consolidacao — tudo que um
 * LearningRecord precisa ter, exceto os campos que so o mapper pode
 * preencher (`id`, `companyId`, `provenance`, `audit`). `key` e um
 * identificador estavel da regra/instancia que gerou o rascunho,
 * usado para compor o id deterministico do LearningRecord
 * (learning.mapper.ts). `decisionIds`/`recommendationIds`/
 * `reasoningIds`/`contextIds`/`evidenceIds` viram os campos
 * `decisions`/`recommendations`/`reasonings`/`contexts`/`evidences`
 * do LearningRecord de dominio — referencia por ID, nunca por
 * composicao direta de objeto.
 */
export interface LearningDraft {
  readonly key: string;
  readonly type: LearningType;
  readonly confidence: LearningConfidence;
  readonly title: string;
  readonly description: string;
  readonly source: LearningSource;
  readonly decisionIds: readonly string[];
  readonly recommendationIds: readonly string[];
  readonly reasoningIds: readonly string[];
  readonly contextIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly supportingData: Readonly<Record<string, unknown>>;
}
