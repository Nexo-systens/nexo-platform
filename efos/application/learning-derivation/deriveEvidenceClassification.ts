import type { LearningConfidence } from "@/efos/domain";
import type { LearningEvidenceClassification } from "@/efos/domain";
import type { Outcome } from "@/efos/domain";
import type { FinancialOutcomeObservation } from "@/efos/application/financial-observation";

export interface EvidenceClassificationResult {
  readonly classification: LearningEvidenceClassification;
  readonly confidence: LearningConfidence;
}

export type DeriveEvidenceClassificationError = {
  readonly code: "INSUFFICIENT_EVIDENCE";
  readonly message: string;
};

/**
 * `deriveEvidenceClassification()` (Mission 140) — a única regra de
 * classificação de evidência desta missão. Função pura, determinística,
 * nunca chamada pela IA.
 *
 * **Por que "evidência favorável"/"evidência contrária" nunca
 * interpretam a DIREÇÃO de um indicador financeiro**: nenhum lugar do
 * domínio EFOS hoje codifica se "Despesas Operacionais aumentaram" é
 * bom ou ruim (isso depende do contexto — uma despesa que aumenta
 * junto de receita proporcionalmente maior pode ser saudável). Inventar
 * essa semântica agora seria exatamente a causalidade não comprovada
 * que esta missão proíbe (Etapa 3/Princípio Absoluto). Em vez disso,
 * a classificação deriva EXCLUSIVAMENTE do único julgamento humano já
 * confiável que o sistema possui — `Outcome.status` (D-011, um humano
 * já escreveu, com suas próprias palavras, se o resultado foi bom) —
 * e usa a presença de uma `FinancialOutcomeObservation` real (D-071)
 * apenas como um sinal de FORÇA de evidência (há dado financeiro real
 * para examinar ao lado do julgamento humano), nunca para julgar
 * direção.
 *
 * **Regras, na ordem exata**:
 * 1. Nenhum `Outcome` E nenhuma `FinancialOutcomeObservation` →
 *    `INSUFFICIENT_EVIDENCE` (erro, nunca um valor — mesma convenção
 *    de `NOT_STARTED`/`PENDING`: ausência de evidência é representada
 *    pela ausência de qualquer `LearningRecord`, nunca por um registro
 *    real com esse status).
 * 2. Nenhum `Outcome`, mas ao menos 1 `FinancialOutcomeObservation` →
 *    `TEMPORAL_ASSOCIATION`, confidence `"low"` (há movimento
 *    financeiro real, mas nenhum julgamento humano ainda).
 * 3. Existe `Outcome` — a classificação segue diretamente
 *    `Outcome.status` (o julgamento humano mais recente, quando há
 *    mais de um): `positive` → `EVIDENCE_FAVORABLE`; `negative` →
 *    `EVIDENCE_CONTRARY`; `neutral`/`inconclusive`/`pending` →
 *    `INCONCLUSIVE`. `confidence` é `"high"` quando também existe ao
 *    menos 1 `FinancialOutcomeObservation` real (duas fontes de
 *    evidência independentes convergindo), `"medium"` quando só o
 *    julgamento humano existe.
 */
export function deriveEvidenceClassification(
  outcomes: readonly Outcome[],
  financialObservations: readonly FinancialOutcomeObservation[]
): { readonly success: true; readonly value: EvidenceClassificationResult } | { readonly success: false; readonly error: DeriveEvidenceClassificationError } {
  const hasOutcome = outcomes.length > 0;
  const hasFinancialObservation = financialObservations.length > 0;

  if (!hasOutcome && !hasFinancialObservation) {
    return {
      success: false,
      error: {
        code: "INSUFFICIENT_EVIDENCE",
        message: "Nenhum Outcome humano e nenhuma FinancialOutcomeObservation existem ainda para esta Decision — nenhum LearningRecord pode ser derivado sem evidência real.",
      },
    };
  }

  if (!hasOutcome) {
    return { success: true, value: { classification: "TEMPORAL_ASSOCIATION", confidence: "low" } };
  }

  // outcomes[0] é sempre o mais recente — mesma convenção de leitura de
  // getOutcomesByDecision() (order by observed_at desc, Mission 138).
  const latestOutcome = outcomes[0];
  const confidence: LearningConfidence = hasFinancialObservation ? "high" : "medium";

  switch (latestOutcome.status) {
    case "positive":
      return { success: true, value: { classification: "EVIDENCE_FAVORABLE", confidence } };
    case "negative":
      return { success: true, value: { classification: "EVIDENCE_CONTRARY", confidence } };
    case "neutral":
    case "inconclusive":
    case "pending":
      return { success: true, value: { classification: "INCONCLUSIVE", confidence } };
  }
}
