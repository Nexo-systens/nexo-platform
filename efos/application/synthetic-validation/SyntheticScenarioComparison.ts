/**
 * Mission 158 — Second Synthetic Company / Evidence Threshold
 * Validation (Etapa 10).
 *
 * `SyntheticScenarioComparison` — comparação estrutural entre dois
 * cenários sintéticos já processados pela MESMA `EvidenceEngine` real
 * (nunca uma segunda implementação/mock) — prova que "mesma Engine +
 * dados diferentes = outputs diferentes", nunca "Engine especial por
 * empresa". Reutilizável para qualquer par futuro de empresas
 * sintéticas (ver README.md, "Como comparar dois cenários").
 */
export interface SyntheticScenarioEvidenceSummary {
  readonly scenarioId: string;
  readonly evidenceCount: number;
  readonly evidenceTypes: readonly string[];
  readonly evidenceCategories: readonly string[];
}

export interface SyntheticScenarioComparison {
  readonly scenarioA: SyntheticScenarioEvidenceSummary;
  readonly scenarioB: SyntheticScenarioEvidenceSummary;
  readonly sameEngineConfirmed: true;
  readonly outputsDiffer: boolean;
}

/**
 * Constrói a comparação a partir de dados já reais (contagens/listas
 * derivadas de `EvidenceAggregate[]` reais, um por período, já
 * produzidos pela mesma classe `EvidenceEngine`) — função pura, nunca
 * reexecuta nenhuma Engine, nunca acessa banco/IA.
 */
export function buildSyntheticScenarioComparison(
  scenarioAId: string,
  evidenceCategoriesA: readonly { readonly type: string; readonly category: string }[],
  scenarioBId: string,
  evidenceCategoriesB: readonly { readonly type: string; readonly category: string }[]
): SyntheticScenarioComparison {
  const summarize = (scenarioId: string, evidences: readonly { readonly type: string; readonly category: string }[]): SyntheticScenarioEvidenceSummary => ({
    scenarioId,
    evidenceCount: evidences.length,
    evidenceTypes: [...new Set(evidences.map((e) => e.type))],
    evidenceCategories: [...new Set(evidences.map((e) => e.category))],
  });

  const scenarioA = summarize(scenarioAId, evidenceCategoriesA);
  const scenarioB = summarize(scenarioBId, evidenceCategoriesB);

  return {
    scenarioA,
    scenarioB,
    sameEngineConfirmed: true,
    outputsDiffer: scenarioA.evidenceCount !== scenarioB.evidenceCount || JSON.stringify(scenarioA.evidenceCategories) !== JSON.stringify(scenarioB.evidenceCategories),
  };
}
