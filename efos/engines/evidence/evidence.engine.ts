import type { EvidenceAggregate } from "@/efos/domain";
import type {
  EfosEngine,
  EfosEngineContext,
  EfosEngineResult,
} from "@/efos/interfaces";

import { detectEvidence } from "./evidence.builder";
import {
  EVIDENCE_ENGINE_CONSTANTS,
  EVIDENCE_ENGINE_MESSAGES,
} from "./evidence.constants";
import { detectTemporalEvidence } from "./evidence.temporal.builder";
import { mapDraftsToAggregate } from "./evidence.mapper";
import type { EvidenceEngineInput } from "./evidence.types";
import { validateEvidenceEngineInput } from "./evidence.validator";

/**
 * Evidence Engine — quinto estagio do pipeline oficial
 * (efos/types/pipeline.ts; docs/ARCHITECTURE.md, "Responsabilidade de
 * cada Engine"). Recebe o Financial Model, os Indicadores e o
 * Financial Knowledge Graph de uma empresa, valida a consistencia
 * entre os tres agregados, aplica regras deterministicas de deteccao
 * de fatos (evidence.builder.ts) e retorna um EvidenceAggregate.
 *
 * Nao interpreta causa, nao gera recomendacao, nao decide, nao preve,
 * nao usa IA, nao persiste, nao chama outro Engine. Produz apenas
 * fatos objetivos e auditaveis, cada um com origem rastreavel
 * (`Evidence.sources`) — ver README.md, "Limitacoes".
 */
export class EvidenceEngine
  implements
    EfosEngine<EvidenceEngineInput, EfosEngineResult<EvidenceAggregate>>
{
  readonly id = EVIDENCE_ENGINE_CONSTANTS.id;

  // Parametro `context` exigido pelo contrato comum (efos/interfaces),
  // ainda nao utilizado nesta fase (sem persistencia, sem orquestracao
  // de pipeline).
  async execute(
    input: EvidenceEngineInput,
    context: EfosEngineContext // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<EfosEngineResult<EvidenceAggregate>> {
    const validation = validateEvidenceEngineInput(input);

    if (!validation.valid) {
      return {
        status: "failed",
        error: [
          EVIDENCE_ENGINE_MESSAGES.invalidInput,
          ...validation.errors,
        ].join(" "),
      };
    }

    // Mission 166 — Temporal Evidence Detection (D-087). Regras
    // absolutas (período único, Mission 009) e temporais (histórico
    // opcional) são deliberadamente duas chamadas separadas — nunca
    // uma reimplementa a outra. `priorPeriods` ausente/vazio produz
    // `[]` aqui, preservando o comportamento anterior a esta missão
    // byte a byte.
    const drafts = [
      ...detectEvidence(
        input.financialModel,
        input.indicators,
        input.financialKnowledgeGraph
      ),
      ...detectTemporalEvidence(
        input.financialModel,
        input.indicators,
        input.priorPeriods,
        input.financialKnowledgeGraph
      ),
    ];

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
