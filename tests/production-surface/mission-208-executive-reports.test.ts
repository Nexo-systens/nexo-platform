import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { before, describe, test } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { DecisionExecutionEvent } from "@/efos/application/decision-execution";
import { deriveDecisionExecutionState } from "@/efos/application/decision-execution/deriveDecisionExecutionState";
import { createHumanDecision, type ScenarioDecisionContext } from "@/efos/application/decision-lifecycle";
import { DIAGNOSIS_BOUNDARIES, validateExecutiveDiagnosis, type ExecutiveDiagnosis } from "@/efos/application/executive-diagnosis";
import { buildFinancialOutcomeObservation, type FinancialOutcomeObservation } from "@/efos/application/financial-observation";
import {
  compareExecutions,
  resolvePeriodVersion,
  resolvePreviousPeriodComparison,
  type HistoricalExecution,
} from "@/efos/application/history";
import type { ExecutiveReport } from "@/efos/application/report";
import { simulateOperatingCostScenario } from "@/efos/application/scenario-simulation";
import type { Decision, Knowledge, LearningRecord, Outcome } from "@/efos/domain";
import { periodOf } from "@/efos/engines/evidence";
import { describeMetricChange, formatMetricValue } from "@/modules/analysis/lib/metric-change";
import { resolveDecisionFinancialBase } from "@/modules/decisions/lib/resolveDecisionFinancialBase";
import { resolveCurrentFinancialExecution } from "@/modules/decisions/lib/selectCurrentFinancialExecution";
import type { PersistedDecision } from "@/modules/decisions/services/decision-persistence.service";
import type { PersistedExecutiveDiagnosis } from "@/modules/decisions/services/executive-diagnosis-persistence.service";
import { ReportDocument } from "@/modules/reports/components/ReportDocument";
import { buildReportIndex } from "@/modules/reports/lib/report-index";
import { selectReportLineage } from "@/modules/reports/lib/report-lineage";
import { buildReportReading, type ReportReading, type ReportReadingInputs } from "@/modules/reports/lib/report-reading";
import { fingerprintFinancialModel } from "@/modules/scenarios/lib/scenarioBaselineIdentity";
import { workspaceNavigation } from "@/modules/workspace/config/navigation";

import {
  buildDivergentJuly,
  buildFixtureHistories,
  buildReanalysis,
  FIXTURE_COMPANIES,
  type FixtureHistories,
} from "./fixtures/report-fixtures";

/**
 * Mission 208 — Governed Executive Reports (D-133).
 *
 * O relatório é o `ExecutiveReport` de uma execução (contrato único,
 * persistido e imutável — D-038/D-043). A leitura executiva
 * (`buildReportReading`) só organiza o que existe e liga o ciclo de
 * decisão por linhagem. Fixtures produzidas pelo pipeline real
 * (`fixtures/report-fixtures.ts`): A saudável, B em deterioração, C com
 * ciclo de decisão, D com dados incompletos. Sem rede, sem IA, sem banco.
 */

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const STATE_AS_OF = "2026-10-03T12:00:00.000Z";
const OTHER_COMPANY = "m208-outra-empresa";
const ACTOR = "m208-conta-da-empresa";

const EMPTY_INPUTS = {
  diagnoses: [],
  reviewsByDiagnosis: {},
  decisions: [],
  executionEvents: [],
  outcomes: [],
  financialObservations: [],
  learningRecords: [],
  knowledge: [],
  stateAsOf: STATE_AS_OF,
} satisfies Omit<ReportReadingInputs, "history" | "current">;

function readingFor(
  history: readonly HistoricalExecution[],
  current: HistoricalExecution,
  extra: Partial<ReportReadingInputs> = {}
): ReportReading {
  const reading = buildReportReading({ ...EMPTY_INPUTS, history, current, ...extra });
  assert.ok(reading, "o relatório deve existir para uma execução com ExecutiveReport");
  return reading;
}

function renderText(reading: ReportReading): string {
  const html = renderToStaticMarkup(
    createElement(ReportDocument, { company: { id: reading.companyId, razao_social: "EMPRESA SINTÉTICA M208", cnpj: "11222333000181" }, reading })
  );
  return html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
}

function indicatorsOf(report: ExecutiveReport) {
  const section = report.sections.find((candidate) => candidate.type === "indicators");
  assert.ok(section?.type === "indicators");
  return section.indicators.indicators;
}

