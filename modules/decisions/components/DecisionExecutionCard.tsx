"use client";

import { useState } from "react";
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
import { OUTCOME_STATUSES, type Outcome, type OutcomeStatus } from "@/efos/domain";
import type { DecisionExecutionState } from "@/efos/application/decision-execution/deriveDecisionExecutionState";
import type { DecisionExecutionStatus } from "@/efos/application/decision-execution/DecisionExecutionEvent";
import { readScenarioDecisionContext } from "@/efos/application/decision-lifecycle";
import type { FinancialOutcomeObservation } from "@/efos/application/financial-observation";
import type { LearningRecord } from "@/efos/domain";
import type { ExpectedActualComparison, ExpectedActualComparisonBundle } from "@/efos/application/scenario-outcome-comparison";
import {
  deriveExpectedActualLearningEligibility,
  readExpectedActualLearningContext,
  type ExpectedActualLearningContext,
} from "@/efos/application/expected-actual-learning";
import { formatIndicatorValue } from "@/lib/format-indicator";
import { cn } from "@/lib/utils";
import {
  recordDecisionExecutionEventAction,
  recordOutcomeAction,
} from "@/modules/decisions/actions/decision-execution.actions";
import { computeFinancialOutcomeObservationAction } from "@/modules/decisions/actions/financial-observation.actions";
import { deriveLearningRecordAction } from "@/modules/decisions/actions/learning-derivation.actions";
import { accumulateKnowledgeAction } from "@/modules/decisions/actions/knowledge-accumulation.actions";
import { evaluateKnowledgeAction } from "@/modules/decisions/actions/knowledge-evaluation.actions";
import {
  EXPECTED_ACTUAL_ALIGNMENT_LABELS,
  EXPECTED_ACTUAL_DIRECTION_CONSISTENCY_LABELS,
  EXPECTED_ACTUAL_ELIGIBILITY_LABELS,
} from "@/modules/decisions/lib/expectedActualLabels";
import type { PersistedDecision } from "@/modules/decisions/services/decision-persistence.service";
import {
  SCENARIO_IMPACT_TONE_CLASSNAME,
  describeScenarioAssumption,
  formatScenarioMetricDelta,
} from "@/modules/scenarios/lib/scenario-language";

/**
 * Mensagens honestas por código de erro (Mission 139, Etapa 10 —
 * "Financial Truth insuficiente retorna resultado honesto"). Nunca uma
 * mensagem genérica que esconda a causa real — mesma disciplina de
 * `ExecutiveDiagnosisActivation` (Mission 128).
 */
const OBSERVATION_ERROR_LABELS: Record<string, string> = {
  EXECUTION_NOT_COMPLETED: "A execução desta decisão ainda não foi concluída — a observação financeira só pode ser calculada depois de COMPLETED.",
  NO_COMPARABLE_FINANCIAL_TRUTH: "Não há dados financeiros comparáveis (antes/depois) suficientes ainda — nenhum valor foi inventado ou estimado.",
};

/**
 * Mesmo padrão de `OBSERVATION_ERROR_LABELS` acima (Mission 139) —
 * mensagens honestas por código, nunca genéricas.
 */
const LEARNING_ERROR_LABELS: Record<string, string> = {
  INSUFFICIENT_EVIDENCE: "Nenhum Outcome humano e nenhuma observação financeira existem ainda para esta decisão — nenhum aprendizado pode ser derivado sem evidência real.",
  HUMAN_STATEMENT_REQUIRED: "Escreva sua interpretação sobre este resultado antes de registrar o aprendizado — o contexto financeiro sozinho não é uma conclusão.",
};

const EVIDENCE_CLASSIFICATION_LABELS: Record<string, string> = {
  TEMPORAL_ASSOCIATION: "Associação temporal",
  EVIDENCE_FAVORABLE: "Evidência favorável",
  EVIDENCE_CONTRARY: "Evidência contrária",
  INCONCLUSIVE: "Inconclusivo",
};

