import type { DecisionExecutionStatus } from "@/efos/application/decision-execution";
import type { DiagnosisReviewStatus } from "@/efos/application/diagnosis-review";
import type { OutcomeStatus } from "@/efos/domain";
import type { TimelineEntry } from "./buildCompanyTimeline";

/**
 * Mission 178 — mesma disciplina de `modules/analysis/lib/executive-language.ts`
 * (Mission 177): canônico → linguagem executiva, nunca o inverso, nunca
 * um cálculo/reclassificação novo aqui.
 */

const KIND_LABEL: Record<TimelineEntry["kind"], string> = {
  execution: "Análise executada",
  diagnosis: "Diagnóstico executivo gerado",
  "diagnosis-review": "Diagnóstico revisado",
  decision: "Decisão registrada",
  "decision-execution-event": "Execução da decisão atualizada",
  outcome: "Resultado observado",
  "learning-record": "Aprendizado registrado",
  knowledge: "Conhecimento formado",
};

export function translateTimelineKind(kind: TimelineEntry["kind"]): string {
  return KIND_LABEL[kind];
}

const DIAGNOSIS_REVIEW_STATUS_LABEL: Record<DiagnosisReviewStatus, string> = {
  PENDING: "Aguardando revisão",
  ACCEPTED: "Aceito integralmente",
  PARTIALLY_ACCEPTED: "Aceito parcialmente",
  REJECTED: "Rejeitado",
  SUPERSEDED: "Substituído por revisão posterior",
};

export function translateDiagnosisReviewStatus(status: DiagnosisReviewStatus): string {
  return DIAGNOSIS_REVIEW_STATUS_LABEL[status];
}

const DECISION_EXECUTION_STATUS_LABEL: Record<DecisionExecutionStatus, string> = {
  NOT_STARTED: "Não iniciada",
  IN_PROGRESS: "Em andamento",
  BLOCKED: "Bloqueada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

export function translateDecisionExecutionStatus(status: DecisionExecutionStatus): string {
  return DECISION_EXECUTION_STATUS_LABEL[status];
}

const OUTCOME_STATUS_LABEL: Record<OutcomeStatus, string> = {
  pending: "Pendente",
  positive: "Positivo",
  negative: "Negativo",
  neutral: "Neutro",
  inconclusive: "Inconclusivo",
};

export function translateOutcomeStatus(status: OutcomeStatus): string {
  return OUTCOME_STATUS_LABEL[status];
}

/** Mesma convenção pt-BR de `formatExecutedAt()`/`formatPeriod()` (Missions 085/177) — apenas formatação, nunca interpretação de data. */
export function formatTimelineDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