const entity = (createdAt: string) => ({
  provenance: { source: "m208-fixture", confidence: { value: 70, level: "moderate" as const } },
  audit: { createdAt, updatedAt: createdAt, version: 1 },
});

function persist(decision: Decision, diagnosisId: string | null = null): PersistedDecision {
  return {
    id: decision.id,
    companyId: decision.companyId,
    diagnosisId,
    reviewId: null,
    humanActorId: ACTOR,
    decision,
    createdAt: decision.audit.createdAt,
  };
}

interface Lifecycle {
  readonly july: HistoricalExecution;
  readonly august: HistoricalExecution;
  readonly inputs: Omit<ReportReadingInputs, "history" | "current">;
  readonly diagnosis: PersistedExecutiveDiagnosis;
  readonly costDecision: PersistedDecision;
  readonly scenarioDecision: PersistedDecision;
  readonly observation: FinancialOutcomeObservation;
}

/**
 * Empresa C: leitura da IA sobre julho → decisão humana a partir da
 * prioridade 1 → execução concluída → resultado registrado → observação
 * financeira canônica (julho → agosto) → aprendizado → conhecimento. Em
 * agosto, um cenário do Scenario Lab vira decisão. Objetos de OUTRA
 * empresa reaproveitam os mesmos ids de execução/diagnóstico de propósito.
 */
