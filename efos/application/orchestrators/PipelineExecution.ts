import type {
  ContextAggregate,
  DecisionAggregate,
  EvidenceAggregate,
  FinancialKnowledgeGraphAggregate,
  FinancialModelAggregate,
  IndicatorsAggregate,
  LearningAggregate,
  ReasoningAggregate,
  RecommendationAggregate,
} from "@/efos/domain";
import type { DataEngineOutput } from "@/efos/engines/data";

import type { PipelineContext } from "./PipelineContext";

/**
 * Objeto canônico que representa uma execução completa do EFOS
 * (Mission 020B — Pipeline Execution State). Armazena a saída de cada
 * estágio já executado, exatamente como produzida pelo Engine
 * correspondente — nenhum cálculo, nenhuma transformação, nenhuma
 * lógica adicional. Construído incrementalmente por
 * `EFOSPipelineRuntime.execute()` (Mission 020A — Engine Wiring):
 * cada campo é preenchido logo após o Engine daquele estágio
 * concluir, nunca recalculado nem modificado depois de armazenado —
 * os Aggregates são guardados pela mesma referência produzida pelo
 * Engine (D-002), nunca copiados ou alterados pelo Runtime.
 *
 * Todos os campos de estágio são opcionais porque uma execução pode
 * ser interrompida por falha (`PipelineError`, `EFOSPipelineRuntime`)
 * antes de alcançar todos os 10 estágios — `PipelineExecution`
 * reflete exatamente o que foi produzido até o ponto de parada,
 * nunca um valor inventado para um estágio não alcançado.
 *
 * Cada campo usa o mesmo nome já convencionado pelos contratos de
 * entrada dos próprios Engines (`financialModel`, `indicators`,
 * `financialKnowledgeGraph`, `evidence`, `context`, `reasoning`,
 * `recommendation`, `decision`, `learning` — ver os arquivos
 * `<engine>.types.ts` de cada Engine, `efos/engines/`), nenhum
 * vocabulário novo. `pipelineContext` carrega os
 * metadados identificadores da execução (`companyId`, `requestId`,
 * `executionId`, `timestamp`) — reaproveita `PipelineContext`
 * (Mission 018, D-015) em vez de duplicar esses campos aqui (D-017).
 * Nomeado `pipelineContext`, e não `context`, para não colidir com o
 * campo `context` (saída do Context Engine, `ContextAggregate`).
 */
export interface PipelineExecution {
  readonly pipelineContext: PipelineContext;
  readonly data?: DataEngineOutput;
  readonly financialModel?: FinancialModelAggregate;
  readonly indicators?: IndicatorsAggregate;
  readonly financialKnowledgeGraph?: FinancialKnowledgeGraphAggregate;
  readonly evidence?: EvidenceAggregate;
  readonly context?: ContextAggregate;
  readonly reasoning?: ReasoningAggregate;
  readonly recommendation?: RecommendationAggregate;
  readonly decision?: DecisionAggregate;
  readonly learning?: LearningAggregate;
}
