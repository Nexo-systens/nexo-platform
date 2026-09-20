import type { EvidenceCategory } from "@/efos/domain";
import type { PipelineStage } from "@/efos/types";

/**
 * Mission 164 — Executive CFO Validation Lab (Etapa 5).
 *
 * Vocabulario fechado de status de deteccao — a pergunta central da
 * missao ("o EFOS detecta o que deveria detectar?"), respondida de
 * forma categorica, nunca numerica. `NOT_TESTABLE` cobre o caso
 * honesto em que o proprio cenario nao foi desenhado para exercitar
 * aquela categoria (ex.: NEXUS nunca teve divida — "debt" e
 * `NOT_TESTABLE`, nunca `NOT_DETECTED`, para essa empresa).
 */
export const DETECTION_STATUSES = [
  "DETECTED",
  "PARTIALLY_DETECTED",
  "NOT_DETECTED",
  "NOT_TESTABLE",
] as const;
export type DetectionStatus = (typeof DETECTION_STATUSES)[number];

/**
 * Um cenario pode ter sido desenhado para que uma categoria de sinal
 * esteja presente (ex.: ORION/liquidity) ou deliberadamente ausente
 * (ex.: NEXUS/liquidity, NEXUS/debt — Mission 161: "single-front risk",
 * usado para provar que o EFOS nao produz falso-positivo quando os
 * dados genuinamente nao sustentam o sinal).
 */
export const SIGNAL_EXPECTED_PRESENCES = ["present", "absent"] as const;
export type SignalExpectedPresence = (typeof SIGNAL_EXPECTED_PRESENCES)[number];

export interface ExecutiveDetectionGapEntry {
  readonly scenarioId: string;
  /** Reaproveita o vocabulario fechado real do Evidence Engine (`efos/domain/enums/evidence.ts`) — nunca uma categoria paralela inventada pelo laboratorio. */
  readonly signalCategory: EvidenceCategory;
  readonly expectedPresence: SignalExpectedPresence;
  readonly detectionStatus: DetectionStatus;
  /**
   * Reaproveita o vocabulario oficial e unico da cadeia principal
   * (`efos/types/pipeline.ts::PipelineStage`, D-006/D-012) — presente
   * apenas quando `detectionStatus` for `NOT_DETECTED`/`PARTIALLY_DETECTED`
   * e a causa raiz puder ser localizada num estagio especifico (Etapa
   * 5, perguntas 1-7: "em qual estagio exato o sinal se perdeu?").
   */
  readonly lostAtStage?: PipelineStage;
  readonly rationale: string;
}

/**
 * Construtor puro — mesma disciplina de `buildExecutiveScorecardEntry()`:
 * nunca decide o status sozinho, apenas normaliza o formato que o
 * harness de teste (unico lugar que le os aggregates reais) preenche
 * apos inspecionar Financial Truth/Indicators/Evidence/Context/
 * Reasoning/Recommendation de verdade.
 */
export function buildExecutiveDetectionGapEntry(
  scenarioId: string,
  signalCategory: EvidenceCategory,
  expectedPresence: SignalExpectedPresence,
  detectionStatus: DetectionStatus,
  rationale: string,
  lostAtStage?: PipelineStage
): ExecutiveDetectionGapEntry {
  return {
    scenarioId,
    signalCategory,
    expectedPresence,
    detectionStatus,
    rationale,
    ...(lostAtStage ? { lostAtStage } : {}),
  };
}
