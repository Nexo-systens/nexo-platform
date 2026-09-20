import type { Outcome, OutcomeStatus } from "@/efos/domain";
import { validateOutcome } from "@/efos/application/decision-execution/Outcome.validator";
import type { Result } from "@/efos/application/shared";

export interface BuildOutcomeInput {
  readonly decisionId: string;
  readonly companyId: string;
  readonly status: OutcomeStatus;
  readonly observedAt: string;
  readonly description: string;
  readonly expectedResult?: string;
}

export interface BuildOutcomeError {
  readonly code: "INVALID_OUTCOME";
  readonly errors: readonly string[];
}

/**
 * Composição pura de um `Outcome` (`efos/domain/entities/Outcome.ts`,
 * D-011) — mesmo padrão de `buildDiagnosisReview()`/
 * `buildDecisionExecutionEvent()`: `id`/`recordedAt` sempre recebidos
 * como parâmetro, nunca gerados aqui. `Outcome` é um `DomainEntity`
 * (exige `provenance`/`audit`, ao contrário de `DiagnosisReview`/
 * `DecisionExecutionEvent`, que são tipos de Application Layer sem
 * esses campos) — `provenance.source: "human-outcome"` e
 * `confidence: {value: 100, level: "very_high"}` seguem o mesmo
 * precedente de `createHumanDecision()` (Mission 124): um dado humano
 * observado diretamente, nunca inferido, recebe a confiança máxima do
 * vocabulário do Domain.
 *
 * **Nunca chamado pela IA** — nenhum código em
 * `efos/infrastructure/executive-ai/` importa esta função; um
 * `Outcome` só existe a partir de um ato humano explícito via Server
 * Action.
 */
export function buildOutcome(
  input: BuildOutcomeInput,
  recordedBy: string,
  id: string,
  recordedAt: string
): Result<Outcome, BuildOutcomeError> {
  const outcome: Outcome = {
    id,
    companyId: input.companyId,
    decisionId: input.decisionId,
    status: input.status,
    observedAt: input.observedAt,
    description: input.description,
    expectedResult: input.expectedResult,
    recordedBy,
    provenance: { source: "human-outcome", confidence: { value: 100, level: "very_high" } },
    audit: { createdAt: recordedAt, updatedAt: recordedAt, version: 1 },
  };

  const validation = validateOutcome(outcome);
  if (!validation.valid) {
    return { success: false, error: { code: "INVALID_OUTCOME", errors: validation.errors } };
  }

  return { success: true, value: outcome };
}