const STATUS_LABELS: Record<DecisionExecutionStatus, string> = {
  NOT_STARTED: "Não iniciada",
  IN_PROGRESS: "Em andamento",
  BLOCKED: "Bloqueada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

const OUTCOME_LABELS: Record<OutcomeStatus, string> = {
  pending: "Aguardando avaliação",
  positive: "Positivo",
  negative: "Negativo",
  neutral: "Neutro",
  inconclusive: "Inconclusivo",
};

/**
 * Próximas transições permitidas por status atual — mesma máquina de
 * estados de `DecisionExecutionEvent.validator.ts`, duplicada aqui
 * SOMENTE como conveniência de UI (nunca a fonte de verdade: o
 * servidor sempre revalida contra o histórico real antes de aceitar
 * qualquer evento — ver `recordDecisionExecutionEventAction()`). Se
 * esta lista e o validador divergirem no futuro, o pior caso é a UI
 * oferecer uma opção que o servidor rejeita com um erro claro, nunca o
 * inverso.
 */
const NEXT_TRANSITIONS: Record<DecisionExecutionStatus, readonly DecisionExecutionStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"],
  BLOCKED: ["BLOCKED", "IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Mission 185 Closure — Observation Horizon & Temporal Eligibility.
 * Renderiza UMA camada de `ExpectedActualComparison` (`live` ou
 * `formal`, nunca fundidas — `title` já vem diferenciado do chamador).
 * Extraído como componente próprio porque `DecisionExecutionCard`
 * passa a renderizar até duas instâncias desta mesma estrutura lado a
 * lado, nunca duas implementações divergentes.
 */
function ExpectedActualBlock({ title, comparison }: { title: string; comparison: ExpectedActualComparison }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{title}</Label>
        <Badge variant="outline" className="text-[10px]">
          {EXPECTED_ACTUAL_ELIGIBILITY_LABELS[comparison.eligibility]}
        </Badge>
      </div>

      {comparison.eligibility !== "comparable" && (
        <p className="text-xs text-muted-foreground">{comparison.reason}</p>
      )}

      {comparison.eligibility === "comparable" && comparison.observedPeriod && (
        <>
          <p className="text-xs text-muted-foreground">
            Verdade financeira observada em{" "}
            {new Date(comparison.observedPeriod.startDate).toLocaleDateString("pt-BR")} a{" "}
            {new Date(comparison.observedPeriod.endDate).toLocaleDateString("pt-BR")}.
          </p>

          <div className="mt-1 flex flex-col gap-2">
            {comparison.metrics.map((entry) =>
              entry.status === "compared" ? (
                <div key={entry.metricKey} className="flex flex-col gap-1 rounded bg-muted/40 px-2 py-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{entry.label}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {EXPECTED_ACTUAL_ALIGNMENT_LABELS[entry.expectationAlignment]}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                    <span>Meta: {formatIndicatorValue(entry.expectedValue, entry.unit)}</span>
                    <span>Observado: {formatIndicatorValue(entry.observedValue, entry.unit)}</span>
                    <span>
                      Diferença:{" "}
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          entry.expectationAlignment === "better-than-expected"
                            ? "text-success"
                            : entry.expectationAlignment === "worse-than-expected"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        )}
                      >
                        {formatScenarioMetricDelta(entry.expectationGap, entry.unit)}
                      </span>
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {EXPECTED_ACTUAL_DIRECTION_CONSISTENCY_LABELS[entry.directionConsistency]}
                  </span>
                </div>
              ) : (
                <div key={entry.metricKey} className="flex items-center justify-between gap-3 rounded bg-muted/40 px-2 py-1.5 text-xs">
                  <span className="text-foreground">{entry.label}</span>
                  <span className="text-muted-foreground">
                    {entry.reason === "observed-unavailable" ? "Não observável ainda" : "Não era esperável"}
                  </span>
                </div>
              )
            )}
          </div>
        </>
      )}

      <p className="text-[10px] text-muted-foreground">{comparison.disclaimer}</p>
    </div>
  );
}

/**
 * Mission 186 — Decision Learning from Expected vs Observed. Renderiza
 * o snapshot IMUTÁVEL (`LearningRecord.supportingData.expectedActualContext`)
 * anexado a um `LearningRecord` já persistido — nunca a comparação
 * `formal` ATUAL (`expectedActualComparison.formal`, acima), que pode
 * ter avançado para uma observação mais nova desde que este aprendizado
 * foi registrado (Seção 13/34 da missão — restatement nunca reescreve
 * um `LearningRecord` já persistido). Visualmente mais compacto que
 * `ExpectedActualBlock` (fato determinístico já congelado, não uma
 * comparação ao vivo) — mesma disciplina de rótulos
 * (`EXPECTED_ACTUAL_ALIGNMENT_LABELS`), nunca uma segunda tradução.
 */