function buildLifecycle(histories: FixtureHistories): Lifecycle {
  const companyId = FIXTURE_COMPANIES.lifecycle;
  const [july, august] = histories.lifecycle;
  const julyNetMargin = indicatorsOf(july.report!).find((indicator) => indicator.name === "Margem Líquida")!;

  const diagnosis: ExecutiveDiagnosis = {
    id: "m208-diagnostico-julho",
    basedOn: { generatedAt: "2026-08-06T10:00:00.000Z" },
    executiveSummary: {
      statement: "A empresa fechou julho de 2026 com Margem Líquida de 22,16%, ainda positiva, mas com despesas financeiras relevantes.",
      basis: { indicatorIds: [julyNetMargin.id] },
    },
    interpretations: [],
    hypotheses: [
      {
        id: "m208-hipotese-1",
        statement: "A pressão de custos pode reduzir a margem nos próximos meses.",
        basis: { indicatorIds: [julyNetMargin.id] },
        confidence: "low",
        validationNeeded: "Confirmar com a DRE do mês seguinte.",
      },
    ],
    risks: [],
    priorities: [
      { id: "m208-prioridade-1", rank: 1, statement: "Revisar os custos operacionais.", reason: "Proteger a margem.", basis: { indicatorIds: [julyNetMargin.id] } },
    ],
    possibleActions: [
      { id: "m208-acao-1", kind: "INVESTIGATE", statement: "Investigar a composição das despesas financeiras.", basis: { indicatorIds: [julyNetMargin.id] } },
    ],
    questions: [{ id: "m208-pergunta-1", question: "Qual parte das despesas financeiras é recorrente?", raisedFrom: "uncertainty" }],
    uncertainties: [],
    conflictInterpretations: [],
    boundaries: DIAGNOSIS_BOUNDARIES,
  };
  assert.deepEqual(validateExecutiveDiagnosis(diagnosis).errors, [], "a fixture de diagnóstico precisa ser válida pelo contrato");
  const persistedDiagnosis: PersistedExecutiveDiagnosis = {
    id: diagnosis.id,
    companyId,
    executionId: july.executionId,
    diagnosis,
    providerName: "m208-fixture",
    createdAt: "2026-08-06T10:00:00.000Z",
  };

  const cost = createHumanDecision(
    {
      humanActorId: ACTOR,
      diagnosisId: diagnosis.id,
      recommendationId: "m208-prioridade-1",
      companyId,
      type: "execute_immediately",
      priority: "high",
      confidence: "medium",
      title: "Revisar os custos operacionais",
      description: "Renegociar contratos administrativos e de vendas.",
      rationale: "A margem precisa ser protegida antes do próximo trimestre.",
    },
    "m208-decisao-custos",
    "2026-08-10T12:00:00.000Z"
  );
  assert.ok(cost.success);
  const costDecision = persist(cost.value, diagnosis.id);

  const events: DecisionExecutionEvent[] = [
    { id: "m208-evento-1", decisionId: costDecision.id, companyId, status: "IN_PROGRESS", actorId: ACTOR, occurredAt: "2026-08-12T12:00:00.000Z" },
    { id: "m208-evento-2", decisionId: costDecision.id, companyId, status: "COMPLETED", actorId: ACTOR, occurredAt: "2026-08-25T12:00:00.000Z" },
  ];
  const outcome: Outcome = {
    id: "m208-resultado-1",
    companyId,
    decisionId: costDecision.id,
    status: "positive",
    observedAt: "2026-09-06T12:00:00.000Z",
    description: "Contratos administrativos renegociados.",
    recordedBy: ACTOR,
    ...entity("2026-09-06T12:00:00.000Z"),
  };
  // Mission 211 (D-136): base pela linhagem (diagnóstico de julho) e observação pela verdade atual canônica (agosto).
  const { base } = resolveDecisionFinancialBase({
    decision: cost.value,
    decisionCreatedAt: costDecision.createdAt,
    diagnosisId: diagnosis.id,
    diagnosis: { id: diagnosis.id, companyId, executionId: july.executionId },
    history: histories.lifecycle,
  });
  const observationResult = buildFinancialOutcomeObservation(
    { id: costDecision.id, companyId, createdAt: costDecision.createdAt },
    deriveDecisionExecutionState(events),
    base,
    resolveCurrentFinancialExecution(companyId, histories.lifecycle),
    outcome.id,
    ACTOR,
    "m208-observacao-1",
    "2026-09-06T13:00:00.000Z"
  );
  assert.ok(observationResult.success, "a observação financeira canônica deve existir (julho → agosto)");
  const observation = observationResult.value;

  const learning: LearningRecord = {
    id: "m208-aprendizado-1",
    companyId,
    type: "observation",
    confidence: "medium",
    title: "Revisão de custos e margem",
    description: "Resultado registrado após a revisão de custos.",
    source: "user_feedback",
    decisions: [costDecision.id],
    recommendations: [],
    reasonings: [],
    contexts: [],
    evidences: [],
    supportingData: {},
    outcomeIds: [outcome.id],
    ...entity("2026-09-07T12:00:00.000Z"),
  };
  const knowledge: Knowledge = {
    id: "m208-conhecimento-1",
    companyId,
    category: "accumulated_learning",
    statement: "Nesta empresa, revisões de custo foram seguidas de margem menor no período seguinte.",
    derivedFromOutcomeIds: [],
    derivedFromLearningRecordIds: [learning.id],
    ...entity("2026-09-08T12:00:00.000Z"),
  };

  const augustModel = august.snapshot.execution.financialModel!;
  const augustPeriod = periodOf(august.snapshot.execution.indicators!)!;
  const assumption = {
    kind: "operating_cost_change" as const,
    scenarioType: "adjust_operating_costs" as const,
    operatingExpensesDelta: { amount: -60000, currency: "BRL" },
  };
  const simulation = simulateOperatingCostScenario(companyId, augustModel, augustPeriod, assumption);
  assert.equal(simulation.outcome, "simulated");
  if (simulation.outcome !== "simulated") throw new Error("simulação");
  const scenarioContext: ScenarioDecisionContext = {
    nature: "hypothetical",
    scenarioType: "adjust_operating_costs",
    assumption,
    period: augustPeriod,
    comparison: simulation.projection.comparison,
    baselineFingerprint: fingerprintFinancialModel(augustModel),
  };
  const scenario = createHumanDecision(
    {
      humanActorId: ACTOR,
      scenarioContext,
      companyId,
      type: "prioritize_sequence",
      priority: "high",
      confidence: "medium",
      title: "Reduzir despesas operacionais em R$ 60 mil",
      description: "Corte de despesas administrativas.",
      rationale: "Recuperar a margem operacional de agosto.",
    },
    "m208-decisao-cenario",
    "2026-09-10T12:00:00.000Z"
  );
  assert.ok(scenario.success);
  const scenarioDecision = persist(scenario.value);

  // Objetos de OUTRA empresa com os mesmos vínculos — nunca podem aparecer.
  const foreignDiagnosis: PersistedExecutiveDiagnosis = {
    ...persistedDiagnosis,
    id: "m208-diagnostico-estrangeiro",
    companyId: OTHER_COMPANY,
    executionId: august.executionId,
  };
  const foreignDecision = persist({ ...cost.value, id: "m208-decisao-estrangeira", companyId: OTHER_COMPANY }, diagnosis.id);
  const foreignObservation: FinancialOutcomeObservation = { ...observation, id: "m208-observacao-estrangeira", companyId: OTHER_COMPANY };
  const foreignKnowledge: Knowledge = { ...knowledge, id: "m208-conhecimento-estrangeiro", companyId: OTHER_COMPANY };

  return {
    july,
    august,
    diagnosis: persistedDiagnosis,
    costDecision,
    scenarioDecision,
    observation,
    inputs: {
      diagnoses: [persistedDiagnosis, foreignDiagnosis],
      reviewsByDiagnosis: {},
      decisions: [costDecision, scenarioDecision, foreignDecision],
      executionEvents: events,
      outcomes: [outcome],
      financialObservations: [observation, foreignObservation],
      learningRecords: [learning],
      knowledge: [knowledge, foreignKnowledge],
      stateAsOf: STATE_AS_OF,
    },
  };
}

