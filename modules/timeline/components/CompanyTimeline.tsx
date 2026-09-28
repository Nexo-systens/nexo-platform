import {
  BookOpen,
  CheckCircle2,
  FileText,
  Gavel,
  History,
  Lightbulb,
  PlayCircle,
  Target,
} from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import Link from "next/link";

import { reportPeriod } from "@/modules/analysis/lib/executive-situation";
import { formatPeriodLabel } from "@/modules/analysis/lib/period-label";
import { createClient } from "@/lib/supabase/server";
import { SupabaseExecutionRepository } from "@/efos/infrastructure/repositories";
import { SupabasePersistenceClient } from "@/efos/infrastructure/providers";
import { DefaultHistoricalExecutionService } from "@/efos/application/history";
import { getExecutiveDiagnosesByCompany } from "@/modules/decisions/services/executive-diagnosis-persistence.service";
import { getDiagnosisReviewsByDiagnosis } from "@/modules/decisions/services/diagnosis-review-persistence.service";
import { getDecisionsByCompany } from "@/modules/decisions/services/decision-persistence.service";
import {
  getDecisionExecutionEventsByDecision,
  getOutcomesByDecision,
} from "@/modules/decisions/services/decision-execution-persistence.service";
import { getLearningRecordsByCompany } from "@/modules/decisions/services/learning-record-persistence.service";
import { getKnowledgeByCompany } from "@/modules/decisions/services/knowledge-persistence.service";
import { KNOWLEDGE_CATEGORY_LABELS } from "@/modules/decisions/lib/knowledgeLabels";

import { buildCompanyTimeline, type TimelineEntry } from "@/modules/timeline/lib/buildCompanyTimeline";
import {
  formatTimelineDate,
  translateDecisionExecutionStatus,
  translateDiagnosisReviewStatus,
  translateOutcomeStatus,
  translateTimelineKind,
} from "@/modules/timeline/lib/timeline-language";

const KIND_ICON: Record<TimelineEntry["kind"], typeof FileText> = {
  execution: FileText,
  diagnosis: History,
  "diagnosis-review": CheckCircle2,
  decision: Gavel,
  "decision-execution-event": PlayCircle,
  outcome: Target,
  "learning-record": BookOpen,
  knowledge: Lightbulb,
};

function entryDescription(entry: TimelineEntry, periodByExecution: ReadonlyMap<string, string>): string | undefined {
  switch (entry.kind) {
    case "diagnosis":
      return entry.summary;
    case "diagnosis-review":
      return translateDiagnosisReviewStatus(entry.status);
    case "decision":
      return entry.title;
    case "decision-execution-event":
      return translateDecisionExecutionStatus(entry.status);
    case "outcome":
      return `${translateOutcomeStatus(entry.status)} — ${entry.description}`;
    case "learning-record":
      return entry.title;
    case "knowledge":
      return `${KNOWLEDGE_CATEGORY_LABELS[entry.category] ?? entry.category}: ${entry.statement}`;
    case "execution": {
      // Mission 204 — qual período a análise leu (mesmo dado dos indicadores dela).
      const period = periodByExecution.get(entry.executionId);
      return period ? `Período analisado: ${period}` : undefined;
    }
  }
}

/**
 * Mission 178 — Company Timeline (Knowledge Timeline, uma das 5
 * experiências canônicas de `docs/03_PRODUCT/01_PRODUCT VISION.md`:
 * "Histórico da evolução da empresa e das decisões tomadas").
 *
 * Server Component read-only — nunca uma superfície de ação nova:
 * qualquer decisão/revisão/execução real continua acontecendo
 * exclusivamente em `ExecutiveDiagnosisSection` (governança do
 * diagnóstico MAIS RECENTE, Missions 122-155, nunca reconstruída aqui).
 * Esta timeline apenas reagrupa, cronologicamente, tudo que já
 * aconteceu — incluindo diagnósticos/decisões de execuções ANTERIORES,
 * que `ExecutiveDiagnosisSection` estruturalmente nunca mostra (só
 * `diagnoses[0]`).
 *
 * Mesmo padrão de busca em paralelo já usado por
 * `ExecutiveDiagnosisSection` — nenhuma consulta nova, apenas as já
 * existentes (`getDecisionsByCompany`/`getLearningRecordsByCompany`/
 * `getKnowledgeByCompany`/etc.), companyId já autorizado pela página
 * (`getCompanyById()`, RLS).
 */
