import type { LearningRecord, Outcome } from "@/efos/domain";
import type { Result } from "@/efos/application/shared";
import type { FinancialOutcomeObservation } from "@/efos/application/financial-observation";
import type { ExpectedActualLearningContext } from "@/efos/application/expected-actual-learning";

import { deriveEvidenceClassification } from "./deriveEvidenceClassification";
import { validateLearningRecord } from "./LearningRecord.validator";

export interface LearningRecordInputDecision {
  readonly id: string;
  readonly companyId: string;
  readonly title: string;
}

export type BuildLearningRecordError =
  | { readonly code: "INSUFFICIENT_EVIDENCE"; readonly message: string }
  | { readonly code: "HUMAN_STATEMENT_REQUIRED"; readonly message: string }
  | { readonly code: "INVALID_RECORD"; readonly errors: readonly string[] };

function isNonEmptyString(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

const CLASSIFICATION_DESCRIPTIONS: Record<string, string> = {
  TEMPORAL_ASSOCIATION:
    "Movimento financeiro observado após a execução desta decisão — associação temporal, nunca prova de que a decisão o causou. Nenhum julgamento humano registrado ainda.",
  EVIDENCE_FAVORABLE:
    "O humano responsável avaliou o resultado desta decisão como positivo. Isto reflete o julgamento humano registrado, nunca uma conclusão automática sobre causalidade.",
  EVIDENCE_CONTRARY:
    "O humano responsável avaliou o resultado desta decisão como negativo. Isto reflete o julgamento humano registrado, nunca uma conclusão automática sobre causalidade.",
  INCONCLUSIVE:
    "O julgamento humano registrado sobre esta decisão permanece neutro, inconclusivo ou pendente — nenhuma conclusão clara está disponível ainda.",
};

/**
 * `buildLearningRecord()` (Mission 140 — EFOS Continuous Financial
 * Intelligence & Learning Loop). Único ponto de composição autorizado
 * a transformar `Decision`+`Outcome`(D-011/Mission 138)+
 * `FinancialOutcomeObservation`(D-071/Mission 139) num `LearningRecord`
 * real (D-013, ativado por esta missão) — nunca a partir de uma
 * opinião livre, sempre derivado de estado canônico já persistido.
 *
 * Função pura — nunca acessa Repository/banco diretamente (quem chama
 * já resolveu `outcomes`/`financialObservations` antes), nunca gera
 * `randomUUID()`/`Date.now()` internamente (`id`/`derivedAt` sempre
 * parâmetros). Nunca chamada pela IA (nenhum import de
 * `efos/infrastructure/executive-ai/` em nenhum arquivo deste módulo).
 *
 * `type: "observation"`/`source: "historical_pattern"` (`LearningType`/
 * `LearningSource`, `efos/domain/enums/learning.ts`) — ambos já
 * reservados no vocabulário desde a Mission 015 (D-013), nunca usados
 * até agora; nenhum valor novo foi adicionado a esses dois enums.
 *
 * **Sem conhecimento fabricado (Etapa 8.C)**: se nem `outcomes` nem
 * `financialObservations` existirem, devolve `INSUFFICIENT_EVIDENCE`
 * — nunca um `LearningRecord` inventado.
 *
 * **`expectedActualContext` (Mission 186 — Decision Learning from
 * Expected vs Observed, opcional e aditivo, mesmo precedente exato de
 * `outcomeIds?`/`financialObservationIds?`/`evidenceClassification?`
 * acima).** Nunca calculado aqui — sempre pré-computado por
 * `deriveExpectedActualLearningEligibility()`
 * (`efos/application/expected-actual-learning/`), que por sua vez só
 * lê a camada `formal` já produzida por `resolveExpectedActualComparison()`
 * (Mission 185/185 Closure) — esta função nunca reimplementa B → E → O
 * (Seção 30 da missão). Quando presente, é serializado em
 * `supportingData.expectedActualContext`, nunca um novo campo do
 * Domain `LearningRecord` — mesmo mecanismo de escape já usado por
 * `Decision.supportingData.scenarioContext` (D-094) e por
 * `evidence.supportingData.indicatorName` — para que o Domain nunca
 * precise conhecer o vocabulário "Scenario"/"ExpectedActual" por nome
 * (REGRA 2). Nunca muda `classification`/`confidence`/`type`/`source`/
 * `title`/`description` — a camada determinística financeira
 * (`supportingData.expectedActualContext`) permanece SEPARADA da
 * conclusão de aprendizado (Seção 9 da missão: "Financial fact" ≠
 * "Learning conclusion"), que continua vindo exclusivamente do
 * julgamento humano já registrado (`Outcome.status`), como sempre.
 *
 * **`humanStatement` (Mission 186 Closure — Human Learning Statement &
 * Governance).** Corrige a leitura de D-099: "acionado por um clique
 * humano" nunca significou "a conclusão é do humano" — `title`/
 * `description` continuam SEMPRE o template determinístico por
 * `evidenceClassification` acima, nunca reescritos aqui. `humanStatement`
 * é a camada distinta, genuinamente autoral (mesmo precedente de
 * `DiagnosisReviewModification.humanStatement`) — nunca calculada,
 * sempre texto que o executivo escreveu explicitamente. **Regra
 * obrigatória (Etapa 3/22/23 da missão)**: quando `expectedActualContext`
 * está presente, um `humanStatement` não-vazio é EXIGIDO — nenhum
 * aprendizado que reivindique contexto Esperado vs. Observado formal é
 * persistido apoiado apenas no template genérico
 * (`CLASSIFICATION_DESCRIPTIONS`), que é idêntico para qualquer
 * distância financeira (prova do gap, Seção 3). Para o caminho
 * genérico (sem `expectedActualContext`), `humanStatement` permanece
 * inteiramente opcional — nenhuma mudança de comportamento para
 * Decisions comuns (Seção 15).
 */
export function buildLearningRecord(
  decision: LearningRecordInputDecision,
  outcomes: readonly Outcome[],
  financialObservations: readonly FinancialOutcomeObservation[],
  id: string,
  derivedAt: string,
  expectedActualContext?: ExpectedActualLearningContext,
  humanStatement?: string
): Result<LearningRecord, BuildLearningRecordError> {
  if (expectedActualContext && !isNonEmptyString(humanStatement)) {
    return {
      success: false,
      error: {
        code: "HUMAN_STATEMENT_REQUIRED",
        message: "Esta decisão possui contexto Esperado vs. Observado formal — escreva sua interpretação para registrar este aprendizado, o contexto financeiro sozinho não é uma conclusão.",
      },
    };
  }

  const classified = deriveEvidenceClassification(outcomes, financialObservations);
  if (!classified.success) {
    return { success: false, error: classified.error };
  }

  const { classification, confidence } = classified.value;

  const record: LearningRecord = {
    id,
    companyId: decision.companyId,
    type: "observation",
    confidence,
    title: `Aprendizado — ${decision.title}`,
    description: CLASSIFICATION_DESCRIPTIONS[classification],
    source: "historical_pattern",
    decisions: [decision.id],
    recommendations: [],
    reasonings: [],
    contexts: [],
    evidences: [],
    supportingData: expectedActualContext ? { expectedActualContext } : {},
    outcomeIds: outcomes.map((o) => o.id),
    financialObservationIds: financialObservations.map((f) => f.id),
    evidenceClassification: classification,
    ...(isNonEmptyString(humanStatement) ? { humanStatement } : {}),
    provenance: { source: "learning-derivation", confidence: { value: 100, level: "very_high" } },
    audit: { createdAt: derivedAt, updatedAt: derivedAt, version: 1 },
  };

  const validation = validateLearningRecord(record);
  if (!validation.valid) {
    return { success: false, error: { code: "INVALID_RECORD", errors: validation.errors } };
  }

  return { success: true, value: record };
}
