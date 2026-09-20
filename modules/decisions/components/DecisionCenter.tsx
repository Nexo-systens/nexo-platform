import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { CheckCircle2 } from "lucide-react";

import { getExecutiveDiagnosesByCompany } from "@/modules/decisions/services/executive-diagnosis-persistence.service";
import { getDiagnosisReviewsByDiagnosis } from "@/modules/decisions/services/diagnosis-review-persistence.service";
import { getDecisionsByCompany } from "@/modules/decisions/services/decision-persistence.service";
import {
  getDecisionExecutionEventsByDecision,
  getOutcomesByDecision,
} from "@/modules/decisions/services/decision-execution-persistence.service";
import { getFinancialObservationsByDecision } from "@/modules/decisions/services/financial-observation-persistence.service";
import { getLearningRecordsByCompany } from "@/modules/decisions/services/learning-record-persistence.service";
import { getKnowledgeByCompany } from "@/modules/decisions/services/knowledge-persistence.service";
import { listRecommendationReferences } from "@/efos/application/executive-diagnosis";
import { DecisionExecutionSection } from "@/modules/decisions/components/DecisionExecutionSection";
import { DiagnosisReviewSection } from "@/modules/decisions/components/DiagnosisReviewSection";
import { HumanDecisionSection } from "@/modules/decisions/components/HumanDecisionSection";
import {
  GOVERNANCE_LIFECYCLE_LABELS,
  RECOMMENDATION_CATEGORY_LABELS,
} from "@/modules/decisions/lib/governanceLabels";
import { buildDecisionCenterQueue, type ExecutiveDecisionWorkItem } from "@/modules/decisions/lib/buildDecisionCenterQueue";

/**
 * Mission 179 — Executive Decision Center. Responde às 3 perguntas
 * executivas da missão (Seção 4): "O que requer minha decisão?"
 * (primária — fila abaixo), "O que eu já decidi?" (resumo compacto) e
 * "O que aconteceu depois da decisão?" (delegado integralmente a
 * `DecisionExecutionSection`, já existente desde a Mission 138 — nunca
 * duplicado aqui).
 *
 * **Substitui, dentro de `ExecutiveDiagnosisSection`, a composição que
 * antes cobria exclusivamente `diagnoses[0]`** — auditoria desta missão
 * (ver `buildDecisionCenterQueue.ts`) provou que nada em
 * `deriveRecommendationGovernanceState()`/`deriveRecommendationOutcomeReconciliation()`/
 * `listRecommendationReferences()` exige "apenas o diagnóstico mais
 * recente"; a Mission 178 classificou isso como ARCHITECTURALLY_BLOCKED
 * incorretamente — era uma escolha de composição, não um limite de
 * arquitetura. Esta correção é feita AQUI, generalizando para TODOS os
 * diagnósticos da empresa, reaproveitando as mesmas 3 funções puras
 * sem alteração.
 *
 * Ações reais continuam exclusivamente através de `DiagnosisReviewSection`/
 * `HumanDecisionSection` (Missions 123/127/150-155, zero alteração de
 * comportamento) — um par por diagnóstico que ainda tem item pendente,
 * nunca um formulário novo, nunca uma segunda Server Action.
 *
 * **Correção real da Mission 184 (Scenario-to-Decision Governance
 * Bridge, Seção 22/39)**: o gate de vazio original só considerava
 * `diagnoses.length === 0` — mas, desde a Mission 184, uma `Decision`
 * humana pode existir sem NENHUM diagnóstico (origem em Scenario Lab,
 * `createScenarioDecisionAction()`, precedente estrutural já válido
 * desde a Mission 124/150 para decisões "Cenário F"). Sem esta
 * correção, `DecisionCenter` nunca era sequer MONTADA por
 * `ExecutiveDiagnosisSection` para uma empresa sem diagnóstico algum
 * (ver aquele arquivo) — uma Decision originada de cenário seria
 * criada com sucesso mas nunca apareceria em lugar nenhum da
 * governança, violando diretamente "Decision Center recognizes
 * scenario-backed decisions" (Completion Criteria da missão). Corrigido
 * buscando `decisions` ANTES do gate e incluindo-a na condição — para
 * qualquer empresa que já tinha zero diagnósticos E zero decisões
 * (o único caso possível antes da Mission 184), o comportamento
 * permanece byte a byte idêntico (`null`).
 */
