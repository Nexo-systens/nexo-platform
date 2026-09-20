import type {
  ContextAggregate,
  ContextType,
  EvidenceAggregate,
  EvidenceConfidence,
  FinancialKnowledgeGraphAggregate,
  FinancialModelAggregate,
  IndicatorsAggregate,
} from "@/efos/domain";
import type { ContextSeverity } from "@/efos/domain";

/**
 * Entrada do Context Engine: os quatro agregados ja calculados pelos
 * Engines anteriores do pipeline, da mesma empresa e do mesmo
 * Financial Model. Este Engine nunca chama `execute()` de nenhum
 * deles — recebe os quatro agregados prontos (D-002).
 */
export interface ContextEngineInput {
  readonly companyId: string;
  readonly financialModel: FinancialModelAggregate;
  readonly indicators: IndicatorsAggregate;
  readonly financialKnowledgeGraph: FinancialKnowledgeGraphAggregate;
  readonly evidence: EvidenceAggregate;
}

export type ContextEngineOutput = ContextAggregate;

/**
 * Resultado intermediario de uma regra de agrupamento — tudo que um
 * Context precisa ter, exceto os campos que so o mapper pode
 * preencher (`id`, `companyId`, `provenance`, `audit`). `key` e um
 * identificador estavel da regra que gerou o rascunho, usado para
 * compor o id deterministico do Context (context.mapper.ts).
 * `evidenceIds` vira o campo `evidences` do Context de dominio —
 * referencia por ID, nunca por composicao direta de objeto.
 */
export interface ContextDraft {
  readonly key: string;
  readonly type: ContextType;
  readonly severity: ContextSeverity;
  readonly confidence: EvidenceConfidence;
  readonly title: string;
  readonly description: string;
  readonly evidenceIds: readonly string[];
  readonly supportingData: Readonly<Record<string, unknown>>;
}