let histories: FixtureHistories;
let lifecycle: Lifecycle;

before(async () => {
  histories = await buildFixtureHistories();
  lifecycle = buildLifecycle(histories);
});

describe("Mission 208 — uma única autoridade de relatório", () => {
  test("a leitura carrega o ExecutiveReport canônico por referência — nunca uma cópia ou um segundo modelo", () => {
    const current = histories.deteriorating.at(-1)!;
    const reading = readingFor(histories.deteriorating, current);
    assert.equal(reading.report, current.report);
    assert.equal(reading.executionId, current.executionId);
    assert.equal(reading.generatedAt, current.report!.metadata.generatedAt);
  });

  test("modules/reports não declara outro contrato de relatório, não gera relatório e não escreve nada", () => {
    const files = listFiles(join(ROOT, "modules", "reports")).filter((file) => /\.(ts|tsx)$/.test(file));
    assert.ok(files.length > 0);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /interface ExecutiveReport\b|type ExecutiveReport\b|ExecutiveReportV2|NewExecutiveReport/, file);
      assert.doesNotMatch(source, /DefaultReportService|generateReport\(|\.execute\(/, `${file}: o relatório nunca é gerado aqui`);
      assert.doesNotMatch(source, /\.(insert|update|upsert|delete)\(/, `${file}: leitura apenas`);
      assert.doesNotMatch(source, /SERVICE_ROLE_KEY|auth\.admin|createAdminClient/, file);
    }
  });

  test("nenhuma chamada de IA: o relatório reutiliza a leitura já persistida", () => {
    for (const file of listFiles(join(ROOT, "modules", "reports"))) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /@\/lib\/ai|anthropic|executeExecutiveAnalysis|createExecutiveAIProvider|executeExecutiveChat/i, file);
    }
  });

  test("nenhuma migration nova: os relatórios já existem em public.executions", () => {
    const migrations = readdirSync(join(ROOT, "supabase", "migrations")).filter((name) => name.endsWith(".sql"));
    // 18 até a Mission 208; a única posterior é a idempotência de decisão
    // (Migration 019, Mission 214, D-137), que não toca relatório.
    assert.equal(migrations.filter((name) => name !== "20261008120000_decision_idempotency.sql").length, 18);
    assert.ok(!migrations.some((name) => /report/i.test(name)));
  });
});

