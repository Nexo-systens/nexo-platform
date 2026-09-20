import type { SyntheticCompanyDefinition } from "./SyntheticCompanyDefinition";
import type { SyntheticFinancialDataset } from "./SyntheticFinancialDataset";
import type { SyntheticGroundTruth } from "./SyntheticGroundTruth";
import type {
  SyntheticCompanyScenario,
  SyntheticScenarioCapability,
} from "./SyntheticCompanyScenario";

/**
 * Mission 156 — Synthetic Company Validation Foundation (Etapa 6).
 *
 * `buildSyntheticCompanyScenario()` — função pura de composição: recebe
 * as três peças já construídas deterministicamente (company/dataset/
 * groundTruth, cada uma definida por um módulo de empresa específico,
 * ex.: `companies/aurea-industrial-solutions.ts`) e monta o
 * `SyntheticCompanyScenario` final, junto do metadata de capacidades.
 *
 * **Nunca**: `randomUUID()`, `Date.now()`, `new Date()` sem argumento,
 * acesso a Supabase/banco, chamada a Anthropic/qualquer IA, mutação de
 * nenhum argumento recebido. Mesmo input sempre produz o mesmo output
 * — testado explicitamente (Etapa 6/11-B).
 */
export function buildSyntheticCompanyScenario(
  company: SyntheticCompanyDefinition,
  dataset: SyntheticFinancialDataset,
  groundTruth: SyntheticGroundTruth,
  version: string,
  exercisedCapabilities: readonly SyntheticScenarioCapability[]
): SyntheticCompanyScenario {
  return {
    company,
    dataset,
    groundTruth,
    scenarioMetadata: {
      scenarioId: company.scenarioId,
      version,
      createdFor: "Mission 156 — Synthetic Company Validation Foundation",
      description: company.executiveDescription,
      capabilities: [
        "financial_truth",
        "diagnosis",
        "recommendation",
        "review",
        "decision",
        "execution",
        "outcome",
        "learning",
        "knowledge",
      ],
      exercisedCapabilities,
    },
  };
}
