import type {
  ContextAggregate,
  EvidenceAggregate,
  FinancialKnowledgeGraphAggregate,
  FinancialModelAggregate,
  IndicatorsAggregate,
  ReasoningAggregate,
  RecommendationAggregate,
  RecommendationConfidence,
  RecommendationPriority,
  RecommendationType,
} from "@/efos/domain";

/**
 * Entrada do Recommendation Engine: os seis agregados ja calculados
 * pelos Engines anteriores do pipeline, da mesma empresa e do mesmo
 * Financial Model. Este Engine nunca chama `execute()` de nenhum
 * deles — recebe os seis agregados prontos (D-002).
 */
export interface RecommendationEngineInput {
  readonly companyId: string;
  readonly financialModel: FinancialModelAggregate;
  readonly indicators: IndicatorsAggregate;
  readonly financialKnowledgeGraph: FinancialKnowledgeGraphAggregate;
  readonly evidence: EvidenceAggregate;
  readonly context: ContextAggregate;
  readonly reasoning: ReasoningAggregate;
}

export type RecommendationEngineOutput = RecommendationAggregate;

/**
 * Resultado intermediario de uma regra de recomendacao — tudo que uma
 * Recommendation precisa ter, exceto os campos que so o mapper pode
 * preencher (`id`, `companyId`, `provenance`, `audit`). `key` e um
 * identificador estavel da regra que gerou o rascunho, usado para
 * compor o id deterministico da Recommendation
 * (recommendation.mapper.ts). `reasoningIds`/`contextIds`/
 * `evidenceIds` viram os campos `reasonings`/`contexts`/`evidences` da
 * Recommendation de dominio — referencia por ID, nunca por composicao
 * direta de objeto.
 */
export interface RecommendationDraft {
  readonly key: string;
  readonly type: RecommendationType;
  readonly priority: RecommendationPriority;
  readonly confidence: RecommendationConfidence;
  readonly title: string;
  readonly description: string;
  readonly expectedImpact: string;
  readonly reasoningIds: readonly string[];
  readonly contextIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly supportingData: Readonly<Record<string, unknown>>;
}
