import type { ContextAggregate } from "@/efos/domain";
import type {
  EfosEngine,
  EfosEngineContext,
  EfosEngineResult,
} from "@/efos/interfaces";

import { detectContexts } from "./context.builder";
import {
  CONTEXT_ENGINE_CONSTANTS,
  CONTEXT_ENGINE_MESSAGES,
} from "./context.constants";
import { mapDraftsToAggregate } from "./context.mapper";
import type { ContextEngineInput } from "./context.types";
import { validateContextEngineInput } from "./context.validator";

/**
 * Context Engine — sexto estagio do pipeline oficial
 * (efos/types/pipeline.ts; docs/ARCHITECTURE.md, "Responsabilidade de
 * cada Engine"). Recebe o Financial Model, os Indicadores, o Financial
 * Knowledge Graph e as Evidencias de uma empresa, valida a
 * consistencia entre os quatro agregados, agrupa Evidencias
 * relacionadas em situacoes compostas (context.builder.ts) e retorna
 * um ContextAggregate.
 *
 * Nao interpreta causa, nao infere, nao preve cenarios, nao
 * recomenda, nao decide, nao usa IA, nao persiste, nao chama outro
 * Engine. Apenas descreve situacoes — ver README.md, "Limitacoes".
 *
 * As regras de agrupamento implementadas hoje derivam Contexts
 * inteiramente de `EvidenceAggregate` (categoria/tipo de cada
 * Evidence ja bastam) — `financialModel`, `indicators` e
 * `financialKnowledgeGraph` continuam fazendo parte do contrato de
 * entrada formal (validados por consistencia, D-006/Mission 010), mas
 * nao sao lidos pelas regras atuais; reservados para regras futuras
 * que precisem inspecionar o grafo ou o modelo diretamente.
 */
export class ContextEngine
  implements
    EfosEngine<ContextEngineInput, EfosEngineResult<ContextAggregate>>
{
  readonly id = CONTEXT_ENGINE_CONSTANTS.id;

  // Parametro `context` exigido pelo contrato comum (efos/interfaces),
  // ainda nao utilizado nesta fase (sem persistencia, sem orquestracao
  // de pipeline).
  async execute(
    input: ContextEngineInput,
    context: EfosEngineContext // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<EfosEngineResult<ContextAggregate>> {
    const validation = validateContextEngineInput(input);

    if (!validation.valid) {
      return {
        status: "failed",
        error: [
          CONTEXT_ENGINE_MESSAGES.invalidInput,
          ...validation.errors,
        ].join(" "),
      };
    }

    const drafts = detectContexts(input.evidence);

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