describe("Mission 208 — verdade do relatório (D-118/D-119)", () => {
  test("os números exibidos vêm do ExecutiveReport e da comparação canônica, sem cálculo novo", () => {
    const [july, august] = histories.deteriorating;
    const reading = readingFor(histories.deteriorating, august);
    const indicators = indicatorsOf(august.report!);
    for (const metric of reading.situation!.headline) {
      const indicator = indicators.find((candidate) => candidate.name === metric.name)!;
      const expected = indicator.result.status === "available" ? formatMetricValue(indicator.result.value, indicator.unit) : undefined;
      assert.equal(metric.valueText, expected, metric.name);
    }
    const canonical = compareExecutions(july, august)
      .metrics.filter((metric) => metric.direction === "increased" || metric.direction === "decreased")
      .map((metric) => describeMetricChange(metric));
    assert.deepEqual(
      [...reading.movement].sort((a, b) => a.metricName.localeCompare(b.metricName)),
      [...canonical].sort((a, b) => a.metricName.localeCompare(b.metricName))
    );
  });

  test("o valor lido é o gravado no relatório — nunca recalculado a partir do Financial Model", () => {
    const august = histories.deteriorating.at(-1)!;
    const report = august.report!;
    const tampered: ExecutiveReport = {
      ...report,
      sections: report.sections.map((section) =>
        section.type === "indicators"
          ? {
              ...section,
              indicators: {
                ...section.indicators,
                indicators: section.indicators.indicators.map((indicator) =>
                  indicator.name === "Margem Líquida" ? { ...indicator, result: { status: "available" as const, value: 12.3456 } } : indicator
                ),
              },
            }
          : section
      ),
    };
    const current = { ...august, report: tampered, snapshot: { ...august.snapshot, report: tampered } };
    const reading = readingFor([histories.deteriorating[0], current], current);
    assert.equal(reading.situation!.headline.find((metric) => metric.name === "Margem Líquida")!.valueText, "12,35%");
  });

  test("indisponível nunca vira zero: empresa só com Balanço mostra 'Indisponível' e lista o que não se sabe", () => {
    const current = histories.incomplete.at(-1)!;
    const reading = readingFor(histories.incomplete, current);
    const netMargin = reading.situation!.headline.find((metric) => metric.name === "Margem Líquida")!;
    assert.equal(netMargin.valueText, undefined);
    assert.ok(reading.indicatorCounts.unavailable > 0);
    assert.ok(reading.unknowns.some((unknown) => unknown.kind === "indicator" && unknown.text.includes("Margem Líquida")));

    const text = renderText(reading);
    assert.match(text, /Indisponível/);
    assert.match(text, /indicadores não puderam ser calculados por falta de dado/);
    assert.doesNotMatch(text, /Margem Líquida\s+0,00%/);
    assert.doesNotMatch(text, /Movimento financeiro/, "sem período anterior, não há seção de movimento");
  });

  test("o relatório muda semanticamente com a empresa (saudável × deterioração × incompleta)", () => {
    const healthy = readingFor(histories.healthy, histories.healthy.at(-1)!);
    const deteriorating = readingFor(histories.deteriorating, histories.deteriorating.at(-1)!);
    const incomplete = readingFor(histories.incomplete, histories.incomplete.at(-1)!);

    assert.equal(healthy.evidence.attention.length, 0);
    assert.ok(healthy.movement.some((change) => change.metricName === "Margem Líquida" && change.desirability === "favorable"));
    assert.ok(deteriorating.evidence.attention.length >= 2);
    assert.ok(deteriorating.movement.some((change) => change.metricName === "Margem Líquida" && change.desirability === "unfavorable"));
    assert.ok(deteriorating.focusIndicators.some((focus) => focus.indicator.name === "Margem Líquida"));
    assert.equal(incomplete.comparison.outcome, "first-period");
    assert.ok(incomplete.indicatorCounts.unavailable > healthy.indicatorCounts.unavailable);
  });

  test("hipótese nunca vira fato: Reasoning fica em 'hipóteses'; evidências são só as do Evidence Engine", () => {
    const august = histories.deteriorating.at(-1)!;
    const reading = readingFor(histories.deteriorating, august);
    const evidenceIds = new Set(august.snapshot.execution.evidence!.evidences.map((evidence) => evidence.id));
    const reasoningIds = new Set(august.snapshot.execution.reasoning!.reasonings.map((reasoning) => reasoning.id));
    const shown = [...reading.evidence.attention, ...reading.evidence.favorable, ...reading.evidence.information];
    assert.ok(shown.every((entry) => evidenceIds.has(entry.id)));
    assert.ok(reading.hypotheses.every((entry) => reasoningIds.has(entry.id)));
    assert.ok(!shown.some((entry) => reasoningIds.has(entry.id)));
  });

  test("decisão nunca é inventada: sem Decision registrada, só as propostas do Decision Engine — rotuladas como proposta", () => {
    const august = histories.deteriorating.at(-1)!;
    const reading = readingFor(histories.deteriorating, august);
    assert.deepEqual(reading.decisions, []);
    const text = renderText(reading);
    assert.doesNotMatch(text, /Decisões da empresa que nasceram desta análise/);
    if (reading.proposals.length > 0) assert.match(text, /Proposta — não é uma decisão da empresa/);
  });

  test("cenário nunca é gerado nem vira previsão: sem decisão de cenário, não há seção de cenários", () => {
    const reading = readingFor(histories.deteriorating, histories.deteriorating.at(-1)!);
    assert.deepEqual(reading.scenarios, []);
    assert.doesNotMatch(renderText(reading), /Cenários avaliados/);
    for (const file of listFiles(join(ROOT, "modules", "reports"))) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /simulate\w+Scenario/, `${file}: o relatório não simula cenários`);
    }
  });
});

