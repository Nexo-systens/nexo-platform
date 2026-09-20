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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function entryDescription(entry: TimelineEntry): string | undefined {
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
    case "execution":
      return undefined;
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
export async function CompanyTimeline({ companyId }: { companyId: string }) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linha do Tempo</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 && (
          <EmptyState
            icon={History}
            title="Nenhum evento registrado ainda"
            description="A linha do tempo reúne análises, diagnósticos, decisões, resultados e conhecimento formado ao longo da vida desta empresa na NEXO — execute a primeira análise para começar."
          />
        )}

        {entries.length > 0 && (
          <ol className="flex flex-col gap-3">
            {entries.map((entry, index) => {
              const Icon = KIND_ICON[entry.kind];
              const description = entryDescription(entry);
              return (
                <li
                  key={`${entry.kind}-${index}`}
                  className="flex gap-3 rounded-md border border-border p-3"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="flex flex-1 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {translateTimelineKind(entry.kind)}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                        {formatTimelineDate(entry.date)}
                      </Badge>
                    </div>
                    {description && (
                      <p className="text-sm text-muted-foreground">{description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
