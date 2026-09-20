import type { HistoricalExecution } from "@/efos/application/history";
import type { PersistedExecutiveDiagnosis } from "@/modules/decisions/services/executive-diagnosis-persistence.service";
import type { PersistedDiagnosisReview } from "@/modules/decisions/services/diagnosis-review-persistence.service";
import type { PersistedDecision } from "@/modules/decisions/services/decision-persistence.service";
import type { DecisionExecutionEvent, DecisionExecutionStatus } from "@/efos/application/decision-execution";
import type { DiagnosisReviewStatus } from "@/efos/application/diagnosis-review";
import type { Knowledge, KnowledgeCategory, LearningRecord, Outcome, OutcomeStatus } from "@/efos/domain";

/**
 * Mission 178 — Company Timeline (Knowledge Timeline). Composição pura
 * que reagrupa registros já persistidos por Missions 085/086 (execução),
 * 115/126 (diagnóstico), 123/127 (revisão), 124-127 (decisão), 138
 * (execução/outcome), 140/141 (learning/knowledge) — exatamente na
 * mesma linha de `ExecutiveFinancialContext` (D-058): "cada campo é uma
 * referência direta ou um reagrupamento raso do que já foi produzido,
 * nenhum cálculo novo". Nenhum agregado é criado aqui — apenas
 * reorganizado por data (`date`, o timestamp OPERACIONAL de cada
 * registro — `executedAt`/`createdAt`/`reviewedAt`/`occurredAt`/
 * `observedAt`/`audit.createdAt` — deliberadamente NUNCA `Period`
 * financeiro: D-088/D-090 regem qual execução é "a verdade financeira
 * atual", um problema inteiramente diferente de "quando este evento
 * ocorreu no tempo real", que é o que esta timeline responde).
 *
 * Ordenação puramente apresentacional (mais recente primeiro) — nunca
 * uma segunda fonte de verdade sobre qual é a execução/diagnóstico/
 * decisão "atual" (isso continua sendo responsabilidade exclusiva de
 * `resolveCurrentFinancialExecution()`/`ExecutiveDiagnosisSection`,
 * nunca duplicada aqui).
 */
export type TimelineEntry =
  | { readonly kind: "execution"; readonly date: string; readonly executionId: string }
  | {
      readonly kind: "diagnosis";
      readonly date: string;
      readonly diagnosisId: string;
      readonly summary: string;
    }
  | {
      readonly kind: "diagnosis-review";
      readonly date: string;
      readonly reviewId: string;
      readonly diagnosisId: string;
      readonly status: DiagnosisReviewStatus;
    }
  | {
      readonly kind: "decision";
      readonly date: string;
      readonly decisionId: string;
      readonly title: string;
    }
  | {
      readonly kind: "decision-execution-event";
      readonly date: string;
      readonly decisionId: string;
      readonly status: DecisionExecutionStatus;
    }
  | {
      readonly kind: "outcome";
      readonly date: string;
      readonly decisionId: string;
      readonly outcomeId: string;
      readonly status: OutcomeStatus;
      readonly description: string;
    }
  | {
      readonly kind: "learning-record";
      readonly date: string;
      readonly learningRecordId: string;
      readonly title: string;
    }
  | {
      readonly kind: "knowledge";
      readonly date: string;
      readonly knowledgeId: string;
      readonly category: KnowledgeCategory;
      readonly statement: string;
    };

export interface CompanyTimelineInputs {
  readonly executions: readonly HistoricalExecution[];
  readonly diagnoses: readonly PersistedExecutiveDiagnosis[];
  readonly reviewsByDiagnosis: Readonly<Record<string, readonly PersistedDiagnosisReview[]>>;
  readonly decisions: readonly PersistedDecision[];
  readonly executionEventsByDecision: Readonly<Record<string, readonly DecisionExecutionEvent[]>>;
  readonly outcomesByDecision: Readonly<Record<string, readonly Outcome[]>>;
  readonly learningRecords: readonly LearningRecord[];
  readonly knowledge: readonly Knowledge[];
}

export function buildCompanyTimeline(inputs: CompanyTimelineInputs): readonly TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const execution of inputs.executions) {
    entries.push({
      kind: "execution",
      date: execution.executedAt,
      executionId: execution.executionId,
    });
  }

  for (const diagnosis of inputs.diagnoses) {
    entries.push({
      kind: "diagnosis",
      date: diagnosis.createdAt,
      diagnosisId: diagnosis.id,
      summary: diagnosis.diagnosis.executiveSummary.statement,
    });

    for (const review of inputs.reviewsByDiagnosis[diagnosis.id] ?? []) {
      entries.push({
        kind: "diagnosis-review",
        date: review.review.reviewedAt,
        reviewId: review.id,
        diagnosisId: diagnosis.id,
        status: review.review.status,
      });
    }
  }

  for (const decision of inputs.decisions) {
    entries.push({
      kind: "decision",
      date: decision.createdAt,
      decisionId: decision.id,
      title: decision.decision.title,
    });

    for (const event of inputs.executionEventsByDecision[decision.id] ?? []) {
      entries.push({
        kind: "decision-execution-event",
        date: event.occurredAt,
        decisionId: decision.id,
        status: event.status,
      });
    }

    for (const outcome of inputs.outcomesByDecision[decision.id] ?? []) {
      entries.push({
        kind: "outcome",
        date: outcome.observedAt,
        decisionId: decision.id,
        outcomeId: outcome.id,
        status: outcome.status,
        description: outcome.description,
      });
    }
  }

  for (const record of inputs.learningRecords) {
    entries.push({
      kind: "learning-record",
      date: record.audit.createdAt,
      learningRecordId: record.id,
      title: record.title,
    });
  }

  for (const knowledgeRecord of inputs.knowledge) {
    entries.push({
      kind: "knowledge",
      date: knowledgeRecord.audit.createdAt,
      knowledgeId: knowledgeRecord.id,
      category: knowledgeRecord.category,
      statement: knowledgeRecord.statement,
    });
  }

  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}
