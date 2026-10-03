import type { DecisionExecutionEvent } from "@/efos/application/decision-execution";
import { deriveDecisionExecutionState } from "@/efos/application/decision-execution/deriveDecisionExecutionState";
import { listRecommendationReferences } from "@/efos/application/executive-diagnosis";
import type { FinancialOutcomeObservation } from "@/efos/application/financial-observation";
import type { HistoricalExecution } from "@/efos/application/history";
import type { ExecutiveReport, ExecutiveReportSection } from "@/efos/application/report";
import type { ScenarioMetricComparison } from "@/efos/application/scenario-simulation";
import type { Evidence, Indicator, Knowledge, LearningRecord, Outcome, Period } from "@/efos/domain";
import type { NormalizedFinancialRecord } from "@/efos/engines/data";
import { formatEngineText } from "@/modules/analysis/lib/engine-text";
import { translateMetricKey } from "@/modules/analysis/lib/executive-language";
import { buildExecutiveSituationFor, SEVERITY_ORDER, type ExecutiveSituation } from "@/modules/analysis/lib/executive-situation";
import { levelLabel, priorityTag, severityTag } from "@/modules/analysis/lib/insight-semantics";
import { describeMetricChange, formatMetricValue, type MetricChangePresentation } from "@/modules/analysis/lib/metric-change";
import { formatPeriodLabel, type PeriodLabel } from "@/modules/analysis/lib/period-label";
import { derivePeriodLabel, isBalanceSheetRecord } from "@/modules/analysis/lib/report-view";
import { buildDecisionCenterQueue } from "@/modules/decisions/lib/buildDecisionCenterQueue";
import { buildReferenceLabels, type ReferenceLabels } from "@/modules/decisions/lib/diagnosis-references";
import { EXPECTED_ACTUAL_ALIGNMENT_LABELS } from "@/modules/decisions/lib/expectedActualLabels";
import {
  DECISION_EXECUTION_STATUS_LABELS,
  DECISION_PRIORITY_LABELS,
  DECISION_TYPE_LABELS,
  GOVERNANCE_LIFECYCLE_LABELS,
  OUTCOME_STATUS_LABELS,
  RECOMMENDATION_CATEGORY_LABELS,
} from "@/modules/decisions/lib/governanceLabels";
import { KNOWLEDGE_CATEGORY_LABELS } from "@/modules/decisions/lib/knowledgeLabels";
import { resolveExpectedActualComparison } from "@/modules/decisions/lib/resolveExpectedActualComparison";
import type { PersistedDecision } from "@/modules/decisions/services/decision-persistence.service";
import type { PersistedDiagnosisReview } from "@/modules/decisions/services/diagnosis-review-persistence.service";
import type { PersistedExecutiveDiagnosis } from "@/modules/decisions/services/executive-diagnosis-persistence.service";
import { describeScenarioAssumption } from "@/modules/scenarios/lib/scenario-language";

import { selectReportLineage, type ReportDecisionLink } from "./report-lineage";
import {
  reportPeriodOf,
  resolveReportVersion,
  selectReportComparison,
  type ReportComparison,
  type ReportVersion,
} from "./report-period";

/**
 * Mission 208 — leitura executiva de um relatório (D-133).
 *
 * O relatório é o `ExecutiveReport` de uma execução — o contrato canônico,
 * persistido e imutável (D-038/D-043), carregado aqui POR REFERÊNCIA em
 * `reading.report`. Esta função só organiza para leitura o que já existe:
 *
 * - **Retrato do período (imutável):** indicadores, evidências,
 *   interpretações, hipóteses, recomendações e propostas do próprio
 *   `ExecutiveReport`; comparação com o período anterior canônico
 *   (`compareExecutions`, Mission 085); leitura da Executive AI ligada a
 *   esta execução (`execution_id`), gerada uma vez e nunca refeita aqui.
 * - **Ciclo de decisão (derivado na leitura, D-085):** decisões, execução,
 *   resultados e aprendizados ligados por linhagem
 *   (`selectReportLineage`) — o estado é o de `stateAsOf`, como em toda a
 *   Central de Decisões.
 *
 * Nenhum número é calculado: valores, variações e classificações vêm dos
 * Engines e das funções canônicas de apresentação (`describeMetricChange`,
 * `formatMetricValue`). Nenhuma chamada de IA. Nada é escrito. Função pura.
 */

