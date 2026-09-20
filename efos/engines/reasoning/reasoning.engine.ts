import type { ReasoningAggregate } from "@/efos/domain";
import type {
  EfosEngine,
  EfosEngineContext,
  EfosEngineResult,
} from "@/efos/interfaces";

import { detectReasonings } from "./reasoning.builder";
import {
  REASONING_ENGINE_CONSTANTS,
  REASONING_ENGINE_MESSAGES,
} from "./reasoning.constants";
import { mapDraftsToAggregate } from "./reasoning.mapper";
import type { ReasoningEngineInput } from "./reasoning.types";
import { validateReasoningEngineInput } from "./reasoning.validator";

/**
 * Reasoning Engine — sétimo estágio do pipeline oficial
 * (efos/types/pipeline.ts; docs/ARCHITECTURE.md, "Responsabilidade de
 * cada Engine"). Recebe o Financial Model, os Indicadores, o Financial
 * Knowledge Graph, as Evidências e os Contextos de uma empresa, valida
 * a consistência entre os cinco agregados, combina Contextos
 * relacionados em conclusões executivas determinísticas
 * (reasoning.builder.ts) e retorna um ReasoningAggregate.
 *
 * Não recomenda ações, não toma decisões, não prevê cenários, não usa
 * IA/LLM. Apenas produz inferências explicáveis, objetivas e
 * auditáveis — ver README.md, "Limitações".
 *
 * As regras implementadas hoje derivam Reasonings inteiramente de
 * `ContextAggregate` (o Context Engine já consolida Evidências
 * relacionadas por tipo, então `Context.type` já basta) —
 * `financialModel`, `indicators`, `financialKnowledgeGraph` e
 * `evidence` continuam fazendo parte do contrato de entrada formal
 * (validados por consistência), mas não são lidos pelas regras atuais;
 * reservados para regras futuras que precisem inspecionar dados mais
 * granulares diretamente.
 */
export class ReasoningEngine
  implements
    EfosEngine<ReasoningEngineInput, EfosEngineResult<ReasoningAggregate>>
{
  readonly id = REASONING_ENGINE_CONSTANTS.id;

  // Parametro `context` exigido pelo contrato comum (efos/interfaces),
  // ainda nao utilizado nesta fase (sem persistencia, sem orquestracao
  // de pipeline).
  async execute(
    input: ReasoningEngineInput,
    context: EfosEngineContext // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<EfosEngineResult<ReasoningAggregate>> {
    const validation = validateReasoningEngineInput(input);

    if (!validation.valid) {
      return {
        status: "failed",
        error: [
          REASONING_ENGINE_MESSAGES.invalidInput,
          ...validation.errors,
        ].join(" "),
      };
    }

    const drafts = detectReasonings(input.context);

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
