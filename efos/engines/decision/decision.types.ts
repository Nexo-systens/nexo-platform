import type {
  DecisionAggregate,
  DecisionType,
  ContextAggregate,
  EvidenceAggregate,
  ReasoningAggregate,
  RecommendationAggregate,
  RecommendationConfidence,
  RecommendationPriority,
} from "@/efos/domain";

/**
 * Entrada do Decision Engine: os quatro agregados ja calculados pelos
 * Engines anteriores do pipeline, da mesma empresa e do mesmo
 * Financial Model. Este Engine nunca chama `execute()` de nenhum
 * deles — recebe os quatro agregados prontos (D-002).
 */
export interface DecisionEngineInput {
  readonly companyId: string;
  readonly evidence: EvidenceAggregate;
  readonly context: ContextAggregate;
  readonly reasoning: ReasoningAggregate;
  readonly recommendation: RecommendationAggregate;
}

export type DecisionEngineOutput = DecisionAggregate;

/**
 * Resultado intermediario de uma regra de priorizacao — tudo que uma
 * Decision precisa ter, exceto os campos que so o mapper pode
 * preencher (`id`, `companyId`, `provenance`, `audit`). `key` e um
 * identificador estavel da regra que gerou o rascunho, usado para
 * compor o id deterministico da Decision (decision.mapper.ts).
 * `recommendationIds`/`reasoningIds`/`contextIds`/`evidenceIds` viram
 * os campos `recommendations`/`reasonings`/`contexts`/`evidences` da
 * Decision de dominio — referencia por ID, nunca por composicao
 * direta de objeto.
 */
export interface DecisionDraft {
  readonly key: string;
  readonly type: DecisionType;
  readonly priority: RecommendationPriority;
  readonly confidence: RecommendationConfidence;
  readonly title: string;
  readonly description: string;
  readonly rationale: string;
  readonly recommendationIds: readonly string[];
  readonly reasoningIds: readonly string[];
  readonly contextIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly supportingData: Readonly<Record<string, unknown>>;
}
