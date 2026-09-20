import type {
  EfosEngine,
  EfosEngineContext,
  EfosEngineResult,
} from "@/efos/interfaces";

import { DATA_ENGINE_CONSTANTS, DATA_ENGINE_MESSAGES } from "./data.constants";
import { mapDocumentsToCandidateRecords } from "./data.mapper";
import { normalizeCandidateRecords } from "./data.normalizer";
import type { DataEngineInput, DataEngineOutput } from "./data.types";
import { validateDataEngineInput } from "./data.validator";

/**
 * Data Engine — primeiro estagio do pipeline oficial do EFOS
 * (efos/types/pipeline.ts; docs/01_ARCHITECTURE/06_EFOS CORE.md, §1).
 * Recebe documentos financeiros brutos ja estruturados em linhas, valida
 * a estrutura, mapeia para o formato candidato e normaliza, produzindo
 * `NormalizedFinancialRecord[]` — o contrato oficial de entrada do
 * Financial Model Engine (efos/engines/financial-model).
 *
 * Nao interpreta, nao recomenda, nao calcula, nao persiste, nao chama
 * outro Engine, nao integra com Supabase. Ver README.md.
 */
export class DataEngine
  implements EfosEngine<DataEngineInput, EfosEngineResult<DataEngineOutput>>
{
  readonly id = DATA_ENGINE_CONSTANTS.id;

  // Parametro `context` exigido pelo contrato comum (efos/interfaces),
  // ainda nao utilizado nesta fase (sem persistencia, sem orquestracao
  // de pipeline).
  async execute(
    input: DataEngineInput,
    context: EfosEngineContext // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<EfosEngineResult<DataEngineOutput>> {
    const validation = validateDataEngineInput(input);

    if (!validation.valid) {
      return {
        status: "failed",
        error: [DATA_ENGINE_MESSAGES.invalidInput, ...validation.errors].join(
          " "
        ),
      };
    }

    const candidates = mapDocumentsToCandidateRecords(input.documents);
    const records = normalizeCandidateRecords(candidates);

    if (records.length === 0) {
      return {
        status: "failed",
        error: DATA_ENGINE_MESSAGES.noRecordsExtracted,
      };
    }

    return {
      status: "completed",
      output: records,
    };
  }
}
