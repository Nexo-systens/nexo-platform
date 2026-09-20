"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DECISION_TYPES,
  RECOMMENDATION_CONFIDENCE_LEVELS,
  RECOMMENDATION_PRIORITIES,
  type DecisionType,
  type RecommendationConfidence,
  type RecommendationPriority,
} from "@/efos/domain";
import { createHumanDecisionAction } from "@/modules/decisions/actions/human-review.actions";
import type { PersistedDecision } from "@/modules/decisions/services/decision-persistence.service";
import type { RecommendationReferenceTrace } from "@/efos/application/executive-diagnosis";
import { resolveRecommendationReviewStatus, type DiagnosisReview } from "@/efos/application/diagnosis-review";
import type { RecommendationGovernanceState } from "@/efos/application/recommendation-governance";
import type { RecommendationOutcomeReconciliation } from "@/efos/application/recommendation-outcome-reconciliation";
import {
  DECISION_CONFIDENCE_LABELS as CONFIDENCE_LABELS,
  DECISION_PRIORITY_LABELS as PRIORITY_LABELS,
  DECISION_TYPE_LABELS as TYPE_LABELS,
  GOVERNANCE_LIFECYCLE_LABELS,
  RECOMMENDATION_CATEGORY_LABELS,
  RECOMMENDATION_REVIEW_VERDICT_LABELS as REVIEW_STATUS_LABELS,
  RECONCILIATION_STATE_LABELS,
} from "@/modules/decisions/lib/governanceLabels";

const OUTCOME_STATUS_LABELS: Record<string, string> = {
  pending: "pendente",
  positive: "positivo",
  negative: "negativo",
  neutral: "neutro",
  inconclusive: "inconclusivo",
};

const EXECUTION_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "não iniciada",
  IN_PROGRESS: "em andamento",
  BLOCKED: "bloqueada",
  COMPLETED: "concluída",
  CANCELLED: "cancelada",
};

/**
 * Mission 127, Etapa 6 — Human Decision Interface. Ação **explícita e
 * separada** da revisão (Etapa 7 — "Anti-automação": aceitar um
 * diagnóstico nunca cria uma Decision sozinho) — o humano só produz
 * uma `Decision` clicando neste botão, sempre preenchendo `title`/
 * `description`/`rationale` com suas próprias palavras.
 *
 * `diagnosisId`/`reviewId` são opcionais e desmarcáveis
 * (`linkToDiagnosis`) — uma Decision pode divergir completamente da
 * IA ou existir sem nenhum diagnóstico (Cenário F/K, Missions
 * 124/125/126), nunca bloqueada por causa disso.
 * `humanActorId` nunca aparece neste formulário — resolvido no
 * servidor (`createHumanDecisionAction`, D-065).
 *
 * Mission 137, Etapa 3 — `router.refresh()` após sucesso (mesmo padrão
 * de `ExecutiveDiagnosisActivation`/`DiagnosisReviewSection`): sem ele,
 * `history` continuaria mostrando a lista antiga até uma navegação
 * manual, apesar de `revalidatePath()` já rodar no servidor. Corrigido
 * nesta missão (achado real de auditoria, não hipotético).
 */