describe("Mission 208 — período, comparação e versões", () => {
  test("o período é o canônico dos indicadores; a comparação é o período anterior canônico", () => {
    const [july, august] = histories.healthy;
    const reading = readingFor(histories.healthy, august);
    assert.deepEqual(reading.period, periodOf(august.snapshot.execution.indicators!));
    assert.equal(reading.comparison.outcome, "resolved");
    if (reading.comparison.outcome === "resolved") assert.equal(reading.comparison.baseline.executionId, july.executionId);
    assert.equal(reading.periodLabel?.long, "agosto de 2026");
    assert.equal(reading.comparisonLabel?.long, "julho de 2026");
  });

  test("reanálise do mesmo período é uma nova versão — nunca o 'período anterior' de si mesma", async () => {
    const [july, august] = histories.deteriorating;
    const reanalysis = await buildReanalysis(FIXTURE_COMPANIES.deteriorating, "2026-09-20T12:00:00.000Z");
    const history = [july, august, reanalysis];

    const comparison = resolvePreviousPeriodComparison(history, reanalysis);
    assert.equal(comparison.outcome, "resolved");
    if (comparison.outcome === "resolved") assert.equal(comparison.baseline.executionId, july.executionId);

    assert.deepEqual(resolvePeriodVersion(history, reanalysis), { state: "latest", versions: 2 });
    const earlier = resolvePeriodVersion(history, august);
    assert.equal(earlier.state, "earlier");
    if (earlier.state === "earlier") assert.equal(earlier.latestExecutionId, reanalysis.executionId);

    assert.match(renderText(readingFor(history, august)), /Versão anterior — o período foi analisado de novo/);
  });

  test("histórico anterior divergente torna a comparação ambígua — dito explicitamente, sem escolher uma versão", async () => {
    const [july, august] = histories.deteriorating;
    // Julho analisado de novo, mesma empresa, com outros números: não há uma verdade única de julho (Mission 171/174).
    const divergentJuly = await buildDivergentJuly(FIXTURE_COMPANIES.deteriorating, "2026-08-20T12:00:00.000Z");
    const reading = readingFor([july, divergentJuly, august], august);
    assert.equal(reading.comparison.outcome, "ambiguous");
    assert.deepEqual(reading.movement, []);
    assert.ok(reading.unknowns.some((unknown) => unknown.kind === "comparison" && /não tem uma versão única defensável/.test(unknown.text)));
  });

  test("execuções de outra empresa no histórico nunca entram na comparação nem nas versões", () => {
    const [, august] = histories.deteriorating;
    const foreign = histories.healthy[0];
    const reading = readingFor([foreign, august], august);
    assert.equal(reading.comparison.outcome, "first-period");
    assert.deepEqual(reading.version, { state: "latest", versions: 1 });
  });
});

