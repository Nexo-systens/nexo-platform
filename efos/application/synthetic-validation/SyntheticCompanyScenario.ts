import type { SyntheticCompanyDefinition } from "./SyntheticCompanyDefinition";
import type { SyntheticFinancialDataset } from "./SyntheticFinancialDataset";
import type { SyntheticGroundTruth } from "./SyntheticGroundTruth";

/**
 * Mission 156 — Synthetic Company Validation Foundation (Etapa 9).
 *
 * Vocabulário fechado do que o cenário foi DESENHADO para suportar —
 * metadado de validação, nunca estado do Domain, nunca persistido.
 * Nem toda capacidade listada é necessariamente EXERCITADA por esta
 * missão (ver `SyntheticCompanyScenario.exercisedCapabilities` — Etapa
 * 12/13: só o que foi realmente rodado contra uma Engine real entra
 * ali, o resto é preparação para missões futuras).
 */
export const SYNTHETIC_SCENARIO_CAPABILITIES = [
  "financial_truth",
  "diagnosis",
  "recommendation",
  "review",
  "decision",
  "execution",
  "outcome",
  "learning",
  "knowledge",
] as const;
export type SyntheticScenarioCapability = (typeof SYNTHETIC_SCENARIO_CAPABILITIES)[number];

export interface SyntheticScenarioMetadata {
  readonly scenarioId: string;
  readonly version: string;
  readonly createdFor: string;
  readonly description: string;
  /** Capacidades para as quais o cenário foi desenhado (design intent). */
  readonly capabilities: readonly SyntheticScenarioCapability[];
  /** Capacidades genuinamente exercitadas contra uma Engine real nesta missão. */
  readonly exercisedCapabilities: readonly SyntheticScenarioCapability[];
}

/**
 * `SyntheticCompanyScenario` — a composição final, pronta para consumo
 * pelo harness de validação: identidade + dataset (o que o EFOS recebe)
 * + ground truth (o que só o teste sabe) + metadata. Nunca combina os
 * dois primeiros — `dataset` e `groundTruth` permanecem sempre campos
 * irmãos separados, nunca fundidos num único objeto que um consumidor
 * desavisado poderia enviar inteiro à IA por engano.
 */
export interface SyntheticCompanyScenario {
  readonly company: SyntheticCompanyDefinition;
  readonly dataset: SyntheticFinancialDataset;
  readonly groundTruth: SyntheticGroundTruth;
  readonly scenarioMetadata: SyntheticScenarioMetadata;
}
