import type { LearningAggregate } from "@/efos/domain";
import type {
  EfosEngine,
  EfosEngineContext,
  EfosEngineResult,
} from "@/efos/interfaces";

import { detectLearnings } from "./learning.builder";
import {
  LEARNING_ENGINE_CONSTANTS,
  LEARNING_ENGINE_MESSAGES,
} from "./learning.constants";
import { mapDraftsToAggregate } from "./learning.mapper";
import type { LearningEngineInput } from "./learning.types";
import { validateLearningEngineInput } from "./learning.validator";

/**
 * Learning Engine — décimo e último estágio da cadeia principal do
 * pipeline oficial (efos/types/pipeline.ts, EFOS_PIPELINE;
 * docs/ARCHITECTURE.md, "Responsabilidade de cada Engine"). Recebe as
 * Evidências, os Contextos, os Reasonings, as Recommendations e as
 * Decisions de uma empresa, valida a consistência entre os cinco
 * agregados, registra conhecimento consolidado a partir do que já foi
 * produzido (learning.builder.ts) e retorna um LearningAggregate.
 *
 * Não modifica o comportamento do sistema, não altera nenhum dos
 * agregados consumidos, não usa IA/LLM/Machine Learning/auto-tuning,
 * não executa decisões. Apenas observa e registra — ver README.md,
 * "Limitações".
 *
 * A regra implementada hoje deriva LearningRecords de
 * `ReasoningAggregate`, `RecommendationAggregate` e
 * `DecisionAggregate` — `evidence` e `context` continuam fazendo
 * parte do contrato de entrada formal (validados por consistência),
 * mas não são lidos diretamente pelas regras atuais (alcançados
 * apenas por referência de ID via Reasoning/Decision); reservados para
 * regras futuras que precisem inspecionar dados mais granulares
 * diretamente.
 */
export class LearningEngine
  implements
    EfosEngine<LearningEngineInput, EfosEngineResult<LearningAggregate>>
{
  readonly id = LEARNING_ENGINE_CONSTANTS.id;

  // Parametro `context` exigido pelo contrato comum (efos/interfaces),
  // ainda nao utilizado nesta fase (sem persistencia, sem orquestracao
  // de pipeline).
  async execute(
    input: LearningEngineInput,
    context: EfosEngineContext // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<EfosEngineResult<LearningAggregate>> {
    const validation = validateLearningEngineInput(input);

    if (!validation.valid) {
      return {
        status: "failed",
        error: [
          LEARNING_ENGINE_MESSAGES.invalidInput,
          ...validation.errors,
        ].join(" "),
      };
    }

    const drafts = detectLearnings(
      input.reasoning,
      input.recommendation,
      input.decision
    );

    const aggregate = mapDraftsToAggregate(
      input.companyId,
      input.decision.financialModelId,
      drafts
    );

    return {
      status: "completed",
      output: aggregate,
    };
  }
}