describe("Mission 208 — ciclo de decisão por linhagem (empresa C)", () => {
  test("julho: leitura da IA da própria execução, decisão nascida da prioridade, execução e resultado", () => {
    const reading = readingFor(histories.lifecycle, lifecycle.july, lifecycle.inputs);
    assert.equal(reading.aiReading?.diagnosis.id, lifecycle.diagnosis.id);
    assert.equal(reading.aiReading?.readingsCount, 1);

    assert.deepEqual(reading.decisions.map((decision) => decision.id), [lifecycle.costDecision.id]);
    const decision = reading.decisions[0];
    assert.equal(decision.statusLabel, "Concluída");
    assert.match(decision.originLabel, /^Prioridade da leitura da Executive AI: Revisar os custos operacionais\./);
    assert.deepEqual(decision.outcomes.map((outcome) => outcome.statusLabel), ["Positivo"]);

    const governed = reading.governedRecommendations.find((item) => item.recommendationId === "m208-prioridade-1");
    assert.ok(governed && governed.stateLabel !== "Ainda não revisada", "a prioridade decidida mostra o estado canônico do ciclo");
    assert.equal(reading.governedRecommendations.find((item) => item.recommendationId === "m208-acao-1")?.stateLabel, "Ainda não revisada");

    assert.deepEqual(reading.knowledge.map((item) => item.id), ["m208-conhecimento-1"]);
    assert.deepEqual(reading.knowledge[0].originDecisions, ["Revisar os custos operacionais"]);
    assert.deepEqual(reading.scenarios, [], "o cenário de agosto não pertence ao relatório de julho");
  });

  test("agosto: resultado da decisão de julho observado neste período, ligado à decisão; cenário vira seção própria", () => {
    const reading = readingFor(histories.lifecycle, lifecycle.august, lifecycle.inputs);

    assert.deepEqual(reading.outcomesInPeriod.map((entry) => entry.observationId), [lifecycle.observation.id]);
    const observed = reading.outcomesInPeriod[0];
    assert.equal(observed.decisionTitle, "Revisar os custos operacionais");
    assert.equal(observed.baselinePeriod?.long, "julho de 2026");
    assert.equal(observed.observationPeriod?.long, "agosto de 2026");
    assert.deepEqual(
      observed.metrics.map((metric) => metric.name),
      lifecycle.observation.metrics.map((metric) => metric.metricName),
      "as métricas são as da observação canônica, sem acréscimo"
    );

    assert.deepEqual(reading.scenarios.map((scenario) => scenario.decisionId), [lifecycle.scenarioDecision.id]);
    assert.match(reading.decisions.find((decision) => decision.id === lifecycle.scenarioDecision.id)!.originLabel, /^Cenário avaliado no Scenario Lab/);
    assert.equal(reading.aiReading, undefined);
    assert.ok(reading.unknowns.some((unknown) => unknown.kind === "ai"));

    const text = renderText(reading);
    assert.match(text, /Cenário não é previsão/);
    assert.match(text, /É associação no tempo: não prova que a decisão causou a variação/);
    assert.match(text, /Base do período/);
  });

  test("fronteira de empresa: diagnóstico, decisão, observação e conhecimento de outra empresa nunca entram", () => {
    const july = readingFor(histories.lifecycle, lifecycle.july, lifecycle.inputs);
    const august = readingFor(histories.lifecycle, lifecycle.august, lifecycle.inputs);
    const ids = JSON.stringify([july, august].map((reading) => ({
      diagnosis: reading.aiReading?.diagnosis.id,
      decisions: reading.decisions.map((decision) => decision.id),
      outcomes: reading.outcomesInPeriod.map((entry) => entry.observationId),
      knowledge: reading.knowledge.map((item) => item.id),
    })));
    assert.doesNotMatch(ids, /estrangeir/);

    const lineage = selectReportLineage({ current: lifecycle.august, history: histories.lifecycle, ...lifecycle.inputs });
    assert.ok(lineage.diagnoses.every((diagnosis) => diagnosis.companyId === FIXTURE_COMPANIES.lifecycle));
    assert.ok(lineage.observationsInPeriod.every((observation) => observation.companyId === FIXTURE_COMPANIES.lifecycle));
  });

  test("o documento separa fato, evidência, análise, hipótese, recomendação, decisão, resultado e aprendizado", () => {
    const text = [lifecycle.july, lifecycle.august]
      .map((current) => renderText(readingFor(histories.lifecycle, current, lifecycle.inputs)))
      .join(" ");
    for (const label of ["Indicador calculado", "Evidência", "Interpretação", "Hipótese", "Recomendação", "Decisão da empresa", "Resultado observado", "Aprendizado"]) {
      assert.match(text, new RegExp(label), label);
    }
    // A decisão registrada pela empresa nunca é rotulada como a proposta do Decision Engine.
    const july = renderText(readingFor(histories.lifecycle, lifecycle.july, lifecycle.inputs));
    assert.match(july, /Decisão da empresa Revisar os custos operacionais/);
    assert.match(text, /Interpretação gerada por IA sobre os números acima — não é fato contábil/);
    assert.match(text, /Confiança do EFOS: /);
  });
});

describe("Mission 208 — índice de relatórios", () => {
  test("agrupa por empresa visível, nomeia pelo período, marca versões e a leitura da IA", async () => {
    const [july, august] = histories.deteriorating;
    const reanalysis = await buildReanalysis(FIXTURE_COMPANIES.deteriorating, "2026-09-21T12:00:00.000Z");
    const entry = (execution: HistoricalExecution) => ({
      executionId: execution.executionId,
      companyId: execution.companyId,
      executedAt: execution.executedAt,
      generatedAt: execution.report?.metadata.generatedAt,
      period: periodOf(execution.snapshot.execution.indicators!),
      summary: execution.report?.summary,
      hasReport: true,
    });
    const groups = buildReportIndex({
      companies: [{ id: FIXTURE_COMPANIES.deteriorating, name: "B", status: "active" }],
      entries: [entry(reanalysis), entry(july), entry(august), entry(histories.healthy[0])],
      diagnosisLinks: [
        { executionId: july.executionId, companyId: FIXTURE_COMPANIES.deteriorating },
        { executionId: august.executionId, companyId: OTHER_COMPANY },
      ],
    });

    assert.equal(groups.length, 1, "empresa fora da sessão nunca aparece");
    const rows = groups[0].rows;
    assert.deepEqual(rows.map((row) => row.executionId), [reanalysis.executionId, august.executionId, july.executionId]);
    assert.deepEqual(rows.map((row) => row.version), ["latest", "earlier", "latest"]);
    assert.deepEqual(rows.map((row) => row.isMostRecentPeriod), [true, true, false]);
    assert.deepEqual(rows.map((row) => row.hasAiReading), [false, false, true], "vínculo de diagnóstico de outra empresa é ignorado");
    assert.equal(groups[0].latestPeriodLabel?.long, "agosto de 2026");
  });
});

