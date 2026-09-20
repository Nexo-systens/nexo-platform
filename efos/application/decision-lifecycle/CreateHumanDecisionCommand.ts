import type {
  DecisionType,
  RecommendationConfidence,
  RecommendationPriority,
} from "@/efos/domain";

import type { ScenarioDecisionContext } from "./ScenarioDecisionContext";

/**
 * `CreateHumanDecisionCommand` (Mission 124 — Human Decision Lifecycle
 * Composition, Etapa 4). Carrega **exclusivamente** o necessário para
 * representar um ato humano de decisão — nunca autoridade de IA,
 * aprovação automática, execução, `Outcome`, ou recálculo financeiro
 * (nenhum desses conceitos é sequer representável neste tipo).
 *
 * `diagnosisId?`/`reviewId?` são opcionais e independentes um do
 * outro — uma decisão humana pode existir sem nenhum dos dois
 * (Cenário F, Etapa 6: decisão independente da IA), só com
 * `reviewId` (revisão sem o diagnóstico bruto à mão), ou com ambos.
 * Referenciados por `string` (id), nunca pelo objeto completo — mesma
 * convenção de todo o Domain (`Decision.recommendations: string[]`
 * etc.) — este comando nunca valida o *conteúdo* de um
 * `ExecutiveDiagnosis`/`DiagnosisReview` real, apenas aceita o id que
 * o chamador já resolveu.
 *
 * `humanActorId` é **obrigatório e não opcional** — a Regra
 * Fundamental desta missão (Etapa 5): nenhuma composição produz uma
 * `Decision` humana sem um ator humano explícito.
 */
export interface CreateHumanDecisionCommand {
  readonly humanActorId: string;
  readonly diagnosisId?: string;
  readonly reviewId?: string;
  /**
   * Mission 150 — Executive Recommendation → Human Decision
   * Traceability (D-082). Aditivo e opcional, mesmo precedente de
   * `diagnosisId?`/`reviewId?` — o `id` opaco de um item específico
   * dentro do `ExecutiveDiagnosis` referenciado por `diagnosisId`
   * (nunca aceito sem `diagnosisId`, verificado pelo chamador antes de
   * construir este comando). Mapeado diretamente para
   * `Decision.basedOnRecommendationId`.
   */
  readonly recommendationId?: string;
  /**
   * Mission 184 — Scenario-to-Decision Governance Bridge. Aditivo e
   * opcional, mesmo precedente exato de `recommendationId?` acima —
   * nunca aceito diretamente do client (ver
   * `modules/scenarios/actions/scenario-decision.actions.ts`,
   * `createScenarioDecisionAction()`, o único ponto que constrói este
   * campo, sempre a partir de uma simulação RECOMPUTADA no servidor a
   * partir do baseline canônico — nunca de valores projetados enviados
   * pelo browser). Mapeado para `Decision.supportingData.scenarioContext`
   * (nunca um campo novo em `Decision` — ver `ScenarioDecisionContext.ts`
   * para o racional completo de por que não pode viver como campo de
   * primeira classe do Domain).
   */
  readonly scenarioContext?: ScenarioDecisionContext;
  readonly companyId: string;
  readonly type: DecisionType;
  readonly priority: RecommendationPriority;
  readonly confidence: RecommendationConfidence;
  readonly title: string;
  readonly description: string;
  readonly rationale: string;
  readonly recommendations?: readonly string[];
  readonly reasonings?: readonly string[];
  readonly contexts?: readonly string[];
  readonly evidences?: readonly string[];
  readonly supportingData?: Readonly<Record<string, unknown>>;
}
