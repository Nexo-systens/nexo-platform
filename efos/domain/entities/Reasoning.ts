import type { ReasoningConfidence, ReasoningType } from "../enums";
import type { DomainEntity } from "./base";

/**
 * Reasoning — conclusao executiva determinística, resultado de
 * combinar Contextos financeiros relacionados (Mission 011 —
 * Reasoning Engine). Ex.: Context "Pressão de Caixa" → conclusão
 * "Existe risco financeiro de curto prazo". Objetiva, explicável,
 * auditável — nunca recomenda ação, nunca decide, nunca prevê cenário
 * (isso pertence a Recommendation/Decision/Simulation, estágios
 * posteriores do pipeline).
 *
 * `confidence` usa `ReasoningConfidence` (enum próprio deste Engine,
 * não reaproveitado — D-009), consolidada a partir da confiança dos
 * Contexts combinados (o elo mais fraco). `audit.createdAt`
 * (DomainEntity) cumpre o papel de timestamp, mesmo precedente de
 * D-003/D-007/D-008.
 *
 * `contexts` e `evidences` referenciam por ID (`Context.id[]` /
 * `Evidence.id[]`), nunca por composição direta de objeto — mesma
 * convenção de todo agregado do domínio. `evidences` é a união
 * (sem duplicatas) de todas as `Evidence.id` já referenciadas pelos
 * `contexts` incluídos — denormalizado para rastreabilidade direta,
 * sem exigir que o consumidor resolva Context → Evidence a cada
 * consulta; nenhuma referência nova é introduzida além das que já
 * existiam nos Contexts de origem.
 */
export interface Reasoning extends DomainEntity {
  readonly companyId: string;
  readonly type: ReasoningType;
  readonly confidence: ReasoningConfidence;
  readonly title: string;
  readonly description: string;
  readonly contexts: readonly string[];
  readonly evidences: readonly string[];
  readonly supportingData: Readonly<Record<string, unknown>>;
}