describe("Mission 208 — superfície", () => {
  test("Relatórios deixa de ser 'em breve' e tem índice e leitura no App Router", () => {
    const item = workspaceNavigation.find((candidate) => candidate.href === "/reports");
    assert.ok(item && item.status === undefined && item.group === "overview");
    assert.ok(existsSync(join(ROOT, "app", "(app)", "reports", "page.tsx")));
    assert.ok(existsSync(join(ROOT, "app", "(app)", "reports", "[executionId]", "page.tsx")));
    assert.doesNotMatch(read("app/(app)/reports/page.tsx"), /PlaceholderPage/);
  });

  test("a leitura responde 404 para relatório inexistente, de outra empresa ou id malformado — sem distinguir", () => {
    const page = read("app/(app)/reports/[executionId]/page.tsx");
    assert.match(page, /if \(!loaded\) notFound\(\)/);
    const queries = read("modules/reports/services/report-queries.ts");
    assert.match(queries, /if \(!isUuid\(executionId\)\) return null;/);
    const service = read("modules/reports/services/report.service.ts");
    assert.match(service, /getCompanyById\(companyId\)/);
    assert.match(service, /execution\.companyId === company\.id/);
  });

  test("impressão: o shell some, o documento tem regras de página, e os detalhes abrem antes de imprimir", () => {
    assert.match(read("modules/workspace/components/AppSidebar.tsx"), /print:hidden!/);
    assert.match(read("modules/workspace/components/AppHeader.tsx"), /print:hidden!/);
    const css = read("modules/reports/components/report-document.css");
    assert.match(css, /@media print/);
    assert.match(css, /@page/);
    assert.match(read("modules/reports/components/ReportPrintButton.tsx"), /beforeprint/);
  });

  test("acessibilidade: um h1, títulos sem salto de nível, tabelas com legenda e cabeçalhos com escopo, documento rotulado", () => {
    for (const current of [lifecycle.july, lifecycle.august]) {
      const reading = readingFor(histories.lifecycle, current, lifecycle.inputs);
      const html = renderToStaticMarkup(
        createElement(ReportDocument, { company: { id: reading.companyId, razao_social: "EMPRESA SINTÉTICA M208", cnpj: "11222333000181" }, reading })
      );
      const levels = [...html.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]));
      assert.equal(levels.filter((level) => level === 1).length, 1);
      for (let index = 1; index < levels.length; index += 1) {
        assert.ok(levels[index] - levels[index - 1] <= 1, `salto de h${levels[index - 1]} para h${levels[index]}`);
      }
      const tables = html.match(/<table\b[\s\S]*?<\/table>/g) ?? [];
      assert.ok(tables.length > 0);
      for (const table of tables) {
        assert.match(table, /<caption/, "toda tabela tem legenda");
        assert.doesNotMatch(table.replace(/<th[^>]*scope="(col|row)"/g, ""), /<th\b/, "todo th declara escopo");
      }
      assert.match(html, /<article[^>]*aria-labelledby="relatorio-titulo"/);
      assert.match(html, /<nav aria-label="Seções do relatório"/);
    }
  });

  test("o documento não mostra id técnico como conteúdo principal: o identificador só aparece na proveniência", () => {
    const reading = readingFor(histories.lifecycle, lifecycle.july, lifecycle.inputs);
    const html = renderToStaticMarkup(
      createElement(ReportDocument, { company: { id: reading.companyId, razao_social: "EMPRESA SINTÉTICA M208", cnpj: "11222333000181" }, reading })
    );
    const occurrences = html.split(reading.executionId).length - 1;
    assert.equal(occurrences, 1, "o id da análise aparece uma vez, na proveniência do anexo");
    assert.doesNotMatch(html, /m208-diagnostico-julho|m208-prioridade-1/);
  });
});

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}
