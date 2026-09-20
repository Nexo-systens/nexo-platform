import type {
  DecisionExecutionEvent,
  DecisionExecutionStatus,
} from "@/efos/application/decision-execution/DecisionExecutionEvent";
import { validateDecisionExecutionEvent } from "@/efos/application/decision-execution/DecisionExecutionEvent.validator";
import type { Result } from "@/efos/application/shared";

export interface BuildDecisionExecutionEventInput {
  readonly decisionId: string;
  readonly companyId: string;
  readonly status: DecisionExecutionStatus;
  readonly targetDate?: string;
  readonly notes?: string;
}

export interface BuildDecisionExecutionEventError {
  readonly code: "INVALID_EVENT";
  readonly errors: readonly string[];
}

/**
 * Composição pura de um `DecisionExecutionEvent` (Mission 138) —
 * separada da Server Action (`modules/decisions/actions/decision-execution.actions.ts`)
 * exatamente como `buildDiagnosisReview()` já é pura e separada
 * (Mission 125): `actorId` é sempre recebido como parâmetro já
 * resolvido, nunca lido de sessão aqui. `id`/`occurredAt` também são
 * sempre parâmetros — função determinística, nunca gera
 * `randomUUID()`/`Date.now()` internamente. `previousStatus` é sempre
 * o status derivado do histórico REAL já persistido (nunca confiado a
 * partir do client) — quem chama esta função é responsável por já ter
 * consultado `deriveDecisionExecutionState()` sobre os eventos reais
 * antes de chamar.
 */
export function buildDecisionExecutionEvent(
  input: BuildDecisionExecutionEventInput,
  actorId: string,
  id: string,
  occurredAt: string,
  previousStatus: DecisionExecutionStatus | undefined
): Result<DecisionExecutionEvent, BuildDecisionExecutionEventError> {
  const event: DecisionExecutionEvent = {
    id,
    decisionId: input.decisionId,
    companyId: input.companyId,
    status: input.status,
    actorId,
    occurredAt,
    targetDate: input.targetDate,
    notes: input.notes,
  };

  const validation = validateDecisionExecutionEvent(event, previousStatus);
  if (!validation.valid) {
    return { success: false, error: { code: "INVALID_EVENT", errors: validation.errors } };
  }

  return { success: true, value: event };
}
