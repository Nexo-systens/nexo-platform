import type { DecisionExecutionEvent, DecisionExecutionStatus } from "./DecisionExecutionEvent";

/**
 * Estado atual de execução de uma `Decision`, inteiramente DERIVADO da
 * sequência de eventos — nunca uma linha própria persistida (ver
 * `DecisionExecutionEvent.ts` para o racional completo do log de
 * eventos imutável). `owner`/`startedAt`/`completedAt`/`targetDate`/
 * `notes` (os campos pedidos pela Etapa 4.1 da missão) são todos
 * calculados aqui, nunca duplicados como colunas físicas.
 */
export interface DecisionExecutionState {
  readonly status: DecisionExecutionStatus;
  readonly owner: string | undefined;
  readonly startedAt: string | undefined;
  readonly completedAt: string | undefined;
  readonly targetDate: string | undefined;
  readonly notes: string | undefined;
  readonly history: readonly DecisionExecutionEvent[];
}

/**
 * Deriva o estado atual a partir de uma lista de eventos já ordenada
 * (mais recente primeiro — mesma convenção de leitura de
 * `getDiagnosisReviewsByDiagnosis()`/`getDecisionsByCompany()`, D-066).
 * Função pura — nunca consulta o banco, nunca gera timestamp.
 *
 * `owner`/`targetDate`/`notes` vêm sempre do evento mais recente (o
 * humano responsável e o horizonte podem mudar entre eventos — "quem
 * está cuidando disso agora" e "para quando" são sempre o valor mais
 * atual, nunca uma média/soma do histórico). `startedAt` é o
 * `occurredAt` do PRIMEIRO evento com status `IN_PROGRESS` já
 * observado (a execução pode voltar a `IN_PROGRESS` depois de
 * `BLOCKED`, mas o início real continua sendo a primeira vez).
 * `completedAt` só é preenchido quando o status atual é de fato
 * `COMPLETED` (nunca um `COMPLETED` histórico que foi reaberto — mas
 * como `COMPLETED`/`CANCELLED` são terminais na máquina de estados de
 * `DecisionExecutionEvent.validator.ts`, isso nunca acontece na
 * prática; a checagem aqui é apenas defensiva).
 */
export function deriveDecisionExecutionState(
  events: readonly DecisionExecutionEvent[]
): DecisionExecutionState {
  if (events.length === 0) {
    return {
      status: "NOT_STARTED",
      owner: undefined,
      startedAt: undefined,
      completedAt: undefined,
      targetDate: undefined,
      notes: undefined,
      history: [],
    };
  }

  // Mission 138 — achado real durante a validação ao vivo:
  // `String.prototype.localeCompare()` é uma comparação SENSÍVEL A
  // LOCALE (colação ICU), não uma comparação byte-a-byte — para
  // timestamps ISO 8601 com precisão fracionária inconsistente (ex.:
  // Postgres devolve "...:47+00:00" quando os milissegundos são
  // exatamente zero, mas "...:47.093+00:00" quando não são), o
  // collator pode ordenar incorretamente por tratar "+"/"." de forma
  // não-numérica. `Date.parse()` (comparação numérica real) é a única
  // forma correta de ordenar timestamps — nunca comparação de string,
  // mesmo entre strings ISO 8601 válidas.
  const chronological = [...events].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const latest = chronological[chronological.length - 1];
  const firstInProgress = chronological.find((event) => event.status === "IN_PROGRESS");

  return {
    status: latest.status,
    owner: latest.actorId,
    startedAt: firstInProgress?.occurredAt,
    completedAt: latest.status === "COMPLETED" ? latest.occurredAt : undefined,
    targetDate: latest.targetDate,
    notes: latest.notes,
    history: events,
  };
}
