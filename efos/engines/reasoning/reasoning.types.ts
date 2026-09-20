import type {
  ContextAggregate,
  EvidenceAggregate,
  FinancialKnowledgeGraphAggregate,
  FinancialModelAggregate,
  IndicatorsAggregate,
  ReasoningAggregate,
  ReasoningConfidence,
  ReasoningType,
} from "@/efos/domain";

/**
 * Entrada do Reasoning Engine: os cinco agregados ja calculados pelos
 * Engines anteriores do pipeline, da mesma empresa e do mesmo
 * Financial Model. Este Engine nunca chama `execute()` de nenhum
 * deles — recebe os cinco agregados prontos (D-002).
 */
export interface ReasoningEngineInput {
  readonly companyId: string;
  readonly financialModel: FinancialModelAggregate;
  readonly indicators: IndicatorsAggregate;
  readonly financialKnowledgeGraph: FinancialKnowledgeGraphAggregate;
  readonly evidence: EvidenceAggregate;
  readonly context: ContextAggregate;
}

export type ReasoningEngineOutput = ReasoningAggregate;

/**
 * Resultado intermediario de uma regra de inferencia — tudo que um
 * Reasoning precisa ter, exceto os campos que so o mapper pode
 * preencher (`id`, `companyId`, `provenance`, `audit`). `key` e um
 * identificador estavel da regra que gerou o rascunho, usado para
 * compor o id deterministico do Reasoning (reasoning.mapper.ts).
 * `contextIds`/`evidenceIds` viram os campos `contexts`/`evidences`
 * do Reasoning de dominio — referencia por ID, nunca por composicao
 * direta de objeto.
 */
export interface ReasoningDraft {
  readonly key: string;
  readonly type: ReasoningType;
  readonly confidence: ReasoningConfidence;
  readonly title: string;
  readonly description: string;
  readonly contextIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly supportingData: Readonly<Record<string, unknown>>;
}