function ExpectedActualLearningSnapshot({ context }: { context: ExpectedActualLearningContext }) {
  return (
    <div className="mt-2 flex flex-col gap-1 rounded border border-dashed border-border/70 bg-background/40 p-2">
      <p className="text-[10px] font-medium text-foreground">
        Contexto financeiro determinístico (congelado nesta avaliação formal)
      </p>
      {context.metrics.map((entry) =>
        entry.status === "compared" ? (
          <div key={entry.metricKey} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-foreground">{entry.label}</span>
            <span className="text-muted-foreground">
              Meta: {formatIndicatorValue(entry.expectedValue, entry.unit)} · Observado:{" "}
              {formatIndicatorValue(entry.observedValue, entry.unit)} ·{" "}
              {EXPECTED_ACTUAL_ALIGNMENT_LABELS[entry.expectationAlignment]}
            </span>
          </div>
        ) : (
          <div key={entry.metricKey} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-foreground">{entry.label}</span>
            <span className="text-muted-foreground">
              {entry.reason === "observed-unavailable" ? "Não observável ainda" : "Não era esperável"}
            </span>
          </div>
        )
      )}
    </div>
  );
}

/**
 * Mission 138, Etapa 11/13 — um card por `Decision`, nunca um Kanban
 * genérico. Toda submissão exige clique explícito (nunca `useEffect`
 * automático), fica `disabled` durante o processamento (proteção
 * contra duplo clique, mesmo padrão de `DiagnosisReviewSection`/
 * `HumanDecisionSection`), e chama `router.refresh()` após sucesso —
 * o padrão da Mission 137 preservado (Etapa 12 da missão).
 *
 * **Mission 184 (Scenario-to-Decision Governance Bridge)**: quando
 * `decision.decision.supportingData.scenarioContext` está presente
 * (`readScenarioDecisionContext()`), um bloco adicional mostra a
 * hipótese e o impacto ESPERADO no momento da decisão — sempre
 * distinguível do Outcome observado logo abaixo (Seção 23/24: "Expected
 * vs Actual", nunca sobrescrito um pelo outro). Ausente para toda
 * Decision de origem Recommendation/independente (`undefined`, nenhuma
 * alteração de layout).
 *
 * **Mission 185 / Mission 185 Closure (Expected vs Actual Decision
 * Intelligence)**: até DOIS blocos `ExpectedActualBlock` são
 * renderizados — `"Esperado vs. Observado (ao vivo)"` (sempre que
 * elegível, atualiza-se a cada novo período reportado — nunca uma
 * avaliação final) e `"Avaliação formal registrada em <data>"` (apenas
 * quando o executivo já clicou "Calcular observação financeira" pelo
 * menos uma vez para esta Decision — ancorada a essa execução
 * específica, nunca substituída silenciosamente por um período mais
 * novo). As duas camadas nunca são fundidas nem confundidas.
 */
