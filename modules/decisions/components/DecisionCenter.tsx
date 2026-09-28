import { CheckCircle2 } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { KindMarker } from "@/components/shared/KindMarker";
import { SemanticBadge } from "@/components/shared/SemanticBadge";
import { cn } from "@/lib/utils";

import { loadDecisionCenter } from "@/modules/decisions/services/decision-center.service";
import { listRecommendationReferences } from "@/efos/application/executive-diagnosis";
import { DecisionExecutionSection } from "@/modules/decisions/components/DecisionExecutionSection";
import { DiagnosisReviewSection } from "@/modules/decisions/components/DiagnosisReviewSection";
import { HumanDecisionSection } from "@/modules/decisions/components/HumanDecisionSection";
import {
  GOVERNANCE_LIFECYCLE_LABELS,
  RECOMMENDATION_CATEGORY_LABELS,
} from "@/modules/decisions/lib/governanceLabels";
import type { ExecutiveDecisionWorkItem } from "@/modules/decisions/lib/buildDecisionCenterQueue";

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
  const center = await loadDecisionCenter(companyId);
  if (!center) {
    return null;
  }
  const { diagnoses, decisions, reviewsByDiagnosis, queue } = center;

  const requiresDecision = queue.filter((item) => item.bucket === "requires-decision");
  const decided = queue.filter((item) => item.bucket === "decided");
  const concluded = queue.filter((item) => item.bucket === "concluded");

  const diagnosesRequiringAction = diagnoses.filter((diagnosis) =>
    requiresDecision.some((item) => item.diagnosisId === diagnosis.id)
  );

  // Mission 204 — a decisão como objeto principal: o ciclo inteiro
  // (aguardando → decidido/em execução → concluído) visível de uma vez,
  // depois o que exige ação agora, em passos numerados (revisar a leitura
  // da IA, registrar a decisão). Mesmos dados, mesma fila canônica e os
  // mesmos formulários — só a apresentação muda.
  const stages = [
    { label: "Aguardando decisão", count: requiresDecision.length },
    { label: "Decididas / em execução", count: decided.length },
    { label: "Concluídas", count: concluded.length },
  ];

  return (
    <div id="decision-center" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <KindMarker kind="decision" />
        <ol aria-label="Ciclo das decisões" className="grid grid-cols-3 border-y border-border">
          {stages.map((stage, index) => (
            <li key={stage.label} className={cn("flex flex-col gap-1 py-4", index > 0 && "border-l border-border pl-5")}>
              <span className="num text-[1.75rem] leading-none font-semibold tracking-tight text-foreground">{stage.count}</span>
              <span className="type-meta">{stage.label}</span>
            </li>
          ))}
        </ol>
      </div>

      <section aria-labelledby="decisao-agora-titulo" className="flex flex-col gap-4">
        <h4 id="decisao-agora-titulo" className="type-subsection-title">
          O que requer sua decisão agora
        </h4>
        {requiresDecision.length === 0 ? (
          <EmptyState
            compact
            icon={CheckCircle2}
            title="Nenhum item aguardando decisão"
            description="Toda proposta da Executive AI já foi revisada ou decidida — novos itens aparecem aqui assim que um diagnóstico executivo é gerado ou revisado."
          />
        ) : null}

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
            <div key={diagnosis.id} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <p className="type-meta">
                  Do diagnóstico de {new Date(diagnosis.createdAt).toLocaleDateString("pt-BR")} ·{" "}
                  <span className="num">{itemsForDiagnosis.length}</span>{" "}
                  {itemsForDiagnosis.length === 1 ? "item pendente" : "itens pendentes"}
                </p>
                <ul className="flex flex-col divide-y divide-border border-y border-border">
                  {itemsForDiagnosis.map((item) => (
                    <li key={item.recommendationId} className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-4 py-3">
                      <span className="type-eyebrow text-[0.625rem]">{RECOMMENDATION_CATEGORY_LABELS[item.category]}</span>
                      <span className="text-sm text-pretty text-foreground">{item.statement}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-8 xl:grid-cols-2">
                <DecisionStep number={1} title="Revisar a leitura da IA">
                  <DiagnosisReviewSection
                    companyId={companyId}
                    diagnosis={diagnosis.diagnosis}
                    history={reviewsByDiagnosis[diagnosis.id] ?? []}
                  />
                </DecisionStep>
                <DecisionStep number={2} title="Registrar a decisão">
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
                </DecisionStep>
              </div>
            </div>
          );
        })}
      </section>

      <DecisionSummaryList title="Decididas / em execução" items={decided} />
      <DecisionSummaryList title="Concluídas recentemente" items={concluded} />

      <DecisionExecutionSection companyId={companyId} decisions={decisions} />
    </div>
  );
}

function DecisionStep({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h5 className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
        <span
          aria-hidden="true"
          className="num flex size-6 items-center justify-center rounded-full bg-primary text-[0.75rem] text-primary-foreground"
        >
          {number}
        </span>
        <span>
          <span className="sr-only">Passo {number}: </span>
          {title}
        </span>
      </h5>
      {children}
    </section>
  );
}

function DecisionSummaryList({ title, items }: { title: string; items: readonly ExecutiveDecisionWorkItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <h4 className="type-subsection-title">
        {title} <span className="num font-normal text-muted-foreground">· {items.length}</span>
      </h4>
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {items.map((item) => (
          <li
            key={`${item.diagnosisId}-${item.recommendationId}`}
            className="grid grid-cols-[8rem_minmax(0,1fr)_auto] items-baseline gap-4 py-3"
          >
            <span className="type-eyebrow text-[0.625rem]">{RECOMMENDATION_CATEGORY_LABELS[item.category]}</span>
            <span className="text-sm text-foreground">{item.statement}</span>
            {item.governance.lifecycleState ? (
              <SemanticBadge tone="info">{GOVERNANCE_LIFECYCLE_LABELS[item.governance.lifecycleState]}</SemanticBadge>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