export interface ReportReadingInputs {
  /** Histórico canônico da empresa (`getHistory`, ordem `executedAt`/`executionId`). */
  readonly history: readonly HistoricalExecution[];
  readonly current: HistoricalExecution;
  readonly diagnoses: readonly PersistedExecutiveDiagnosis[];
  readonly reviewsByDiagnosis: Readonly<Record<string, readonly PersistedDiagnosisReview[]>>;
  readonly decisions: readonly PersistedDecision[];
  readonly executionEvents: readonly DecisionExecutionEvent[];
  readonly outcomes: readonly Outcome[];
  readonly financialObservations: readonly FinancialOutcomeObservation[];
  readonly learningRecords: readonly LearningRecord[];
  readonly knowledge: readonly Knowledge[];
  /** Instante a que se refere o estado derivado do ciclo de decisão. */
  readonly stateAsOf: string;
}

export interface EvidenceEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severityLabel: string;
  readonly confidenceLabel: string;
  /** Indicador que originou a evidência (`supportingData.indicatorName`), quando houver. */
  readonly indicatorName?: string;
  readonly observedPeriod?: PeriodLabel;
}

export interface InferenceEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly qualifiers: readonly string[];
  /** Nomes das evidências/interpretações em que se apoia (resolvidos no próprio relatório). */
  readonly basis: readonly string[];
}

export interface RecommendationEntry extends InferenceEntry {
  readonly expectedImpact: string;
}

export interface GovernedRecommendationEntry {
  readonly recommendationId: string;
  readonly statement: string;
  readonly categoryLabel: string;
  readonly stateLabel: string;
  readonly rank?: number;
}

export interface FocusIndicator {
  readonly indicator: Indicator;
  readonly valueText?: string;
  readonly change?: MetricChangePresentation;
  readonly citedBy: readonly string[];
}

export interface ScenarioEntry {
  readonly decisionId: string;
  readonly decisionTitle: string;
  readonly assumption: string;
  readonly alternative?: string;
  readonly period: PeriodLabel;
  readonly metricKeys: readonly string[];
  readonly comparison: Readonly<Record<string, ScenarioMetricComparison>>;
}

export interface ExpectedObservedRow {
  readonly label: string;
  readonly expectedText?: string;
  readonly observedText?: string;
  readonly alignmentLabel?: string;
}

export interface FormalResult {
  readonly observedPeriod?: PeriodLabel;
  readonly rows: readonly ExpectedObservedRow[];
  readonly disclaimer: string;
}

export interface DecisionEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly rationale: string;
  readonly originLabel: string;
  readonly decidedAt: string;
  readonly priorityLabel: string;
  readonly statusLabel: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly targetDate?: string;
  readonly outcomes: readonly {
    readonly id: string;
    readonly statusLabel: string;
    readonly description: string;
    readonly observedAt: string;
    readonly expectedResult?: string;
  }[];
  readonly formalResult?: FormalResult;
}

export interface OutcomeInPeriodEntry {
  readonly observationId: string;
  readonly decisionTitle: string;
  readonly decidedAt?: string;
  readonly baselinePeriod?: PeriodLabel;
  readonly observationPeriod?: PeriodLabel;
  readonly computedAt: string;
  readonly metrics: readonly { readonly name: string; readonly beforeText: string; readonly afterText: string; readonly change: MetricChangePresentation }[];
  readonly formalResult?: FormalResult;
}