export function HumanDecisionSection({
  companyId,
  diagnosisId,
  reviewId,
  recommendationOptions = [],
  latestReview,
  governanceByRecommendationId,
  reconciliationByRecommendationId,
  history,
}: {
  companyId: string;
  diagnosisId?: string;
  reviewId?: string;
  /**
   * Mission 150 — Executive Recommendation → Human Decision
   * Traceability (D-082). Itens reais do `ExecutiveDiagnosis` atual
   * (`listRecommendationReferences()`), nunca uma lista inventada —
   * permite ao humano vincular explicitamente esta `Decision` a uma
   * Recommendation específica da IA, sempre opcional (Etapa 4 da
   * missão: "Recommendation X → Human Decision Y" sem vínculo
   * específico continua completamente válido).
   */
  recommendationOptions?: readonly RecommendationReferenceTrace[];
  /**
   * Mission 152 — Production Recommendation-to-Decision Learning Loop
   * (Etapa 2/20). O `DiagnosisReview` mais recente real, quando
   * existir — usado apenas para anotar cada opção do seletor com o
   * veredito humano já registrado (aceita/rejeitada/modificada),
   * nunca para bloquear nenhuma opção.
   */
  latestReview?: DiagnosisReview;
  /**
   * Mission 154 — Executive Recommendation Governance & Decision
   * Readiness (Etapa 21). Ciclo de vida real de cada item citável,
   * pré-computado no servidor (`deriveRecommendationGovernanceState()`)
   * — mostrado apenas para a Recommendation atualmente selecionada no
   * seletor, nunca uma tela nova, nunca recomputado no client.
   */
  governanceByRecommendationId?: ReadonlyMap<string, RecommendationGovernanceState>;
  /**
   * Mission 155 — Recommendation vs Outcome Reconciliation (Etapa 23).
   * Reconciliação real de cada item citável, pré-computada no servidor
   * (`deriveRecommendationOutcomeReconciliation()`, consumindo a
   * governança acima como precondição) — mostrada junto do bloco
   * "Governança", nunca uma tela nova, nunca um veredito de sucesso/
   * fracasso.
   */
  reconciliationByRecommendationId?: ReadonlyMap<string, RecommendationOutcomeReconciliation>;
  history: readonly PersistedDecision[];
}) {
  const router = useRouter();
  const [linkToDiagnosis, setLinkToDiagnosis] = useState(Boolean(diagnosisId));
  const [recommendationId, setRecommendationId] = useState<string>("");
  const [type, setType] = useState<DecisionType | "">("");
  const [priority, setPriority] = useState<RecommendationPriority | "">("");
  const [confidence, setConfidence] = useState<RecommendationConfidence | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [errors, setErrors] = useState<readonly string[] | undefined>();
  const [success, setSuccess] = useState(false);
  /**
   * Mission 153 — First Real Recommendation-Backed Decision & Production
   * Workflow Validation (Etapa 8). `submitting` (state) só reflete uma
   * mudança real de UI depois que React re-renderiza — um segundo clique
   * disparado antes desse re-render ainda vê `submitting = false` no
   * closure do handler antigo, e o guard `if (submitting) return`
   * sozinho não bloqueia essa corrida. Este ref é lido/escrito de forma
   * síncrona, imune a timing de re-render — garante no máximo uma
   * chamada de `createHumanDecisionAction()` em voo por vez, sem alterar
   * o modelo append-only (nunca transforma duas decisões humanas
   * legítimas, feitas em momentos distintos, em uma só — apenas
   * descarta um segundo clique disparado enquanto o primeiro ainda está
   * em voo).
   */
  const submittingRef = useRef(false);

  /**
   * Mission 153 — First Real Recommendation-Backed Decision & Production
   * Workflow Validation (Etapa 21). Resolve o `statement`/categoria real
   * de cada `basedOnRecommendationId` do histórico a partir dos mesmos
   * `recommendationOptions` reais já usados pelo seletor (nunca uma
   * segunda busca/fabricação) — permite ao histórico mostrar o texto da
   * Recommendation, nunca apenas o id opaco.
   */
  const recommendationById = new Map(
    recommendationOptions.map((option) => [option.recommendationId, option] as const)
  );

  const canSubmit = type && priority && confidence && title.trim() && description.trim() && rationale.trim();

  async function handleSubmit() {
    if (!canSubmit || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setError(undefined);
    setErrors(undefined);
    setSuccess(false);

    try {
      const result = await createHumanDecisionAction({
        companyId,
        type: type as DecisionType,
        priority: priority as RecommendationPriority,
        confidence: confidence as RecommendationConfidence,
        title: title.trim(),
        description: description.trim(),
        rationale: rationale.trim(),
        diagnosisId: linkToDiagnosis ? diagnosisId : undefined,
        reviewId: linkToDiagnosis ? reviewId : undefined,
        recommendationId: linkToDiagnosis && recommendationId ? recommendationId : undefined,
      });

      if (!result.success) {
        setError(result.error);
        setErrors(result.errors);
        return;
      }

      setSuccess(true);
      setType("");
      setPriority("");
      setConfidence("");
      setTitle("");
      setDescription("");
      setRationale("");
      setRecommendationId("");
      router.refresh();
    } catch {
      setError("Erro inesperado ao registrar a decisão. Tente novamente.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Decisão humana (Human Decision)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          Esta decisão pode concordar com o diagnóstico, concordar parcialmente, contrariá-lo
          completamente, ou existir sem nenhum diagnóstico associado — nenhuma divergência com a IA é
          bloqueada.
        </p>

        {history.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Histórico de decisões (mais recente primeiro)
            </span>
            {history.map((decision) => (
              <div key={decision.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{decision.decision.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(decision.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  decidido por: <span className="font-mono">{decision.humanActorId ?? "—"}</span>
                </p>
                <p className="mt-1 text-sm text-foreground">{decision.decision.description}</p>
                {/*
                  Mission 153 — Etapa 21: sempre mostra explicitamente a
                  presença OU ausência de Recommendation — nunca omite a
                  linha silenciosamente quando ausente (a ausência é um
                  fato tão real quanto a presença). Quando presente e
                  resolvível, mostra "Recomendação da IA: <statement>",
                  nunca "Decisão: <statement>" — Recommendation e
                  Decision continuam semanticamente distintas mesmo na
                  UI.
                */}
                {decision.decision.basedOnRecommendationId ? (
                  (() => {
                    const recommendation = recommendationById.get(decision.decision.basedOnRecommendationId);
                    return (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Recomendação da IA:{" "}
                        {recommendation ? (
                          <>
                            [{RECOMMENDATION_CATEGORY_LABELS[recommendation.category]}] {recommendation.statement}
                          </>
                        ) : (
                          <span className="font-mono">{decision.decision.basedOnRecommendationId}</span>
                        )}
                      </p>
                    );
                  })()
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Sem Recommendation associada</p>
                )}
              </div>
            ))}
          </div>
        )}

        {(diagnosisId || reviewId) && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={linkToDiagnosis}
              onChange={(event) => setLinkToDiagnosis(event.target.checked)}
              className="size-4"
            />
            Vincular esta decisão ao diagnóstico/revisão atual
            {!linkToDiagnosis && <Badge variant="outline">decisão independente da IA</Badge>}
          </label>
        )}

        {linkToDiagnosis && recommendationOptions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label>Recomendação da IA (opcional)</Label>
            <Select value={recommendationId} onValueChange={(value) => setRecommendationId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Nenhuma recomendação específica" />
              </SelectTrigger>
              <SelectContent>
                {recommendationOptions.map((option) => {
                  const reviewStatus = resolveRecommendationReviewStatus(option.recommendationId, latestReview);
                  return (
                    <SelectItem key={option.recommendationId} value={option.recommendationId}>
                      [{RECOMMENDATION_CATEGORY_LABELS[option.category]}] {option.statement}
                      {reviewStatus ? ` — ${REVIEW_STATUS_LABELS[reviewStatus.status]}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se esta decisão responde a uma proposta específica da IA, selecione-a aqui — nunca obrigatório.
            </p>
          </div>
        )}

        {linkToDiagnosis && recommendationId && (() => {
          const governance = governanceByRecommendationId?.get(recommendationId);
          if (!governance || governance.outcome !== "GOVERNED" || !governance.lifecycleState) return null;
          return (
            <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
              <span className="font-medium uppercase tracking-wide text-foreground">Governança</span>
              <p className="mt-1">
                Ciclo de vida: <span className="font-medium text-foreground">{GOVERNANCE_LIFECYCLE_LABELS[governance.lifecycleState]}</span>
              </p>
              <p className="mt-1">Review: {governance.reviewStatus ? REVIEW_STATUS_LABELS[governance.reviewStatus.status] : "não avaliada"}</p>
              <p className="mt-1">Decision: {governance.decisionId ? "existe" : "nenhuma ainda"}</p>
              <p className="mt-1">Execution: {governance.executionStatus ? EXECUTION_STATUS_LABELS[governance.executionStatus] : "nenhuma ainda"}</p>
              <p className="mt-1">Outcome: {governance.outcomeStatus ? OUTCOME_STATUS_LABELS[governance.outcomeStatus] : "nenhum ainda"}</p>
              <p className="mt-1">Learning: {governance.learningRecordId ? "registrado" : "nenhum ainda"}</p>
            </div>
          );
        })()}

        {linkToDiagnosis && recommendationId && (() => {
          const reconciliation = reconciliationByRecommendationId?.get(recommendationId);
          if (!reconciliation || reconciliation.outcome !== "RECONCILED" || !reconciliation.reconciliationState) return null;
          return (
            <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
              <span className="font-medium uppercase tracking-wide text-foreground">Reconciliação (proposta vs. observação)</span>
              <p className="mt-1">
                Estágio: <span className="font-medium text-foreground">{RECONCILIATION_STATE_LABELS[reconciliation.reconciliationState]}</span>
              </p>
              <p className="mt-1">
                Resultado observado (humano): {reconciliation.outcomeStatus ? OUTCOME_STATUS_LABELS[reconciliation.outcomeStatus] : "nenhum ainda"}
              </p>
              <p className="mt-1">
                Observação financeira: {reconciliation.financialObservations && reconciliation.financialObservations.length > 0
                  ? `${reconciliation.financialObservations.length} disponível(is)`
                  : "nenhuma ainda"}
              </p>
              <p className="mt-2 italic">
                Fatos separados, nunca combinados — um resultado humano positivo/negativo ou uma variação financeira observada nunca significam que esta Recommendation funcionou ou falhou; apenas associação temporal, nunca causalidade.
              </p>
            </div>
          );
        })()}

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(value) => setType(value as DecisionType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {DECISION_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {TYPE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={(value) => setPriority(value as RecommendationPriority)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {RECOMMENDATION_PRIORITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {PRIORITY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Confiança</Label>
            <Select value={confidence} onValueChange={(value) => setConfidence(value as RecommendationConfidence)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {RECOMMENDATION_CONFIDENCE_LEVELS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {CONFIDENCE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Título</Label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Priorizar corte de custos administrativos" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Descrição</Label>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="O que foi decidido" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Justificativa</Label>
          <Textarea value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Por que esta decisão foi tomada — sempre nas suas próprias palavras" />
        </div>

        {error && (
          <p className="text-sm text-destructive">
            {error}
            {errors && errors.length > 0 && (
              <span className="mt-1 block text-xs">{errors.join(" — ")}</span>
            )}
          </p>
        )}
        {success && <p className="text-sm text-emerald-600">Decisão registrada com sucesso.</p>}

        <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="w-fit">
          {submitting ? "Registrando decisão..." : "Registrar decisão"}
        </Button>
      </CardContent>
    </Card>
  );
}