export async function CompanyTimeline({
  companyId,
  limit,
  moreHref,
}: {
  companyId: string;
  /** Mostra só os N eventos mais recentes (visão geral). */
  limit?: number;
  moreHref?: string;
}) {
  const supabaseClient = await createClient();
  const persistenceClient = new SupabasePersistenceClient(supabaseClient);
  const executionRepository = new SupabaseExecutionRepository(persistenceClient);
  const historicalExecutionService = new DefaultHistoricalExecutionService(executionRepository);

  const [executions, diagnoses, decisions, learningRecords, knowledge] = await Promise.all([
    historicalExecutionService.getHistory(companyId),
    getExecutiveDiagnosesByCompany(companyId),
    getDecisionsByCompany(companyId),
    getLearningRecordsByCompany(companyId),
    getKnowledgeByCompany(companyId),
  ]);

  const [reviewsPerDiagnosis, executionEventsPerDecision, outcomesPerDecision] = await Promise.all([
    Promise.all(diagnoses.map((diagnosis) => getDiagnosisReviewsByDiagnosis(diagnosis.id))),
    Promise.all(decisions.map((decision) => getDecisionExecutionEventsByDecision(decision.id))),
    Promise.all(decisions.map((decision) => getOutcomesByDecision(decision.id))),
  ]);

  const reviewsByDiagnosis = Object.fromEntries(
    diagnoses.map((diagnosis, index) => [diagnosis.id, reviewsPerDiagnosis[index]])
  );
  const executionEventsByDecision = Object.fromEntries(
    decisions.map((decision, index) => [decision.id, executionEventsPerDecision[index]])
  );
  const outcomesByDecision = Object.fromEntries(
    decisions.map((decision, index) => [decision.id, outcomesPerDecision[index]])
  );

  const entries = buildCompanyTimeline({
    executions,
    diagnoses,
    reviewsByDiagnosis,
    decisions,
    executionEventsByDecision,
    outcomesByDecision,
    learningRecords,
    knowledge,
  });

  const periodByExecution = new Map(
    executions.flatMap((execution) => {
      const period = reportPeriod(execution.report);
      return period ? [[execution.executionId, formatPeriodLabel(period).long] as const] : [];
    })
  );
  const visible = limit ? entries.slice(0, limit) : entries;

  if (entries.length === 0) {
    return (
      <EmptyState
        compact
        icon={History}
        title="Nenhum evento registrado ainda"
        description="A linha do tempo reúne análises, diagnósticos, decisões, resultados e conhecimento formado ao longo da vida desta empresa na NEXO — execute a primeira análise para começar."
      />
    );
  }

  // Mission 204 — linha do tempo de verdade (trilho vertical e marcos),
  // sem uma caixa por evento; data em coluna própria, mais recente primeiro.
  return (
    <div className="flex flex-col gap-3">
      <ol className="relative flex flex-col">
        {visible.map((entry, index) => {
          const Icon = KIND_ICON[entry.kind];
          const description = entryDescription(entry, periodByExecution);
          const last = index === visible.length - 1;
          return (
            <li key={`${entry.kind}-${index}`} className="grid grid-cols-[7.5rem_1.75rem_minmax(0,1fr)] gap-x-3">
              <time dateTime={entry.date} className="num pt-1 text-right type-meta">
                {formatTimelineDate(entry.date)}
              </time>
              <span className="relative flex justify-center">
                {!last && <span aria-hidden="true" className="absolute top-7 bottom-0 w-px bg-border" />}
                <span className="relative mt-0.5 flex size-6 items-center justify-center rounded-full border border-border bg-surface">
                  <Icon className="size-3.5 text-foreground-secondary" aria-hidden="true" />
                </span>
              </span>
              <div className={last ? "pb-1" : "pb-5"}>
                <p className="text-sm font-medium text-foreground">{translateTimelineKind(entry.kind)}</p>
                {description && <p className="type-body mt-0.5 line-clamp-2 text-pretty">{description}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {moreHref && entries.length > visible.length && (
        <Link href={moreHref} className="self-start text-[0.8125rem] font-medium text-primary underline-offset-4 hover:underline">
          Ver os {entries.length} eventos
        </Link>
      )}
    </div>
  );
}