export interface KnowledgeEntry {
  readonly id: string;
  readonly statement: string;
  readonly categoryLabel: string;
  readonly formedAt: string;
  readonly originDecisions: readonly string[];
}

export type UnknownKind = "indicator" | "comparison" | "stage" | "ai" | "result";

export interface UnknownEntry {
  readonly id: string;
  readonly kind: UnknownKind;
  readonly text: string;
}

export interface StatementAnnex {
  readonly type: "balanceSheet" | "incomeStatement" | "cashFlow";
  readonly title: string;
  readonly periodLabel?: string;
  readonly records: readonly NormalizedFinancialRecord[];
}

export interface ReportReading {
  /** O contrato canônico — nunca copiado, nunca recalculado. */
  readonly report: ExecutiveReport;
  readonly companyId: string;
  readonly executionId: string;
  readonly executedAt: string;
  readonly generatedAt: string;
  readonly stateAsOf: string;
  readonly period?: Period;
  readonly periodLabel?: PeriodLabel;
  readonly comparison: ReportComparison;
  readonly comparisonLabel?: PeriodLabel;
  readonly version: ReportVersion;
  readonly situation?: ExecutiveSituation;
  readonly signalCounts: { readonly attention: number; readonly favorable: number; readonly information: number };
  readonly indicatorCounts: { readonly total: number; readonly unavailable: number };
  readonly movement: readonly MetricChangePresentation[];
  readonly unchangedMetrics: readonly string[];
  readonly availabilityChanges: readonly MetricChangePresentation[];
  readonly focusIndicators: readonly FocusIndicator[];
  readonly evidence: {
    readonly attention: readonly EvidenceEntry[];
    readonly favorable: readonly EvidenceEntry[];
    readonly information: readonly EvidenceEntry[];
  };
  readonly interpretations: readonly InferenceEntry[];
  readonly hypotheses: readonly InferenceEntry[];
  readonly aiReading?: {
    readonly diagnosis: PersistedExecutiveDiagnosis;
    readonly readingsCount: number;
    readonly references: ReferenceLabels;
  };
  readonly recommendations: readonly RecommendationEntry[];
  readonly proposals: readonly InferenceEntry[];
  readonly governedRecommendations: readonly GovernedRecommendationEntry[];
  readonly scenarios: readonly ScenarioEntry[];
  readonly decisions: readonly DecisionEntry[];
  readonly outcomesInPeriod: readonly OutcomeInPeriodEntry[];
  readonly knowledge: readonly KnowledgeEntry[];
  readonly unknowns: readonly UnknownEntry[];
  readonly annex: { readonly indicators: readonly Indicator[]; readonly statements: readonly StatementAnnex[] };
}

function sectionOf<T extends ExecutiveReportSection["type"]>(
  report: ExecutiveReport,
  type: T
): Extract<ExecutiveReportSection, { type: T }> | undefined {
  return report.sections.find((section): section is Extract<ExecutiveReportSection, { type: T }> => section.type === type);
}

const PIPELINE_STAGES: readonly { readonly type: ExecutiveReportSection["type"]; readonly label: string }[] = [
  { type: "indicators", label: "indicadores" },
  { type: "evidence", label: "evidências" },
  { type: "context", label: "interpretações" },
  { type: "reasoning", label: "hipóteses" },
  { type: "recommendation", label: "recomendações" },
];


const DESIRABILITY_ORDER: Readonly<Record<MetricChangePresentation["desirability"], number>> = {
  unfavorable: 0,
  favorable: 1,
  neutral: 2,
};
const ACTIONABLE_CATEGORIES = new Set(["priorities", "possibleActions"]);

function efosConfidence(confidence: string): string {
  return `Confiança do EFOS: ${levelLabel(confidence)}`;
}

/**
 * Nome do indicador citado pela evidência. A Evidence absoluta grava o nome
 * ("Margem Líquida"); a temporal grava a chave da métrica ("net-margin",
 * D-087) — traduzida pelo dicionário canônico (`translateMetricKey`), nunca
 * por um segundo mapa.
 */
