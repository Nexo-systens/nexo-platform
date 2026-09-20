import type { RecommendationAggregate } from "@/efos/domain";
import type {
  EfosEngine,
  EfosEngineContext,
  EfosEngineResult,
} from "@/efos/interfaces";

import { detectRecommendations } from "./recommendation.builder";
import {
  RECOMMENDATION_ENGINE_CONSTANTS,
  RECOMMENDATION_ENGINE_MESSAGES,
} from "./recommendation.constants";
import { mapDraftsToAggregate } from "./recommendation.mapper";
import type { RecommendationEngineInput } from "./recommendation.types";
import { validateRecommendationEngineInput } from "./recommendation.validator";

/**
 * Recommendation Engine — oitavo estágio nomeado do pipeline oficial
 * (efos/types/pipeline.ts; docs/ARCHITECTURE.md, "Responsabilidade de
 * cada Engine"). Recebe o Financial Model, os Indicadores, o Financial
 * Knowledge Graph, as Evidências, os Contextos e os Reasonings de uma
 * empresa, valida a consistência entre os seis agregados, propõe ações
 * possíveis a partir de Reasonings reconhecidos (recommendation.
 * builder.ts) e retorna um RecommendationAggregate.
 *
 * Não decide qual recomendação será executada, não ordena roadmap
 * executivo, não executa ação, não usa IA/LLM. Apenas propõe ações
 * possíveis de forma determinística e auditável — ver README.md,
 * "Limitações".
 *
 * As regras implementadas hoje derivam Recommendations de
 * `ReasoningAggregate` (para encontrar o Reasoning de origem) e
 * `ContextAggregate` (para derivar a prioridade a partir da
 * severidade dos Contexts referenciados) — `financialModel`,
 * `indicators`, `financialKnowledgeGraph` e `evidence` continuam
 * fazendo parte do contrato de entrada formal (validados por
 * consistência), mas não são lidos pelas regras atuais; reservados
 * para regras futuras que precisem inspecionar dados mais granulares
 * diretamente.
 */
export class RecommendationEngine
  implements
    EfosEngine<
      RecommendationEngineInput,
      EfosEngineResult<RecommendationAggregate>
    >
{
  readonly id = RECOMMENDATION_ENGINE_CONSTANTS.id;

  // Parametro `context` exigido pelo contrato comum (efos/interfaces),
  // ainda nao utilizado nesta fase (sem persistencia, sem orquestracao
  // de pipeline).
  async execute(
    input: RecommendationEngineInput,
    context: EfosEngineContext // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<EfosEngineResult<RecommendationAggregate>> {
    const validation = validateRecommendationEngineInput(input);

    if (!validation.valid) {
      return {
        status: "failed",
        error: [
          RECOMMENDATION_ENGINE_MESSAGES.invalidInput,
          ...validation.errors,
        ].join(" "),
      };
    }

    const drafts = detectRecommendations(input.reasoning, input.context);

    const aggregate = mapDraftsToAggregate(
      input.companyId,
      input.financialModel.root.id,
      drafts
    );

    return {
      status: "completed",
      output: aggregate,
    };
  }
}