export async function DecisionCenter({ companyId }: { companyId: string }) {
  const [diagnoses, decisions] = await Promise.all([
    getExecutiveDiagnosesByCompany(companyId),
    getDecisionsByCompany(companyId),
  ]);

  if (diagnoses.length === 0 && decisions.length === 0) {
    return null;
  }

  const [reviewsPerDiagnosis, learningRecords, knowledgeRecords] = await Promise.all([
    Promise.all(diagnoses.map((diagnosis) => getDiagnosisReviewsByDiagnosis(diagnosis.id))),
    getLearningRecordsByCompany(companyId),
    getKnowledgeByCompany(companyId),
  ]);
  const reviewsByDiagnosis = Object.fromEntries(
    diagnoses.map((diagnosis, index) => [diagnosis.id, reviewsPerDiagnosis[index]])
  );

  const [executionEventsByDecision, outcomesByDecision, financialObservationsByDecision] = await Promise.all([
    Promise.all(decisions.map((decision) => getDecisionExecutionEventsByDecision(decision.id))),
    Promise.all(decisions.map((decision) => getOutcomesByDecision(decision.id))),
    Promise.all(decisions.map((decision) => getFinancialObservationsByDecision(decision.id))),
  ]);
  const allExecutionEvents = executionEventsByDecision.flat();
  const allOutcomes = outcomesByDecision.flat();
  const allFinancialObservations = financialObservationsByDecision.flat();

  const queue = buildDecisionCenterQueue({
    companyId,
    diagnoses,
    reviewsByDiagnosis,
    decisions,
    executionEvents: allExecutionEvents,
    outcomes: allOutcomes,
    learningRecords,
    knowledgeRecords,
    financialObservations: allFinancialObservations,
  });

  const requiresDecision = queue.filter((item) => item.bucket === "requires-decision");
  const decided = queue.filter((item) => item.bucket === "decided");
  const concluded = queue.filter((item) => item.bucket === "concluded");

  const diagnosesRequiringAction = diagnoses.filter((diagnosis) =>
    requiresDecision.some((item) => item.diagnosisId === diagnosis.id)
  );

  return (
    <div id="decision-center" className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">Central de Decisões</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que requer decisão agora</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {requiresDecision.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nenhum item aguardando decisão"
              description="Toda proposta da Executive AI já foi revisada ou decidida — novos itens aparecem aqui assim que um diagnóstico executivo é gerado ou revisado."
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              {requiresDecision.length} {requiresDecision.length === 1 ? "item aguarda" : "itens aguardam"} revisão ou decisão, entre {diagnosesRequiringAction.length}{" "}
              {diagnosesRequiringAction.length === 1 ? "diagnóstico" : "diagnósticos"}.
            </p>
          )}

          {diagnosesRequiringAction.map((diagnosis) => {
            const itemsForDiagnosis = requiresDecision.filter((item) => item.diagnosisId === diagnosis.id);
            const review = reviewsByDiagnosis[diagnosis.id]?.[0];
            const relatedDecisions = decisions.filter((decision) => decision.diagnosisId === diagnosis.id);
            const governanceByRecommendationId = new Map(
              queue
                .filter((item) => item.diagnosisId === diagnosis.id)
                .map((item) => [item.recommendationId, item.governance] as const)
            );
            const reconciliationByRecommendationId = new Map(
              queue
                .filter((item) => item.diagnosisId === diagnosis.id)
                .map((item) => [item.recommendationId, item.reconciliation] as const)
            );

            return (
              <div key={diagnosis.id} className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Diagnóstico de {new Date(diagnosis.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {itemsForDiagnosis.length} {itemsForDiagnosis.length === 1 ? "item pendente" : "itens pendentes"}
                  </Badge>
                </div>
                <ul className="flex flex-col gap-1">
                  {itemsForDiagnosis.map((item) => (
                    <li key={item.recommendationId} className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-[10px]">
                        {RECOMMENDATION_CATEGORY_LABELS[item.category]}
                      </Badge>
                      <span className="text-foreground">{item.statement}</span>
                    </li>
                  ))}
                </ul>
                <DiagnosisReviewSection
                  companyId={companyId}
                  diagnosis={diagnosis.diagnosis}
                  history={reviewsByDiagnosis[diagnosis.id] ?? []}
                />
                <HumanDecisionSection
                  companyId={companyId}
                  diagnosisId={diagnosis.id}
                  reviewId={review?.id}
                  recommendationOptions={listRecommendationReferences(diagnosis.diagnosis)}
                  latestReview={review?.review}
                  governanceByRecommendationId={governanceByRecommendationId}
                  reconciliationByRecommendationId={reconciliationByRecommendationId}
                  history={relatedDecisions}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <DecisionSummaryCard title="Já decididas / em execução" items={decided} emptyMessage="Nenhuma recomendação decidida ainda." />
      <DecisionSummaryCard title="Concluídas recentemente" items={concluded} emptyMessage="Nenhum ciclo concluído ainda." />

      <DecisionExecutionSection companyId={companyId} decisions={decisions} />
    </div>
  );
}

function DecisionSummaryCard({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: readonly ExecutiveDecisionWorkItem[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={`${item.diagnosisId}-${item.recommendationId}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {RECOMMENDATION_CATEGORY_LABELS[item.category]}
                  </Badge>
                  <span className="text-foreground">{item.statement}</span>
                </div>
                {item.governance.lifecycleState && (
                  <Badge variant="secondary" className="text-[10px]">
                    {GOVERNANCE_LIFECYCLE_LABELS[item.governance.lifecycleState]}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