export function DecisionExecutionCard({
  companyId,
  decision,
  state,
  outcomes,
  financialObservations,
  learningRecords,
  expectedActualComparison,
}: {
  companyId: string;
  decision: PersistedDecision;
  state: DecisionExecutionState;
  outcomes: readonly Outcome[];
  financialObservations: readonly FinancialOutcomeObservation[];
  learningRecords: readonly LearningRecord[];
  /**
   * Mission 185 — Expected vs Actual Decision Intelligence. Revisada
   * pela Mission 185 Closure: `live` (sempre presente quando elegível)
   * e `formal` (apenas quando uma `FinancialOutcomeObservation` já foi
   * registrada) — duas camadas nunca fundidas. `{outcome:
   * "not-scenario-backed"}` para Decisions de origem Recommendation/
   * independente — nenhum bloco é renderizado nesse caso.
   */
  expectedActualComparison?: ExpectedActualComparisonBundle;
}) {
  const router = useRouter();
  const nextStatuses = NEXT_TRANSITIONS[state.status];
  const isTerminal = nextStatuses.length === 0;

  const [nextStatus, setNextStatus] = useState<DecisionExecutionStatus | "">("");
  const [targetDate, setTargetDate] = useState("");
  const [execNotes, setExecNotes] = useState("");
  const [execSubmitting, setExecSubmitting] = useState(false);
  const [execError, setExecError] = useState<string | undefined>();
  const [execErrors, setExecErrors] = useState<readonly string[] | undefined>();

  const [outcomeStatus, setOutcomeStatus] = useState<OutcomeStatus | "">("");
  const [expectedResult, setExpectedResult] = useState("");
  const [observedDescription, setObservedDescription] = useState("");
  const [outcomeSubmitting, setOutcomeSubmitting] = useState(false);
  const [outcomeError, setOutcomeError] = useState<string | undefined>();
  const [outcomeErrors, setOutcomeErrors] = useState<readonly string[] | undefined>();

  const [computingObservation, setComputingObservation] = useState(false);
  const [observationError, setObservationError] = useState<string | undefined>();

  const [computingLearning, setComputingLearning] = useState(false);
  const [learningError, setLearningError] = useState<string | undefined>();
  const [humanStatement, setHumanStatement] = useState("");

  // Mission 186 — Decision Learning from Expected vs Observed. Só
  // informa a executiva ANTES do clique — nunca decide sozinho: o
  // servidor (`deriveLearningRecordAction()`) sempre recalcula a mesma
  // elegibilidade de forma independente antes de anexar o contexto
  // (Seção 31 — "Enforce in Application/server boundary", esta leitura
  // client-side é só uma conveniência de UI, nunca a fonte de verdade).
  const learningEligibility = expectedActualComparison
    ? deriveExpectedActualLearningEligibility(expectedActualComparison)
    : undefined;

  async function submitExecutionEvent() {
    if (!nextStatus || execSubmitting) return;
    setExecSubmitting(true);
    setExecError(undefined);
    setExecErrors(undefined);

    try {
      const result = await recordDecisionExecutionEventAction({
        companyId,
        decisionId: decision.id,
        status: nextStatus,
        targetDate: targetDate.trim() || undefined,
        notes: execNotes.trim() || undefined,
      });

      if (!result.success) {
        setExecError(result.error);
        setExecErrors(result.errors);
        return;
      }

      setNextStatus("");
      setTargetDate("");
      setExecNotes("");
      router.refresh();
    } catch {
      setExecError("Erro inesperado ao registrar o evento de execução. Tente novamente.");
    } finally {
      setExecSubmitting(false);
    }
  }

  async function submitOutcome() {
    if (!outcomeStatus || !observedDescription.trim() || outcomeSubmitting) return;
    setOutcomeSubmitting(true);
    setOutcomeError(undefined);
    setOutcomeErrors(undefined);

    try {
      const result = await recordOutcomeAction({
        companyId,
        decisionId: decision.id,
        status: outcomeStatus,
        observedAt: new Date().toISOString(),
        description: observedDescription.trim(),
        expectedResult: expectedResult.trim() || undefined,
      });

      if (!result.success) {
        setOutcomeError(result.error);
        setOutcomeErrors(result.errors);
        return;
      }

      setOutcomeStatus("");
      setExpectedResult("");
      setObservedDescription("");
      router.refresh();
    } catch {
      setOutcomeError("Erro inesperado ao registrar o outcome. Tente novamente.");
    } finally {
      setOutcomeSubmitting(false);
    }
  }

  async function handleComputeObservation() {
    if (computingObservation) return;
    setComputingObservation(true);
    setObservationError(undefined);

    try {
      const result = await computeFinancialOutcomeObservationAction({ companyId, decisionId: decision.id });
      if (!result.success) {
        setObservationError(OBSERVATION_ERROR_LABELS[result.code] ?? result.message);
        return;
      }
      router.refresh();
    } catch {
      setObservationError("Erro inesperado ao calcular a observação financeira. Tente novamente.");
    } finally {
      setComputingObservation(false);
    }
  }

  async function handleDeriveLearningRecord() {
    if (computingLearning) return;
    // Mission 186 Closure — Human Learning Statement & Governance.
    // Convenience de UI apenas — o servidor (`deriveLearningRecordAction()`)
    // sempre recalcula a mesma elegibilidade de forma independente e
    // exige `humanStatement` quando ela for positiva, nunca confiando
    // apenas nesta checagem client-side (Seção 31 análoga da Mission 186).
    if (learningEligibility?.eligible && humanStatement.trim().length === 0) return;
    setComputingLearning(true);
    setLearningError(undefined);

    try {
      const result = await deriveLearningRecordAction({
        companyId,
        decisionId: decision.id,
        humanStatement: learningEligibility?.eligible ? humanStatement : undefined,
      });
      if (!result.success) {
        setLearningError(LEARNING_ERROR_LABELS[result.code] ?? result.message);
        return;
      }
      setHumanStatement("");
      // Mission 144 — Knowledge Accumulation & Historical Pattern
      // Formation (Etapa 8). Chamada explícita, SEQUENCIAL, sempre
      // visível aqui no client — nunca um efeito colateral escondido
      // dentro de deriveLearningRecordAction()/saveLearningRecord().
      // Falha aqui nunca desfaz o LearningRecord já persistido acima
      // (2 Server Actions independentes, sem transação única) — a
      // acumulação pode ser tentada de novo mais tarde.
      await accumulateKnowledgeAction({ companyId });
      // Mission 145 — Knowledge-Driven Continuous Improvement (Etapa
      // 10). Mesmo princípio: chamada explícita, SEQUENCIAL, nunca
      // escondida dentro de accumulateKnowledgeAction()/saveKnowledge().
      // Reavalia TODO Knowledge da empresa contra os LearningRecords
      // reais mais recentes — falha aqui nunca desfaz o LearningRecord
      // nem o Knowledge já persistidos acima; pode ser tentada de novo
      // mais tarde.
      await evaluateKnowledgeAction({ companyId });
      router.refresh();
    } catch {
      setLearningError("Erro inesperado ao derivar o aprendizado. Tente novamente.");
    } finally {
      setComputingLearning(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="text-sm">{decision.decision.title}</CardTitle>
        <Badge variant={state.status === "COMPLETED" ? "default" : state.status === "CANCELLED" ? "destructive" : "secondary"}>
          {STATUS_LABELS[state.status]}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {(() => {
          const scenarioContext = readScenarioDecisionContext(decision.decision.supportingData);
          if (!scenarioContext) return null;
          return (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Contexto do cenário (hipotético)</Label>
                <Badge variant="outline" className="text-[10px]">
                  Esperado, não observado
                </Badge>
              </div>
              <p className="text-sm text-foreground">{describeScenarioAssumption(scenarioContext.assumption)}</p>
              <p className="text-xs text-muted-foreground">
                Avaliado contra o período de {new Date(scenarioContext.period.startDate).toLocaleDateString("pt-BR")} a{" "}
                {new Date(scenarioContext.period.endDate).toLocaleDateString("pt-BR")}.
              </p>
              {scenarioContext.alternative && (
                <p className="text-xs text-muted-foreground">
                  Alternativa considerada, não escolhida:{" "}
                  {describeScenarioAssumption(scenarioContext.alternative.assumption)}
                </p>
              )}
              <div className="mt-1 flex flex-col gap-1">
                {scenarioContext.comparison.map((entry) =>
                  entry.status === "compared" ? (
                    <div
                      key={entry.metricKey}
                      className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1 text-xs"
                    >
                      <span className="text-foreground">{entry.label}</span>
                      <span className={cn("font-medium tabular-nums", SCENARIO_IMPACT_TONE_CLASSNAME[entry.impact])}>
                        {formatIndicatorValue(entry.projectedValue, entry.unit)} (
                        {formatScenarioMetricDelta(entry.delta, entry.unit)})
                      </span>
                    </div>
                  ) : null
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Impacto esperado no momento da decisão — nunca o resultado real observado. O resultado
                efetivo é registrado separadamente abaixo, como Outcome.
              </p>
            </div>
          );
        })()}

        {expectedActualComparison?.live.outcome === "built" && (
          <ExpectedActualBlock
            title="Esperado vs. Observado (ao vivo)"
            comparison={expectedActualComparison.live.comparison}
          />
        )}

        {expectedActualComparison?.formal?.outcome === "built" && (
          <ExpectedActualBlock
            title={`Avaliação formal registrada em ${new Date(financialObservations[0]?.computedAt ?? new Date().toISOString()).toLocaleDateString("pt-BR")}`}
            comparison={expectedActualComparison.formal.comparison}
          />
        )}

        {state.status !== "NOT_STARTED" && (
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
            <div>
              <span className="block uppercase tracking-wide">Responsável</span>
              <span className="font-mono text-foreground">{state.owner ?? "—"}</span>
            </div>
            <div>
              <span className="block uppercase tracking-wide">Iniciada em</span>
              <span className="text-foreground">{state.startedAt ? new Date(state.startedAt).toLocaleDateString("pt-BR") : "—"}</span>
            </div>
            <div>
              <span className="block uppercase tracking-wide">Prazo alvo</span>
              <span className="text-foreground">{state.targetDate ? new Date(state.targetDate).toLocaleDateString("pt-BR") : "—"}</span>
            </div>
            <div>
              <span className="block uppercase tracking-wide">Concluída em</span>
              <span className="text-foreground">{state.completedAt ? new Date(state.completedAt).toLocaleDateString("pt-BR") : "—"}</span>
            </div>
          </div>
        )}
        {state.notes && <p className="text-sm text-foreground">{state.notes}</p>}

        {!isTerminal && (
          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <Label className="text-xs">Registrar progresso</Label>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Select value={nextStatus} onValueChange={(value) => setNextStatus(value as DecisionExecutionStatus)}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Novo status" />
                  </SelectTrigger>
                  <SelectContent>
                    {nextStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                className="w-40"
                placeholder="Prazo alvo"
              />
              <Button size="sm" onClick={submitExecutionEvent} disabled={!nextStatus || execSubmitting}>
                {execSubmitting ? "Registrando..." : "Registrar"}
              </Button>
            </div>
            <Textarea
              value={execNotes}
              onChange={(event) => setExecNotes(event.target.value)}
              placeholder="Notas (opcional)"
              className="text-sm"
            />
            {execError && (
              <p className="text-sm text-destructive">
                {execError}
                {execErrors && execErrors.length > 0 && <span className="mt-1 block text-xs">{execErrors.join(" — ")}</span>}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <Label className="text-xs">Resultado observado (Outcome)</Label>
          {outcomes.length > 0 && (
            <div className="flex flex-col gap-2">
              {outcomes.map((outcome) => (
                <div key={outcome.id} className="rounded-md bg-muted/40 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{OUTCOME_LABELS[outcome.status]}</Badge>
                    <span className="text-muted-foreground">{new Date(outcome.observedAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                  {outcome.expectedResult && (
                    <p className="mt-1 text-muted-foreground">
                      <strong>Esperado:</strong> {outcome.expectedResult}
                    </p>
                  )}
                  <p className="mt-1 text-foreground">
                    <strong>Observado:</strong> {outcome.description}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <Select value={outcomeStatus} onValueChange={(value) => setOutcomeStatus(value as OutcomeStatus)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Avaliação" />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {OUTCOME_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            value={expectedResult}
            onChange={(event) => setExpectedResult(event.target.value)}
            placeholder="O que se esperava (opcional)"
            className="text-sm"
          />
          <Textarea
            value={observedDescription}
            onChange={(event) => setObservedDescription(event.target.value)}
            placeholder="O que de fato foi observado"
            className="text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            className="w-fit"
            onClick={submitOutcome}
            disabled={!outcomeStatus || !observedDescription.trim() || outcomeSubmitting}
          >
            {outcomeSubmitting ? "Registrando..." : "Registrar outcome"}
          </Button>
          {outcomeError && (
            <p className="text-sm text-destructive">
              {outcomeError}
              {outcomeErrors && outcomeErrors.length > 0 && <span className="mt-1 block text-xs">{outcomeErrors.join(" — ")}</span>}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Financial Truth — comparação antes/depois</Label>
            <Button size="sm" variant="outline" onClick={handleComputeObservation} disabled={computingObservation}>
              {computingObservation ? "Calculando..." : "Calcular observação financeira"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Compara indicadores financeiros de antes e depois da execução — mostra associação temporal, nunca prova de causalidade.
          </p>

          {financialObservations.length === 0 && !observationError && (
            <p className="text-xs text-muted-foreground">Nenhuma observação financeira calculada ainda para esta decisão.</p>
          )}

          {financialObservations.map((observation) => (
            <div key={observation.id} className="rounded-md bg-muted/40 p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">Correlation: {observation.classification}</Badge>
                <span className="text-muted-foreground">calculado em {new Date(observation.computedAt).toLocaleDateString("pt-BR")}</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                Baseline: {new Date(observation.window.baselineExecutedAt).toLocaleDateString("pt-BR")} → Observação:{" "}
                {new Date(observation.window.observationExecutedAt).toLocaleDateString("pt-BR")}
              </p>
              <div className="mt-2 flex flex-col gap-1">
                {observation.metrics.map((metric) => (
                  <div key={metric.metricName} className="flex items-center justify-between gap-2 rounded bg-background/60 px-2 py-1">
                    <span className="text-foreground">{metric.metricName}</span>
                    <span className="font-mono text-foreground">
                      {metric.beforeValue.toFixed(2)} → {metric.afterValue.toFixed(2)}
                      {metric.percentageChange !== undefined ? ` (${metric.percentageChange > 0 ? "+" : ""}${metric.percentageChange.toFixed(1)}%)` : ""}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Variação financeira observada após a execução — associação temporal, nunca prova de que esta decisão a causou.
              </p>
            </div>
          ))}

          {observationError && <p className="text-sm text-destructive">{observationError}</p>}
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Aprendizado (Learning Record)</Label>
            {!learningEligibility?.eligible && (
              <Button size="sm" variant="outline" onClick={handleDeriveLearningRecord} disabled={computingLearning}>
                {computingLearning ? "Derivando..." : "Derivar aprendizado"}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Classifica a força da evidência disponível a partir do julgamento humano já registrado — nunca conclui causalidade.
          </p>

          {/*
            Mission 186 Closure — Human Learning Statement & Governance.
            Quando elegível, o contexto financeiro (já exibido acima, nos
            blocos "Esperado vs. Observado") NUNCA é suficiente sozinho —
            o executivo precisa escrever sua própria interpretação antes
            de o botão ficar habilitado. Nunca reaproveita `description`
            (que continua o template determinístico de sempre).
          */}
          {learningEligibility?.eligible && (
            <div className="flex flex-col gap-2 rounded-md bg-muted/30 p-2">
              <p className="text-[11px] text-muted-foreground">
                Esta decisão possui uma avaliação formal Esperado vs. Observado elegível. O contexto financeiro acima já é determinístico e imutável — escreva sua própria interpretação para registrar este aprendizado.
              </p>
              <Textarea
                value={humanStatement}
                onChange={(event) => setHumanStatement(event.target.value)}
                placeholder="Ex.: a redução planejada de custos ainda não apareceu integralmente no resultado observado; precisamos verificar execução e efeitos externos."
                className="text-xs"
                rows={3}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeriveLearningRecord}
                disabled={computingLearning || humanStatement.trim().length === 0}
                className="self-end"
              >
                {computingLearning ? "Registrando..." : "Registrar aprendizado"}
              </Button>
            </div>
          )}

          {learningRecords.length === 0 && !learningError && (
            <p className="text-xs text-muted-foreground">Nenhum aprendizado derivado ainda para esta decisão.</p>
          )}

          {learningRecords.map((record) => {
            const expectedActualContext = readExpectedActualLearningContext(record.supportingData);
            return (
              <div key={record.id} className="rounded-md bg-muted/40 p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">
                    {record.evidenceClassification ? EVIDENCE_CLASSIFICATION_LABELS[record.evidenceClassification] : "—"}
                  </Badge>
                  <span className="text-muted-foreground">confiança: {record.confidence}</span>
                </div>
                <p className="mt-1 font-medium text-foreground">{record.title}</p>
                <p className="mt-1 text-muted-foreground">{record.description}</p>
                {expectedActualContext && <ExpectedActualLearningSnapshot context={expectedActualContext} />}
                {record.humanStatement && (
                  <p className="mt-2 rounded bg-background/60 p-2 text-[11px] text-foreground">
                    <span className="font-medium">Interpretação registrada pelo executivo: </span>
                    <span className="italic">{record.humanStatement}</span>
                  </p>
                )}
              </div>
            );
          })}

          {learningError && <p className="text-sm text-destructive">{learningError}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
