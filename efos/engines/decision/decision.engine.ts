import type { DecisionAggregate } from "@/efos/domain";
import type {
  EfosEngine,
  EfosEngineContext,
  EfosEngineResult,
} from "@/efos/interfaces";

import { detectDecisions } from "./decision.builder";
import {
  DECISION_ENGINE_CONSTANTS,
  DECISION_ENGINE_MESSAGES,
} from "./decision.constants";
import { mapDraftsToAggregate } from "./decision.mapper";
import type { DecisionEngineInput } from "./decision.types";
import { validateDecisionEngineInput } from "./decision.validator";

/**
 * Decision Engine — décimo estágio nomeado do pipeline oficial
 * (efos/types/pipeline.ts; docs/ARCHITECTURE.md, "Responsabilidade de
 * cada Engine"). Recebe as Evidências, os Contextos, os Reasonings e
 * as Recommendations de uma empresa, valida a consistência entre os
 * quatro agregados, prioriza as Recommendations recebidas
 * (decision.builder.ts) e retorna um DecisionAggregate.
 *
 * Não executa ações, não simula cenários, não usa IA/LLM. Apenas
 * organiza e prioriza Recommendations de forma determinística e
 * auditável — ver README.md, "Limitações", inclusive sobre a
 * reconciliação com a Regra Fundamental "o EFOS nunca decide".
 *
 * A regra implementada hoje deriva Decisions inteiramente de
 * `RecommendationAggregate` (prioridade e confiança de cada
 * Recommendation já bastam) — `evidence`, `context` e `reasoning`
 * continuam fazendo parte do contrato de entrada formal (validados
 * por consistência), mas não são lidos pela regra atual; reservados
 * para regras futuras que precisem inspecionar dados mais granulares
 * diretamente.
 */
export class DecisionEngine
  implements
    EfosEngine<DecisionEngineInput, EfosEngineResult<DecisionAggregate>>
{
  readonly id = DECISION_ENGINE_CONSTANTS.id;

  // Parametro `context` exigido pelo contrato comum (efos/interfaces),
  // ainda nao utilizado nesta fase (sem persistencia, sem orquestracao
  // de pipeline).
  async execute(
    input: DecisionEngineInput,
    context: EfosEngineContext // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<EfosEngineResult<DecisionAggregate>> {
    const validation = validateDecisionEngineInput(input);

    if (!validation.valid) {
      return {
        status: "failed",
        error: [
          DECISION_ENGINE_MESSAGES.invalidInput,
          ...validation.errors,
        ].join(" "),
      };
    }

    const drafts = detectDecisions(input.recommendation);

    const aggregate = mapDraftsToAggregate(
      input.companyId,
      input.recommendation.financialModelId,
      drafts
    );

    return {
      status: "completed",
      output: aggregate,
    };
  }
}
