import type {
  EvidenceAggregate,
  EvidenceCategory,
  EvidenceConfidence,
  EvidenceSeverity,
  EvidenceSource,
  EvidenceType,
  FinancialKnowledgeGraphAggregate,
  FinancialModelAggregate,
  IndicatorsAggregate,
  Period,
} from "@/efos/domain";

/**
 * Um período histórico completo da MESMA empresa, anterior ao período
 * atual (Mission 166 — Temporal Evidence Detection, D-087). Carrega
 * `financialModel` (não só `indicators`) porque a regra de fluxo de
 * caixa operacional depende de `FinancialModelAggregate.events`, que
 * não é exposto como um `Indicator` formal (ver
 * `evidence.temporal.builder.ts`).
 */
export interface EvidenceHistoricalPeriod {
  readonly financialModel: FinancialModelAggregate;
  readonly indicators: IndicatorsAggregate;
}

/**
 * Entrada do Evidence Engine: os tres agregados ja calculados pelos
 * Engines anteriores do pipeline, da mesma empresa e do mesmo Financial
 * Model. Este Engine nunca chama `execute()` de nenhum deles — recebe
 * os tres agregados prontos (D-002; entrada formalizada em
 * docs/ARCHITECTURE.md e docs/DECISIONS.md D-006).
 *
 * `priorPeriods?` (Mission 166, D-087) — aditivo e opcional: histórico
 * de períodos ANTERIORES da mesma empresa, em ordem cronológica
 * estritamente crescente (mais antigo primeiro), nunca incluindo o
 * período atual (que continua em `financialModel`/`indicators`
 * acima). Omitido, o comportamento é idêntico ao de antes desta
 * missão (as 5 regras absolutas de período único, Mission 009) — este
 * Engine nunca busca seu próprio histórico (D-002 preservado); quem
 * chama é responsável por fornecer períodos genuinamente da mesma
 * empresa, validados estruturalmente por `validateEvidenceEngineInput()`.
 */
export interface EvidenceEngineInput {
  readonly companyId: string;
  readonly financialModel: FinancialModelAggregate;
  readonly indicators: IndicatorsAggregate;
  readonly financialKnowledgeGraph: FinancialKnowledgeGraphAggregate;
  readonly priorPeriods?: readonly EvidenceHistoricalPeriod[];
}

export type EvidenceEngineOutput = EvidenceAggregate;

/**
 * Resultado intermediario de uma regra de deteccao — tudo que uma
 * Evidence precisa ter, exceto os campos que so o mapper pode
 * preencher (`id`, `companyId`, `provenance`, `audit`). `key` e um
 * identificador estavel da regra que gerou o rascunho, usado para
 * compor o id deterministico da Evidence (evidence.mapper.ts).
 */
export interface EvidenceDraft {
  readonly key: string;
  readonly type: EvidenceType;
  readonly category: EvidenceCategory;
  readonly severity: EvidenceSeverity;
  readonly confidence: EvidenceConfidence;
  readonly title: string;
  readonly description: string;
  readonly supportingData: Readonly<Record<string, unknown>>;
  readonly sources: readonly EvidenceSource[];
  /** Espelha `Evidence.observedPeriod?` (Mission 166, D-087) — presente apenas em rascunhos produzidos por `evidence.temporal.builder.ts`. */
  readonly observedPeriod?: Period;
}
