import type {
  RecommendationConfidence,
  RecommendationPriority,
  RecommendationType,
} from "../enums";
import type { DomainEntity } from "./base";

/**
 * Recommendation — ação executiva proposta, resultado de um ou mais
 * Reasonings (Mission 012 — Recommendation Engine). Ex.: Reasoning
 * "Existe risco financeiro de curto prazo" → recomendação "Reforçar
 * geração de caixa operacional". Clara, objetiva, executável,
 * rastreável, auditável — nunca decide qual recomendação será
 * executada, nunca ordena roadmap executivo, nunca executa ação (isso
 * pertence a Decision, estágio posterior do pipeline).
 *
 * `priority`/`confidence` usam vocabulário próprio deste Engine —
 * `RecommendationPriority` (`efos/domain/enums/decision.ts`, Mission
 * 003, valores atualizados na Mission 012 — D-010) e
 * `RecommendationConfidence` (novo, D-010, não reaproveita
 * `ReasoningConfidence` por instrução explícita da missão).
 * `expectedImpact` é texto estruturado descritivo — nunca um cálculo
 * financeiro nem uma estimativa de valor monetário.
 * `audit.createdAt` (DomainEntity) cumpre o papel de timestamp, mesmo
 * precedente de D-003/D-007/D-008/D-009.
 *
 * `reasonings`/`contexts`/`evidences` referenciam por ID (`Reasoning
 * .id[]` / `Context.id[]` / `Evidence.id[]`), nunca por composição
 * direta de objeto — mesma convenção de todo agregado do domínio.
 * `contexts`/`evidences` são o repasse direto (sem duplicatas) dos
 * mesmos campos já presentes nos Reasonings de origem — denormalizado
 * para rastreabilidade direta, sem introduzir referência nova além das
 * que já existiam.
 */
export interface Recommendation extends DomainEntity {
  readonly companyId: string;
  readonly type: RecommendationType;
  readonly priority: RecommendationPriority;
  readonly confidence: RecommendationConfidence;
  readonly title: string;
  readonly description: string;
  readonly expectedImpact: string;
  readonly reasonings: readonly string[];
  readonly contexts: readonly string[];
  readonly evidences: readonly string[];
  readonly supportingData: Readonly<Record<string, unknown>>;
}
