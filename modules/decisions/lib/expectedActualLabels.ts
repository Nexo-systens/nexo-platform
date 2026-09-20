import type {
  ExpectedActualAlignment,
  ExpectedActualDirectionConsistency,
  ExpectedActualEligibility,
} from "@/efos/application/scenario-outcome-comparison";

/**
 * Mission 185 — Expected vs Actual Decision Intelligence. Vocabulário
 * de produto em português — mesma disciplina de `governanceLabels.ts`
 * (Mission 179)/`scenario-language.ts` (Mission 181): nunca expor o
 * literal interno diretamente na UI. "Resultado ainda não observável"/
 * "Dados posteriores insuficientes" (Seção 32 da missão) em vez de
 * termos técnicos; nunca "Decisão funcionou"/"Impacto causado".
 */
export const EXPECTED_ACTUAL_ELIGIBILITY_LABELS: Record<ExpectedActualEligibility, string> = {
  comparable: "Comparação disponível",
  "awaiting-observation": "Resultado ainda não observável",
  "insufficient-data": "Dados posteriores insuficientes",
  "ambiguous-truth": "Verdade financeira atual ambígua",
};

export const EXPECTED_ACTUAL_ALIGNMENT_LABELS: Record<ExpectedActualAlignment, string> = {
  "better-than-expected": "Melhor que o esperado",
  "worse-than-expected": "Pior que o esperado",
  "as-expected": "Conforme esperado",
  neutral: "Neutro",
};

export const EXPECTED_ACTUAL_DIRECTION_CONSISTENCY_LABELS: Record<ExpectedActualDirectionConsistency, string> = {
  "consistent-direction": "Direção consistente com o esperado",
  "opposite-direction": "Direção oposta ao esperado",
  neutral: "Neutro",
};
