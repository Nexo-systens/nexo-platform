import type { FinancialModelAggregate } from "@/efos/domain";
import type {
  EfosEngine,
  EfosEngineContext,
  EfosEngineResult,
} from "@/efos/interfaces";

import {
  FINANCIAL_MODEL_ENGINE_CONSTANTS,
  FINANCIAL_MODEL_ENGINE_MESSAGES,
} from "./financial-model.constants";
import { mapToFinancialModelAggregate } from "./financial-model.mapper";
import type { FinancialModelEngineInput } from "./financial-model.types";
import { validateFinancialModelEngineInput } from "./financial-model.validator";

/**
 * Financial Model Engine — primeiro Engine funcional do EFOS
 * (docs/01_ARCHITECTURE/06_EFOS CORE.md, secao 2). Recebe dados ja
 * normalizados, valida estruturalmente, mapeia para o Financial Model
 * canonico do dominio (efos/domain) e retorna o resultado.
 *
 * Nao calcula indicadores, nao gera evidencias, nao persiste nada, nao
 * chama outro Engine, nao integra com Supabase. Ver README.md.
 */
export class FinancialModelEngine
  implements
    EfosEngine<FinancialModelEngineInput, EfosEngineResult<FinancialModelAggregate>>
{
  readonly id = FINANCIAL_MODEL_ENGINE_CONSTANTS.id;

  // Parametro `context` exigido pelo contrato comum (efos/interfaces),
  // ainda nao utilizado nesta fase (sem persistencia, sem orquestracao
  // de pipeline).
  async execute(
    input: FinancialModelEngineInput,
    context: EfosEngineContext // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<EfosEngineResult<FinancialModelAggregate>> {
    const validation = validateFinancialModelEngineInput(input);

    if (!validation.valid) {
      return {
        status: "failed",
        error: [
          FINANCIAL_MODEL_ENGINE_MESSAGES.invalidInput,
          ...validation.errors,
        ].join(" "),
      };
    }

    const aggregate = mapToFinancialModelAggregate(input);

    return {
      status: "completed",
      output: aggregate,
    };
  }
}
