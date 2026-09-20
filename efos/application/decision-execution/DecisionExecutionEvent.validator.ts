import {
  DECISION_EXECUTION_STATUSES,
  type DecisionExecutionEvent,
  type DecisionExecutionStatus,
} from "./DecisionExecutionEvent";

export interface DecisionExecutionEventValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function isNonEmptyString(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Máquina de estados mínima (Etapa 18.D da missão — "Transition
 * inválida é rejeitada, caso exista máquina de estados"). `undefined`
 * como chave representa a ausência de qualquer evento anterior — o
 * estado implícito `NOT_STARTED` (nunca uma linha persistida, ver
 * `DecisionExecutionEvent.ts`). `COMPLETED`/`CANCELLED` são terminais:
 * nenhuma transição sai deles — uma vez concluída ou cancelada, a
 * execução não reabre (Etapa 18.J — "Decision não vira COMPLETED
 * automaticamente" tem como contrapartida direta "nem qualquer outro
 * estado muda depois de COMPLETED/CANCELLED", pela mesma razão:
 * nenhuma mudança de estado acontece implicitamente).
 * `IN_PROGRESS`/`BLOCKED` permitem auto-transição (`X → X`) — um
 * humano pode reafirmar o mesmo status só para atualizar
 * `targetDate`/`notes`, sem que isso represente uma mudança de
 * progresso real.
 */
const ALLOWED_TRANSITIONS: Record<DecisionExecutionStatus | "NONE", readonly DecisionExecutionStatus[]> = {
  NONE: ["IN_PROGRESS", "CANCELLED"],
  NOT_STARTED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"],
  BLOCKED: ["BLOCKED", "IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Valida um `DecisionExecutionEvent` novo contra sua forma mínima e
 * contra o estado anterior real da mesma `Decision` (`previousStatus`
 * — `undefined` quando nenhum evento existe ainda, o caso
 * `NOT_STARTED` implícito). Função pura, nunca lança exceção — mesmo
 * padrão de `validateDiagnosisReview()`.
 */
export function validateDecisionExecutionEvent(
  event: DecisionExecutionEvent,
  previousStatus: DecisionExecutionStatus | undefined
): DecisionExecutionEventValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyString(event.id)) {
    errors.push("DecisionExecutionEvent.id é obrigatório.");
  }
  if (!isNonEmptyString(event.decisionId)) {
    errors.push("DecisionExecutionEvent.decisionId é obrigatório — todo evento precisa apontar para uma Decision real.");
  }
  if (!isNonEmptyString(event.companyId)) {
    errors.push("DecisionExecutionEvent.companyId é obrigatório.");
  }
  if (!isNonEmptyString(event.actorId)) {
    errors.push("DecisionExecutionEvent.actorId é obrigatório — nenhum evento de execução pode ser anônimo.");
  }
  if (!isNonEmptyString(event.occurredAt)) {
    errors.push("DecisionExecutionEvent.occurredAt é obrigatório.");
  }

  if (!DECISION_EXECUTION_STATUSES.includes(event.status)) {
    errors.push(`status desconhecido: "${event.status}".`);
    return { valid: false, errors };
  }

  if (event.status === "NOT_STARTED") {
    errors.push('status "NOT_STARTED" nunca deve existir como um DecisionExecutionEvent real — "ainda não iniciada" é representado pela AUSÊNCIA de qualquer evento, não por um evento com este status.');
    return { valid: false, errors };
  }

  const fromKey = previousStatus ?? "NONE";
  const allowed = ALLOWED_TRANSITIONS[fromKey];
  if (!allowed.includes(event.status)) {
    errors.push(
      `transição inválida: de "${previousStatus ?? "NOT_STARTED (nenhum evento ainda)"}" para "${event.status}" não é permitida. Transições válidas a partir daí: ${allowed.length > 0 ? allowed.join(", ") : "nenhuma — estado terminal"}.`
    );
  }

  return { valid: errors.length === 0, errors };
}