function evidenceIndicatorName(evidence: Evidence): string | undefined {
  const value = evidence.supportingData.indicatorName;
  return typeof value === "string" ? translateMetricKey(value) : undefined;
}

function evidenceEntry(evidence: Evidence): EvidenceEntry {
  return {
    id: evidence.id,
    title: formatEngineText(evidence.title),
    description: formatEngineText(evidence.description),
    severityLabel: severityTag(evidence.severity).label,
    confidenceLabel: efosConfidence(evidence.confidence),
    indicatorName: evidenceIndicatorName(evidence),
    observedPeriod: evidence.observedPeriod ? formatPeriodLabel(evidence.observedPeriod) : undefined,
  };
}

function resolveTitles(ids: readonly string[], titles: ReadonlyMap<string, string>): string[] {
  return [...new Set(ids.flatMap((id) => (titles.has(id) ? [titles.get(id) as string] : [])))];
}

function formalResultOf(
  link: Pick<ReportDecisionLink, "decision">,
  history: readonly HistoricalExecution[],
  observations: readonly FinancialOutcomeObservation[]
): FormalResult | undefined {
  const bundle = resolveExpectedActualComparison(link.decision.decision, history, observations);
  const formal = bundle.formal;
  if (formal?.outcome !== "built" || formal.comparison.eligibility !== "comparable") return undefined;
  return {
    observedPeriod: formal.comparison.observedPeriod ? formatPeriodLabel(formal.comparison.observedPeriod) : undefined,
    rows: formal.comparison.metrics.map((metric) =>
      metric.status === "compared"
        ? {
            label: metric.label,
            expectedText: formatMetricValue(metric.expectedValue, metric.unit),
            observedText: formatMetricValue(metric.observedValue, metric.unit),
            alignmentLabel: EXPECTED_ACTUAL_ALIGNMENT_LABELS[metric.expectationAlignment],
          }
        : { label: metric.label }
    ),
    disclaimer: formal.comparison.disclaimer,
  };
}

