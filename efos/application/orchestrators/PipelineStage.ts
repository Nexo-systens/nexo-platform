import { EFOS_PIPELINE } from "@/efos/types";
import type { PipelineStage as EfosPipelineStage } from "@/efos/types";

/**
 * Vocabulário oficial dos estágios da cadeia principal — reexportado
 * de `efos/types/pipeline.ts` (`EFOS_PIPELINE`/`PipelineStage`),
 * nunca redeclarado aqui. O Orchestrator não define uma segunda fonte
 * de verdade para a ordem do pipeline — a ordem já é oficial e única
 * (D-006, D-012, `docs/DECISIONS.md`); duplicá-la neste arquivo
 * quebraria exatamente o princípio que essas duas decisões
 * estabeleceram. Simulation permanece fora desta lista (D-012).
 *
 * Data → Financial Model → Indicators → Financial Knowledge Graph →
 * Evidence → Context → Reasoning → Recommendation → Decision →
 * Learning
 */
export const ORCHESTRATOR_PIPELINE_STAGES = EFOS_PIPELINE;
export type PipelineStage = EfosPipelineStage;