export function buildReportReading(inputs: ReportReadingInputs): ReportReading | undefined {
  const { current, history } = inputs;
  const report = current.report;
  if (!report) return undefined;
  const companyId = current.companyId;
  const scopedHistory = history.filter((execution) => execution.companyId === companyId);

  const period = reportPeriodOf(current);
  const comparison = selectReportComparison(scopedHistory, current);
  const baseline = comparison.outcome === "resolved" ? comparison.baseline : undefined;
  const situation = buildExecutiveSituationFor(current, baseline, scopedHistory.length);

  const indicators = sectionOf(report, "indicators")?.indicators.indicators ?? [];
  const evidences = sectionOf(report, "evidence")?.evidence.evidences ?? [];
  const contexts = sectionOf(report, "context")?.context.contexts ?? [];
  const reasonings = sectionOf(report, "reasoning")?.reasoning.reasonings ?? [];
  const recommendations = sectionOf(report, "recommendation")?.recommendation.recommendations ?? [];
  const proposals = sectionOf(report, "decision")?.decision.decisions ?? [];

  const titles = new Map<string, string>([
    ...evidences.map((evidence) => [evidence.id, formatEngineText(evidence.title)] as const),
    ...contexts.map((context) => [context.id, formatEngineText(context.title)] as const),
    ...reasonings.map((reasoning) => [reasoning.id, formatEngineText(reasoning.title)] as const),
  ]);

  // Movimento: só o que a comparação canônica já classificou.
  const changes = comparison.outcome === "resolved" ? comparison.comparison.metrics.map((metric) => ({ metric, change: describeMetricChange(metric) })) : [];
  const movement = changes
    .filter(({ metric }) => metric.direction === "increased" || metric.direction === "decreased")
    .map(({ change }) => change)
    .sort((a, b) => DESIRABILITY_ORDER[a.desirability] - DESIRABILITY_ORDER[b.desirability]);
  const unchangedMetrics = changes.filter(({ metric }) => metric.direction === "unchanged").map(({ metric }) => metric.metricName);
  const availabilityChanges = changes
    .filter(({ metric }) => metric.direction === "became-available" || metric.direction === "became-unavailable")
    .map(({ change }) => change);
  const changeByName = new Map(changes.map(({ metric, change }) => [metric.metricName, change] as const));

  // Indicadores em foco: os que as evidências do período citam.
  const citations = new Map<string, string[]>();
  for (const evidence of evidences) {
    const name = evidenceIndicatorName(evidence);
    if (!name) continue;
    citations.set(name, [...(citations.get(name) ?? []), formatEngineText(evidence.title)]);
  }
  const focusIndicators: FocusIndicator[] = [...citations.entries()].flatMap(([name, citedBy]) => {
    const indicator = indicators.find((candidate) => candidate.name === name);
    if (!indicator) return [];
    return [
      {
        indicator,
        valueText: indicator.result.status === "available" ? formatMetricValue(indicator.result.value, indicator.unit) : undefined,
        change: changeByName.get(name),
        citedBy,
      },
    ];
  });

  const sortedEvidence = [...evidences].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  const evidence = {
    attention: sortedEvidence.filter((item) => item.type === "negative" || item.type === "warning").map(evidenceEntry),
    favorable: sortedEvidence.filter((item) => item.type === "positive").map(evidenceEntry),
    information: sortedEvidence.filter((item) => item.type === "information").map(evidenceEntry),
  };

  const lineage = selectReportLineage({
    current,
    diagnoses: inputs.diagnoses,
    decisions: inputs.decisions,
    financialObservations: inputs.financialObservations,
    outcomes: inputs.outcomes,
    learningRecords: inputs.learningRecords,
    knowledge: inputs.knowledge,
  });
  const latestDiagnosis = lineage.diagnoses[0];

  const linkedDecisionIds = new Set([...lineage.decisions.map((link) => link.decision.id), ...lineage.observedDecisions.map((decision) => decision.id)]);
  const executionEvents = inputs.executionEvents.filter((event) => event.companyId === companyId && linkedDecisionIds.has(event.decisionId));
  const outcomes = inputs.outcomes.filter((outcome) => outcome.companyId === companyId && linkedDecisionIds.has(outcome.decisionId));
  const observations = inputs.financialObservations.filter((observation) => observation.companyId === companyId);
  const observationsOf = (decisionId: string) =>
    observations
      .filter((observation) => observation.decisionId === decisionId)
      .sort((a, b) => b.computedAt.localeCompare(a.computedAt));

  // Encaminhamento das prioridades/ações da leitura da IA: o estado de
  // governança canônico (Mission 154/179), derivado agora.
  const governedRecommendations: GovernedRecommendationEntry[] = latestDiagnosis
    ? buildDecisionCenterQueue({
        companyId,
        diagnoses: [latestDiagnosis],
        reviewsByDiagnosis: inputs.reviewsByDiagnosis,
        decisions: inputs.decisions.filter((decision) => decision.companyId === companyId),
        executionEvents,
        outcomes,
        learningRecords: inputs.learningRecords.filter((record) => record.companyId === companyId),
        knowledgeRecords: inputs.knowledge.filter((record) => record.companyId === companyId),
        financialObservations: observations,
      })
        .filter((item) => ACTIONABLE_CATEGORIES.has(item.category))
        .map((item) => ({
          recommendationId: item.recommendationId,
          statement: item.statement,
          categoryLabel: RECOMMENDATION_CATEGORY_LABELS[item.category],
          stateLabel: item.governance.lifecycleState ? GOVERNANCE_LIFECYCLE_LABELS[item.governance.lifecycleState] : GOVERNANCE_LIFECYCLE_LABELS.NOT_REVIEWED,
          rank: item.rank,
        }))
    : [];

  const referenceStatements = new Map(
    lineage.diagnoses.flatMap((persisted) =>
      listRecommendationReferences(persisted.diagnosis).map((reference) => [reference.recommendationId, reference] as const)
    )
  );

  const scenarios: ScenarioEntry[] = lineage.decisions.flatMap((link) =>
    link.origin.kind === "scenario"
      ? [
          {
            decisionId: link.decision.id,
            decisionTitle: link.decision.decision.title,
            assumption: describeScenarioAssumption(link.origin.scenario.assumption),
            alternative: link.origin.scenario.alternative ? describeScenarioAssumption(link.origin.scenario.alternative.assumption) : undefined,
            period: formatPeriodLabel(link.origin.scenario.period),
            metricKeys: link.origin.scenario.comparison.map((entry) => entry.metricKey),
            comparison: Object.fromEntries(link.origin.scenario.comparison.map((entry) => [entry.metricKey, entry])),
          },
        ]
      : []
  );

  const decisions: DecisionEntry[] = lineage.decisions.map((link) => {
    const { decision } = link.decision;
    const state = deriveDecisionExecutionState(executionEvents.filter((event) => event.decisionId === link.decision.id));
    let originLabel: string;
    if (link.origin.kind === "scenario") {
      originLabel = `Cenário avaliado no Scenario Lab: ${describeScenarioAssumption(link.origin.scenario.assumption)}`;
    } else {
      const reference = decision.basedOnRecommendationId ? referenceStatements.get(decision.basedOnRecommendationId) : undefined;
      originLabel = reference
        ? `${RECOMMENDATION_CATEGORY_LABELS[reference.category]} da leitura da Executive AI: ${reference.statement}`
        : "Leitura da Executive AI desta análise";
    }
    return {
      id: link.decision.id,
      title: decision.title,
      description: decision.description,
      rationale: decision.rationale,
      originLabel,
      decidedAt: link.decision.createdAt,
      priorityLabel: DECISION_PRIORITY_LABELS[decision.priority],
      statusLabel: DECISION_EXECUTION_STATUS_LABELS[state.status],
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      targetDate: state.targetDate,
      outcomes: outcomes
        .filter((outcome) => outcome.decisionId === link.decision.id)
        .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
        .map((outcome) => ({
          id: outcome.id,
          statusLabel: OUTCOME_STATUS_LABELS[outcome.status],
          description: outcome.description,
          observedAt: outcome.observedAt,
          expectedResult: outcome.expectedResult,
        })),
      formalResult: link.origin.kind === "scenario" ? formalResultOf(link, scopedHistory, observationsOf(link.decision.id)) : undefined,
    };
  });

  const unitByName = new Map(indicators.map((indicator) => [indicator.name, indicator.unit] as const));
  const decisionById = new Map(inputs.decisions.filter((decision) => decision.companyId === companyId).map((decision) => [decision.id, decision] as const));
  const outcomesInPeriod: OutcomeInPeriodEntry[] = lineage.observationsInPeriod.map((observation) => {
    const decision = decisionById.get(observation.decisionId);
    return {
      observationId: observation.id,
      decisionTitle: decision?.decision.title ?? "Decisão registrada",
      decidedAt: decision?.createdAt,
      baselinePeriod: observation.window.baselinePeriod ? formatPeriodLabel(observation.window.baselinePeriod) : undefined,
      observationPeriod: observation.window.observationPeriod ? formatPeriodLabel(observation.window.observationPeriod) : undefined,
      computedAt: observation.computedAt,
      metrics: observation.metrics.map((metric) => {
        const unit = unitByName.get(metric.metricName);
        return {
          name: metric.metricName,
          beforeText: formatMetricValue(metric.beforeValue, unit),
          afterText: formatMetricValue(metric.afterValue, unit),
          change: describeMetricChange({
            metricName: metric.metricName,
            previousValue: metric.beforeValue,
            currentValue: metric.afterValue,
            absoluteChange: metric.absoluteChange,
            direction: metric.direction,
            unit,
          }),
        };
      }),
      formalResult: decision ? formalResultOf({ decision }, scopedHistory, [observation]) : undefined,
    };
  });

  const decisionTitles = new Map([...decisionById.values()].map((decision) => [decision.id, decision.decision.title] as const));
  const learningById = new Map(inputs.learningRecords.filter((record) => record.companyId === companyId).map((record) => [record.id, record] as const));
  const knowledge: KnowledgeEntry[] = lineage.knowledge.map((record) => ({
    id: record.id,
    statement: record.statement,
    categoryLabel: KNOWLEDGE_CATEGORY_LABELS[record.category] ?? record.category,
    formedAt: record.audit.createdAt,
    originDecisions: [
      ...new Set(
        (record.derivedFromLearningRecordIds ?? []).flatMap((id) =>
          (learningById.get(id)?.decisions ?? []).flatMap((decisionId) => (decisionTitles.has(decisionId) ? [decisionTitles.get(decisionId) as string] : []))
        )
      ),
    ],
  }));

  // O que não se sabe — só ausências reais e explícitas.
  const unknowns: UnknownEntry[] = [];
  const unavailableNames = indicators.filter((indicator) => indicator.result.status === "unavailable").map((indicator) => indicator.name);
  if (unavailableNames.length === 1) {
    unknowns.push({ id: "indicators", kind: "indicator", text: `${unavailableNames[0]}: indisponível — dados insuficientes no período para calcular.` });
  } else if (unavailableNames.length > 1) {
    unknowns.push({
      id: "indicators",
      kind: "indicator",
      text: `${unavailableNames.length} indicadores indisponíveis — dados insuficientes no período para calcular: ${unavailableNames.join(", ")}.`,
    });
  }
  if (comparison.outcome === "first-period") {
    unknowns.push({ id: "comparison", kind: "comparison", text: "Não há período anterior analisado: o movimento financeiro ainda não pode ser medido." });
  } else if (comparison.outcome === "ambiguous") {
    unknowns.push({
      id: "comparison",
      kind: "comparison",
      text: "O histórico anterior não tem uma versão única defensável (reanálises divergentes ou período indeterminável): a comparação não é exibida.",
    });
  } else if (comparison.outcome === "unpositioned") {
    unknowns.push({ id: "comparison", kind: "comparison", text: "O período desta análise não pôde ser determinado: não há comparação nem posição no histórico." });
  }
  const missingStages = PIPELINE_STAGES.filter((stage) => !sectionOf(report, stage.type)).map((stage) => stage.label);
  if (missingStages.length > 0) {
    unknowns.push({ id: "stages", kind: "stage", text: `A análise não chegou a produzir: ${missingStages.join(", ")}.` });
  }
  if (!latestDiagnosis) {
    unknowns.push({ id: "ai", kind: "ai", text: "Nenhuma leitura da Executive AI foi gerada para esta análise." });
  } else if (latestDiagnosis.diagnosis.questions.length + latestDiagnosis.diagnosis.uncertainties.length > 0) {
    const count = latestDiagnosis.diagnosis.questions.length + latestDiagnosis.diagnosis.uncertainties.length;
    unknowns.push({
      id: "ai",
      kind: "ai",
      text: `A leitura da Executive AI deixou ${count === 1 ? "uma pergunta ou incerteza" : `${count} perguntas e incertezas`} em aberto (na seção da leitura).`,
    });
  }
  const awaiting = decisions.filter((entry) => entry.outcomes.length === 0 && !entry.formalResult).length;
  if (awaiting > 0) {
    unknowns.push({
      id: "results",
      kind: "result",
      text: awaiting === 1 ? "Uma decisão deste relatório ainda não tem resultado registrado." : `${awaiting} decisões deste relatório ainda não têm resultado registrado.`,
    });
  }

  const statements: StatementAnnex[] = [];
  const balanceSheet = sectionOf(report, "balanceSheet");
  if (balanceSheet) {
    const records = balanceSheet.balanceSheet.filter(isBalanceSheetRecord);
    statements.push({ type: "balanceSheet", title: balanceSheet.title, periodLabel: derivePeriodLabel(records), records });
  }
  const incomeStatement = sectionOf(report, "incomeStatement");
  if (incomeStatement) {
    statements.push({ type: "incomeStatement", title: incomeStatement.title, periodLabel: derivePeriodLabel(incomeStatement.incomeStatement), records: incomeStatement.incomeStatement });
  }
  const cashFlow = sectionOf(report, "cashFlow");
  if (cashFlow) {
    statements.push({ type: "cashFlow", title: cashFlow.title, records: cashFlow.cashFlow });
  }

  return {
    report,
    companyId,
    executionId: current.executionId,
    executedAt: current.executedAt,
    generatedAt: report.metadata.generatedAt,
    stateAsOf: inputs.stateAsOf,
    period,
    periodLabel: period ? formatPeriodLabel(period) : undefined,
    comparison,
    comparisonLabel: comparison.outcome === "resolved" ? formatPeriodLabel(comparison.baselinePeriod) : undefined,
    version: resolveReportVersion(scopedHistory, current),
    situation,
    signalCounts: { attention: evidence.attention.length, favorable: evidence.favorable.length, information: evidence.information.length },
    indicatorCounts: { total: indicators.length, unavailable: indicators.filter((indicator) => indicator.result.status === "unavailable").length },
    movement,
    unchangedMetrics,
    availabilityChanges,
    focusIndicators,
    evidence,
    interpretations: contexts.map((context) => ({
      id: context.id,
      title: formatEngineText(context.title),
      description: formatEngineText(context.description),
      qualifiers: [severityTag(context.severity).label, efosConfidence(context.confidence)],
      basis: resolveTitles(context.evidences, titles),
    })),
    hypotheses: reasonings.map((reasoning) => ({
      id: reasoning.id,
      title: formatEngineText(reasoning.title),
      description: formatEngineText(reasoning.description),
      qualifiers: [efosConfidence(reasoning.confidence)],
      basis: resolveTitles([...reasoning.contexts, ...reasoning.evidences], titles),
    })),
    aiReading: latestDiagnosis
      ? { diagnosis: latestDiagnosis, readingsCount: lineage.diagnoses.length, references: buildReferenceLabels(report, inputs.knowledge) }
      : undefined,
    recommendations: [...recommendations]
      .sort((a, b) => (SEVERITY_ORDER[a.priority] ?? 9) - (SEVERITY_ORDER[b.priority] ?? 9))
      .map((recommendation) => ({
        id: recommendation.id,
        title: formatEngineText(recommendation.title),
        description: formatEngineText(recommendation.description),
        expectedImpact: formatEngineText(recommendation.expectedImpact),
        qualifiers: [priorityTag(recommendation.priority).label, efosConfidence(recommendation.confidence)],
        basis: resolveTitles([...recommendation.reasonings, ...recommendation.contexts, ...recommendation.evidences], titles),
      })),
    proposals: proposals.map((proposal) => ({
      id: proposal.id,
      title: formatEngineText(proposal.title),
      description: formatEngineText(`${proposal.description} ${proposal.rationale}`),
      qualifiers: [DECISION_TYPE_LABELS[proposal.type], priorityTag(proposal.priority).label],
      basis: resolveTitles([...proposal.reasonings, ...proposal.contexts, ...proposal.evidences], titles),
    })),
    governedRecommendations,
    scenarios,
    decisions,
    outcomesInPeriod,
    knowledge,
    unknowns,
    annex: { indicators, statements },
  };
}
