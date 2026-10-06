import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import type { DecisionExecutionEvent } from "@/efos/application/decision-execution";
import { deriveDecisionExecutionState } from "@/efos/application/decision-execution/deriveDecisionExecutionState";
import { createHumanDecision } from "@/efos/application/decision-lifecycle";
import {
  buildFinancialOutcomeObservation,
  classifyObservationTiming,
  keepPosteriorObservations,
  validateFinancialOutcomeObservation,
  type FinancialObservationTarget,
  type FinancialOutcomeObservation,
} from "@/efos/application/financial-observation";
import { executionPeriodOf, periodPrecedes, positionedExecutionOf, type HistoricalExecution } from "@/efos/application/history";
import { buildLearningRecord } from "@/efos/application/learning-derivation/buildLearningRecord";
import { buildExpectedActualComparison } from "@/efos/application/scenario-outcome-comparison";
import type { Decision, Knowledge, Period } from "@/efos/domain";
import { buildOutcome } from "@/modules/decisions/lib/buildOutcome";
import { decisionFinancialBaseOrigin, resolveDecisionFinancialBase } from "@/modules/decisions/lib/resolveDecisionFinancialBase";
import { resolveCurrentFinancialExecution } from "@/modules/decisions/lib/selectCurrentFinancialExecution";
import type { PersistedDecision } from "@/modules/decisions/services/decision-persistence.service";
import { selectReportLineage } from "@/modules/reports/lib/report-lineage";
import { buildReportReading } from "@/modules/reports/lib/report-reading";
import { composeScenarioDecision } from "@/modules/scenarios/lib/composeScenarioDecision";
import { resolveScenarioBaselineFromHistory } from "@/modules/scenarios/lib/resolveScenarioBaselineFromHistory";

import { monthly, pointInTime } from "./fixtures/temporal-fixtures";

/**
 * Mission 211 — Outcome Temporal Integrity (D-136).
 *
 * Um resultado financeiro só avalia uma decisão quando é de um período
 * ESTRITAMENTE POSTERIOR à verdade financeira em que a decisão se baseou —
 * pela precedência canônica do EFOS (`periodPrecedes`, D-090/D-134), nunca
 * por `executedAt`/`computedAt`. Fixtures do pipeline real
 * (`fixtures/temporal-fixtures.ts`); as mesmas funções que a ação de servidor
 * compõe: base por linhagem (`resolveDecisionFinancialBase`), verdade atual
 * canônica (`resolveCurrentFinancialExecution`) e o construtor puro. Sem
 * rede, sem IA, sem banco.
 */

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const ACTOR = "m211-pessoa-da-empresa";
const STATE_AS_OF = "2026-12-20T12:00:00.000Z";

const at = (execution: HistoricalExecution, ms: number) => new Date(Date.parse(execution.executedAt) + ms).toISOString();

function completedAfter(decision: Decision, createdAt: string) {
  const base = Date.parse(createdAt);
  const events: DecisionExecutionEvent[] = [
    { id: `${decision.id}-e1`, decisionId: decision.id, companyId: decision.companyId, status: "IN_PROGRESS", actorId: ACTOR, occurredAt: new Date(base + 100).toISOString() },
    { id: `${decision.id}-e2`, decisionId: decision.id, companyId: decision.companyId, status: "COMPLETED", actorId: ACTOR, occurredAt: new Date(base + 200).toISOString() },
  ];
  return deriveDecisionExecutionState(events);
}

/** Decisão a partir de um cenário confirmado sobre a verdade atual de `history` (Scenario Lab ou Executive Chat). */
function scenarioDecision(companyId: string, history: readonly HistoricalExecution[], createdAt: string, proposedBy?: "executive-chat"): Decision {
  const baseline = resolveScenarioBaselineFromHistory(companyId, history);
  assert.equal(baseline.outcome, "ready");
  if (baseline.outcome !== "ready") throw new Error("baseline");
  const composed = composeScenarioDecision(
    {
      companyId,
      evaluatedBaselineIdentity: baseline.identity,
      request: { kind: "operating_cost_change", operatingExpensesDeltaAmount: -10000, operatingExpensesDeltaCurrency: "BRL" },
      proposedBy,
      type: "prioritize_sequence",
      priority: "high",
      confidence: "medium",
      title: "Reduzir despesas operacionais",
      description: "Cortar despesas administrativas.",
      rationale: "Proteger a margem.",
    },
    ACTOR,
    baseline,
    `m211-cenario-${companyId}-${createdAt}`,
    createdAt
  );
  assert.ok(composed.success, composed.success ? "" : composed.error);
  return composed.decision;
}

function humanDecision(companyId: string, createdAt: string, diagnosisId?: string): Decision {
  const built = createHumanDecision(
    {
      humanActorId: ACTOR,
      diagnosisId,
      recommendationId: diagnosisId ? "m211-prioridade-1" : undefined,
      companyId,
      type: "execute_immediately",
      priority: "high",
      confidence: "medium",
      title: diagnosisId ? "Revisar custos" : "Renegociar contrato de aluguel",
      description: "Ação registrada pela empresa.",
      rationale: "Decisão da empresa.",
    },
    `m211-decisao-${companyId}-${createdAt}`,
    createdAt
  );
  assert.ok(built.success);
  return built.value;
}

interface ObserveOptions {
  readonly diagnosis?: { readonly id: string; readonly companyId: string; readonly executionId: string };
  readonly target?: FinancialObservationTarget;
}

/** O que `computeFinancialOutcomeObservationAction()` compõe, a partir de um histórico no instante da observação. */
function observe(decision: Decision, createdAt: string, history: readonly HistoricalExecution[], options: ObserveOptions = {}) {
  const { base } = resolveDecisionFinancialBase({
    decision,
    decisionCreatedAt: createdAt,
    diagnosisId: decision.basedOnDiagnosisId,
    diagnosis: options.diagnosis,
    history,
  });
  return buildFinancialOutcomeObservation(
    { id: decision.id, companyId: decision.companyId, createdAt },
    completedAfter(decision, createdAt),
    base,
    options.target ?? resolveCurrentFinancialExecution(decision.companyId, history),
    undefined,
    ACTOR,
    `m211-observacao-${decision.id}`,
    STATE_AS_OF
  );
}

function failureCode(result: ReturnType<typeof observe>): string {
  assert.equal(result.success, false, "a observação deveria ter sido recusada");
  return result.success ? "" : result.error.code;
}

function period(start: string, end: string): Period {
  return { startDate: start, endDate: end };
}

/** Uma observação como relida do banco (a linha não guarda período). */
function storedObservation(id: string, companyId: string, baseline: HistoricalExecution, observation: HistoricalExecution, decisionId = "m211-d"): FinancialOutcomeObservation {
  return {
    id,
    decisionId,
    companyId,
    computedBy: ACTOR,
    computedAt: STATE_AS_OF,
    classification: "TEMPORAL_ASSOCIATION",
    window: {
      decisionId,
      baselineExecutionId: baseline.executionId,
      baselineExecutedAt: baseline.executedAt,
      observationExecutionId: observation.executionId,
      observationExecutedAt: observation.executedAt,
    },
    metrics: [{ metricName: "Margem Líquida", beforeValue: 10, afterValue: 12, absoluteChange: 2, percentageChange: 20, direction: "increased" }],
  };
}

function persist(decision: Decision, diagnosisId: string | null = null): PersistedDecision {
  return { id: decision.id, companyId: decision.companyId, diagnosisId, reviewId: null, humanActorId: ACTOR, decision, createdAt: decision.audit.createdAt };
}

describe("Mission 211 — matriz temporal (A–L)", () => {
  test("A. julho de base → agosto observado: válido, com os dois períodos", async () => {
    const company = "m211-a";
    const jul = await monthly(company, "07", 0.55);
    const createdAt = at(jul, 100);
    const decision = scenarioDecision(company, [jul], createdAt);
    const aug = await monthly(company, "08", 0.6);
    const result = observe(decision, createdAt, [jul, aug]);
    assert.ok(result.success, result.success ? "" : JSON.stringify(result.error));
    assert.equal(result.value.window.baselineExecutionId, jul.executionId);
    assert.equal(result.value.window.observationExecutionId, aug.executionId);
    assert.deepEqual(result.value.window.baselinePeriod, executionPeriodOf(jul));
    assert.deepEqual(result.value.window.observationPeriod, executionPeriodOf(aug));
  });

  test("B. agosto de base → julho processado depois: nunca vira resultado", async () => {
    const company = "m211-b";
    const aug = await monthly(company, "08", 0.6);
    const createdAt = at(aug, 100);
    const decision = scenarioDecision(company, [aug], createdAt);
    const lateJuly = await monthly(company, "07", 0.55);

    // A verdade atual continua agosto (período mais recente), nunca o julho processado por último.
    const result = observe(decision, createdAt, [aug, lateJuly]);
    assert.equal(failureCode(result), "NOT_AFTER_DECISION_BASE");
    // Mesmo que alguém aponte julho como observação, é recusado.
    const forced = observe(decision, createdAt, [aug, lateJuly], { target: { outcome: "resolved", execution: lateJuly } });
    assert.equal(failureCode(forced), "NOT_AFTER_DECISION_BASE");
  });

  test("C. agosto v1 → decisão → agosto v2 (reanálise): nunca vira resultado", async () => {
    const company = "m211-c";
    const v1 = await monthly(company, "08", 0.6, "v1");
    const createdAt = at(v1, 100);
    const decision = scenarioDecision(company, [v1], createdAt);
    const divergent = await monthly(company, "08", 0.7, "v2");
    assert.equal(classifyObservationTiming(executionPeriodOf(v1), executionPeriodOf(divergent)), "same-period");

    // Reanálise divergente: a verdade atual é ambígua → nada observado.
    assert.equal(failureCode(observe(decision, createdAt, [v1, divergent])), "NO_COMPARABLE_FINANCIAL_TRUTH");
    // E mesmo apontada diretamente, a reanálise é do mesmo período.
    const forced = observe(decision, createdAt, [v1, divergent], { target: { outcome: "resolved", execution: divergent } });
    assert.equal(failureCode(forced), "NOT_AFTER_DECISION_BASE");
  });

  test("D. agosto de base → outubro, sem setembro: válido (lacuna aceita)", async () => {
    const company = "m211-d";
    const aug = await monthly(company, "08", 0.6);
    const createdAt = at(aug, 100);
    const decision = scenarioDecision(company, [aug], createdAt);
    const oct = await monthly(company, "10", 0.5);
    const result = observe(decision, createdAt, [aug, oct]);
    assert.ok(result.success);
    assert.equal(result.value.window.observationExecutionId, oct.executionId);
  });

  test("E. posição de 31/08 → posição de 30/09: válido (ordem por período, nunca por duração)", async () => {
    const company = "m211-e";
    const augPosition = await pointInTime(company, "08", 400_000);
    const createdAt = at(augPosition, 100);
    const decision = humanDecision(company, createdAt, "m211-diagnostico-e");
    const sepPosition = await pointInTime(company, "09", 450_000);
    const result = observe(decision, createdAt, [augPosition, sepPosition], {
      diagnosis: { id: "m211-diagnostico-e", companyId: company, executionId: augPosition.executionId },
    });
    assert.ok(result.success, result.success ? "" : JSON.stringify(result.error));
    assert.deepEqual(result.value.window.observationPeriod, executionPeriodOf(sepPosition));
  });

  test("E'. bordas: a posição de 31/08 está dentro de agosto; setembro sucede a posição de 31/08", async () => {
    const augMonth = executionPeriodOf(await monthly("m211-borda", "08", 0.6))!;
    const augPosition = executionPeriodOf(await pointInTime("m211-borda", "08", 400_000))!;
    const sepMonth = executionPeriodOf(await monthly("m211-borda", "09", 0.6))!;
    assert.equal(classifyObservationTiming(augMonth, augPosition), "not-after-base");
    assert.equal(classifyObservationTiming(augPosition, sepMonth), "posterior");
    assert.equal(classifyObservationTiming(augMonth, sepMonth), "posterior");
    assert.equal(classifyObservationTiming(sepMonth, augMonth), "not-after-base");
  });

  test("F. decisão manual sem base: nenhuma observação financeira; o resultado humano continua", async () => {
    const company = "m211-f";
    const aug = await monthly(company, "08", 0.6);
    const createdAt = at(aug, 100);
    const decision = humanDecision(company, createdAt);
    assert.equal(decisionFinancialBaseOrigin(decision, null), "manual");
    const sep = await monthly(company, "09", 0.5);
    assert.equal(failureCode(observe(decision, createdAt, [aug, sep])), "NO_FINANCIAL_BASE");

    const outcome = buildOutcome(
      { decisionId: decision.id, companyId: company, status: "positive", observedAt: createdAt, description: "Contrato renegociado." },
      ACTOR,
      "m211-resultado-f",
      createdAt
    );
    assert.ok(outcome.success, "Outcome operacional continua independente da base financeira");
  });

  test("G. decisão de recomendação: base = execução do diagnóstico, mesmo com análise nova antes do registro", async () => {
    const company = "m211-g";
    const aug = await monthly(company, "08", 0.6);
    const sep = await monthly(company, "09", 0.55);
    // A decisão responde à leitura da IA de AGOSTO, registrada depois que setembro já existia.
    const createdAt = at(sep, 100);
    const decision = humanDecision(company, createdAt, "m211-diagnostico-g");
    assert.equal(decisionFinancialBaseOrigin(decision, null), "diagnosis");
    const oct = await monthly(company, "10", 0.5);
    const result = observe(decision, createdAt, [aug, sep, oct], {
      diagnosis: { id: "m211-diagnostico-g", companyId: company, executionId: aug.executionId },
    });
    assert.ok(result.success, result.success ? "" : JSON.stringify(result.error));
    assert.equal(result.value.window.baselineExecutionId, aug.executionId, "a base é agosto, nunca a análise de setembro");
    assert.equal(result.value.window.observationExecutionId, oct.executionId);
  });

  test("H. decisão de cenário (Scenario Lab): base = execução avaliada pelo cenário", async () => {
    const company = "m211-h";
    const aug = await monthly(company, "08", 0.6);
    const createdAt = at(aug, 100);
    const decision = scenarioDecision(company, [aug], createdAt);
    assert.equal(decisionFinancialBaseOrigin(decision, null), "scenario");
    const base = resolveDecisionFinancialBase({ decision, decisionCreatedAt: createdAt, history: [aug] }).base;
    assert.ok(base.outcome === "anchored" && base.execution.executionId === aug.executionId);
  });

  test("I. decisão vinda do Executive Chat: mesma base de cenário, mesma regra", async () => {
    const company = "m211-i";
    const aug = await monthly(company, "08", 0.6);
    const createdAt = at(aug, 100);
    const decision = scenarioDecision(company, [aug], createdAt, "executive-chat");
    assert.equal(failureCode(observe(decision, createdAt, [aug])), "NOT_AFTER_DECISION_BASE");
    const sep = await monthly(company, "09", 0.55);
    const result = observe(decision, createdAt, [aug, sep]);
    assert.ok(result.success);
  });

  test("J. fronteira entre empresas: base e observação nunca atravessam a empresa", async () => {
    const companyA = "m211-j-a";
    const companyB = "m211-j-b";
    const augA = await monthly(companyA, "08", 0.6);
    const augB = await monthly(companyB, "08", 0.6);
    const createdAt = at(augB, 100);
    const decision = humanDecision(companyA, createdAt, "m211-diagnostico-j");
    const sepB = await monthly(companyB, "09", 0.5);
    const sepA = await monthly(companyA, "09", 0.5);

    // Diagnóstico de B citado por uma decisão de A: sem base.
    const foreignDiagnosis = observe(decision, createdAt, [augA, augB, sepB, sepA], {
      diagnosis: { id: "m211-diagnostico-j", companyId: companyB, executionId: augB.executionId },
    });
    assert.equal(failureCode(foreignDiagnosis), "NO_FINANCIAL_BASE");
    // Diagnóstico de A apontando para a execução de B: a execução não está no histórico de A.
    const foreignExecution = observe(decision, createdAt, [augA, augB, sepB, sepA], {
      diagnosis: { id: "m211-diagnostico-j", companyId: companyA, executionId: augB.executionId },
    });
    assert.equal(failureCode(foreignExecution), "NO_FINANCIAL_BASE");
    // Observação apontada para a verdade de B: recusada.
    const foreignTarget = observe(decision, createdAt, [augA, sepA], {
      diagnosis: { id: "m211-diagnostico-j", companyId: companyA, executionId: augA.executionId },
      target: { outcome: "resolved", execution: sepB },
    });
    assert.equal(failureCode(foreignTarget), "NO_COMPARABLE_FINANCIAL_TRUTH");
    // A leitura descarta observação de A que cite execuções de B.
    const crossed = storedObservation("m211-cruzada", companyA, augB, sepB);
    assert.deepEqual(keepPosteriorObservations([crossed], [augA, augB, sepB, sepA].map(positionedExecutionOf)), []);
  });

  test("K. várias versões: a base é a versão que existia na decisão; versões divergentes do observado = sem resultado", async () => {
    const company = "m211-k";
    const v1 = await monthly(company, "08", 0.6, "v1");
    const createdAt = at(v1, 100);
    const decision = scenarioDecision(company, [v1], createdAt);
    const sepA = await monthly(company, "09", 0.5, "a");
    const sepB = await monthly(company, "09", 0.45, "b");
    assert.equal(failureCode(observe(decision, createdAt, [v1, sepA, sepB])), "NO_COMPARABLE_FINANCIAL_TRUTH");
    const oct = await monthly(company, "10", 0.5);
    // Setembro continua divergente no histórico, mas a verdade atual é outubro — posterior à base.
    const result = observe(decision, createdAt, [v1, sepA, sepB, oct]);
    assert.ok(result.success, result.success ? "" : JSON.stringify(result.error));
    assert.equal(result.value.window.baselineExecutionId, v1.executionId);
  });

  test("L. sem período posterior ainda: estado honesto, nada observado", async () => {
    const company = "m211-l";
    const aug = await monthly(company, "08", 0.6);
    const createdAt = at(aug, 100);
    const decision = scenarioDecision(company, [aug], createdAt);
    const result = observe(decision, createdAt, [aug]);
    assert.equal(failureCode(result), "NOT_AFTER_DECISION_BASE");
    assert.ok(!result.success && "message" in result.error && /mesmo período/.test(result.error.message));
    assert.equal(failureCode(observe(decision, createdAt, [aug], { target: { outcome: "no-history" } })), "NO_COMPARABLE_FINANCIAL_TRUTH");
  });
});

describe("Mission 211 — o contrato e a porta de leitura", () => {
  test("períodos sobrepostos nunca são posteriores (01–31/08 × 15/08–15/09)", () => {
    const august = period("2026-08-01T00:00:00.000Z", "2026-08-31T23:59:59.000Z");
    const overlapping = period("2026-08-15T00:00:00.000Z", "2026-09-15T23:59:59.000Z");
    assert.equal(classifyObservationTiming(august, overlapping), "not-after-base");
    assert.equal(classifyObservationTiming(august, undefined), "undetermined");
    assert.equal(classifyObservationTiming(undefined, august), "undetermined");
  });

  test("o validador recusa uma janela que não seja posterior", async () => {
    const company = "m211-validador";
    const jul = await monthly(company, "07", 0.55);
    const createdAt = at(jul, 100);
    const decision = scenarioDecision(company, [jul], createdAt);
    const aug = await monthly(company, "08", 0.6);
    const result = observe(decision, createdAt, [jul, aug]);
    assert.ok(result.success);
    const inverted = { ...result.value, window: { ...result.value.window, baselinePeriod: result.value.window.observationPeriod, observationPeriod: result.value.window.baselinePeriod } };
    assert.match(validateFinancialOutcomeObservation(inverted).errors.join(" "), /estritamente posterior/);
  });

  test("registros relidos do banco: anterior, mesmo período e execução desconhecida nunca chegam como resultado", async () => {
    const company = "m211-leitura";
    const jul = await monthly(company, "07", 0.55);
    const augV1 = await monthly(company, "08", 0.6, "v1");
    const augV2 = await monthly(company, "08", 0.6, "v2");
    const sep = await monthly(company, "09", 0.5);
    const positioned = [jul, augV1, augV2, sep].map(positionedExecutionOf);
    const observations = [
      storedObservation("posterior", company, augV1, sep),
      storedObservation("mesmo-periodo", company, augV1, augV2),
      storedObservation("anterior", company, augV1, jul),
      { ...storedObservation("desconhecida", company, augV1, sep), window: { ...storedObservation("x", company, augV1, sep).window, observationExecutionId: "m211-nao-existe" } },
    ];
    const kept = keepPosteriorObservations(observations, positioned);
    assert.deepEqual(kept.map((observation) => observation.id), ["posterior"]);
    assert.deepEqual(kept[0].window.baselinePeriod, executionPeriodOf(augV1));
    assert.deepEqual(kept[0].window.observationPeriod, executionPeriodOf(sep));
  });
});

describe("Mission 211 — relatório, Esperado × Observado e Knowledge", () => {
  test("relatório: observação anterior não entra, mesmo período não entra, posterior entra — com o período observado", async () => {
    const company = "m211-relatorio";
    const jul = await monthly(company, "07", 0.55);
    const augV1 = await monthly(company, "08", 0.6, "v1");
    const sep = await monthly(company, "09", 0.5);
    const aug = await monthly(company, "08", 0.6, "v2");
    const history = [jul, augV1, sep, aug];
    const decision = humanDecision(company, at(jul, 100), "m211-diagnostico-r");
    const observations = [
      storedObservation("posterior", company, jul, aug, decision.id),
      storedObservation("mesmo-periodo", company, augV1, aug, decision.id),
      storedObservation("anterior", company, sep, aug, decision.id),
    ];

    const lineage = selectReportLineage({ current: aug, history, diagnoses: [], decisions: [persist(decision, "m211-diagnostico-r")], financialObservations: observations, outcomes: [], learningRecords: [], knowledge: [] });
    assert.deepEqual(lineage.observationsInPeriod.map((observation) => observation.id), ["posterior"]);

    const reading = buildReportReading({
      history,
      current: aug,
      diagnoses: [],
      reviewsByDiagnosis: {},
      decisions: [persist(decision, "m211-diagnostico-r")],
      executionEvents: [],
      outcomes: [],
      financialObservations: observations,
      learningRecords: [],
      knowledge: [],
      stateAsOf: STATE_AS_OF,
    });
    assert.ok(reading);
    assert.deepEqual(reading.outcomesInPeriod.map((entry) => entry.observationId), ["posterior"]);
    assert.equal(reading.outcomesInPeriod[0].observationPeriod?.long, "agosto de 2026");
    assert.equal(reading.outcomesInPeriod[0].baselinePeriod?.long, "julho de 2026");
  });

  test("Esperado × Observado: mesma regra — sobreposto e mesmo período aguardam; posterior compara", async () => {
    const company = "m211-esperado";
    const aug = await monthly(company, "08", 0.6);
    const decision = scenarioDecision(company, [aug], at(aug, 100));
    const sep = await monthly(company, "09", 0.5);
    const indicators = sep.snapshot.execution.indicators!;
    const observedAt = (observedPeriod: Period) => buildExpectedActualComparison(decision, { outcome: "resolved", indicators, period: observedPeriod }, "live");
    const eligibility = (result: ReturnType<typeof observedAt>) => (result.outcome === "built" ? result.comparison.eligibility : result.outcome);

    assert.equal(eligibility(observedAt(executionPeriodOf(sep)!)), "comparable");
    assert.equal(eligibility(observedAt(executionPeriodOf(aug)!)), "awaiting-observation");
    assert.equal(eligibility(observedAt(period("2026-08-15T00:00:00.000Z", "2026-09-15T23:59:59.000Z"))), "awaiting-observation");
    assert.equal(eligibility(observedAt(period("2026-08-31T00:00:00.000Z", "2026-08-31T00:00:00.000Z"))), "awaiting-observation");
  });

  test("Knowledge: decisão → observação válida → aprendizado → conhecimento, pela cadeia canônica", async () => {
    const company = "m211-conhecimento";
    const aug = await monthly(company, "08", 0.6);
    const createdAt = at(aug, 100);
    const decision = scenarioDecision(company, [aug], createdAt);
    const sep = await monthly(company, "09", 0.5);
    const observation = observe(decision, createdAt, [aug, sep]);
    assert.ok(observation.success);

    const learning = buildLearningRecord({ id: decision.id, companyId: company, title: decision.title }, [], [observation.value], "m211-aprendizado", STATE_AS_OF);
    assert.ok(learning.success, learning.success ? "" : JSON.stringify(learning.error));
    assert.deepEqual(learning.value.financialObservationIds, [observation.value.id]);

    const knowledge: Knowledge = {
      id: "m211-conhecimento",
      companyId: company,
      category: "accumulated_learning",
      statement: "Cortes de despesa foram seguidos de margem maior.",
      derivedFromOutcomeIds: [],
      derivedFromLearningRecordIds: [learning.value.id],
      provenance: { source: "m211-fixture", confidence: { value: 70, level: "moderate" } },
      audit: { createdAt: STATE_AS_OF, updatedAt: STATE_AS_OF, version: 1 },
    };
    const lineage = selectReportLineage({
      current: sep,
      history: [aug, sep],
      diagnoses: [],
      decisions: [persist(decision)],
      financialObservations: [observation.value],
      outcomes: [],
      learningRecords: [learning.value],
      knowledge: [knowledge],
    });
    assert.deepEqual(lineage.observedDecisions.map((entry) => entry.id), [decision.id]);
    assert.deepEqual(lineage.knowledge.map((entry) => entry.id), ["m211-conhecimento"]);
  });
});

describe("Mission 211 — servidor como autoridade e fonte única", () => {
  const files = (dir: string): string[] =>
    readdirSync(join(ROOT, dir)).flatMap((name) => {
      const path = `${dir}/${name}`;
      return statSync(join(ROOT, path)).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  test("a ação recebe só empresa e decisão; base e observação são resolvidas no servidor, antes de compor", () => {
    const action = read("modules/decisions/actions/financial-observation.actions.ts");
    const input = action.slice(action.indexOf("export interface ComputeFinancialOutcomeObservationInput"), action.indexOf("export type ComputeFinancialOutcomeObservationResult"));
    assert.deepEqual([...input.matchAll(/readonly (\w+):/g)].map((match) => match[1]), ["companyId", "decisionId"]);
    const body = action.slice(action.indexOf("export async function computeFinancialOutcomeObservationAction"));
    const order = ["getCurrentUser()", "getCompanyById(input.companyId)", "verifyDecisionBelongsToCompany(", "resolveDecisionFinancialBase(", "resolveCurrentFinancialExecution(", "buildFinancialOutcomeObservation(", "saveFinancialOutcomeObservation("];
    const positions = order.map((needle) => body.indexOf(needle));
    assert.ok(positions.every((position) => position > 0), `faltando: ${order.filter((_, index) => positions[index] < 0).join(", ")}`);
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  });

  test("empresa encerrada: a ação exige empresa ativa e o banco recusa a observação", () => {
    const action = read("modules/decisions/actions/financial-observation.actions.ts");
    assert.match(action, /getCompanyById\(input\.companyId\)/);
    const migration = read("supabase/migrations/20260926120000_company_offboarding.sql");
    const policy = migration.slice(migration.indexOf('alter policy "financial_observations_insert_own"'));
    assert.match(policy.slice(0, 700), /c\.deleted_at is null/);
  });

  test("a única leitura de observações aplica a regra temporal", () => {
    const readers = [...files("modules"), ...files("app"), ...files("efos")].filter((path) => withoutComments(read(path)).includes('from("financial_observations")'));
    assert.deepEqual(readers, ["modules/decisions/services/financial-observation-persistence.service.ts"]);
    const service = read("modules/decisions/services/financial-observation-persistence.service.ts");
    const reader = service.slice(service.indexOf("export async function getFinancialObservationsByDecision"));
    assert.match(reader, /return keepPosteriorObservations\(observations, await positionExecutions\(supabase, executionIds\)\);/);
  });

  test("o construtor não escolhe mais base nem observação por hora de execução", () => {
    const builder = withoutComments(read("efos/application/financial-observation/buildFinancialOutcomeObservation.ts"));
    assert.doesNotMatch(builder, /latestMatching|decisionCreatedAtMs/);
    assert.match(builder, /classifyObservationTiming\(baselinePeriod, observationPeriod\)/);
  });

  test("uma única regra de ordem entre períodos para resultado, relatório e decisão", () => {
    assert.equal(periodPrecedes(period("2026-08-01T00:00:00.000Z", "2026-08-31T23:59:59.000Z"), period("2026-09-01T00:00:00.000Z", "2026-09-30T23:59:59.000Z")), true);
    const scopes = [
      ...files("modules/decisions"),
      ...files("modules/reports"),
      ...files("modules/scenarios"),
      ...files("efos/application/financial-observation"),
      ...files("efos/application/scenario-outcome-comparison"),
      ...files("efos/application/recommendation-outcome-reconciliation"),
      ...files("efos/application/learning-derivation"),
    ];
    // `selectCurrentFinancialExecution.ts` (Mission 176) responde outra pergunta — QUAL é o período mais
    // recente (verdade atual estrita) — e monta o envelope de um período; não decide "posterior a".
    const latestTruthAuthority = "modules/decisions/lib/selectCurrentFinancialExecution.ts";
    const ownComparisons = scopes
      .filter((path) => path !== latestTruthAuthority)
      .filter((path) => /\.(startDate|endDate)\s*[<>]=?\s|getTime\(\)\s*[<>]=?\s*new Date\([^)]*\.(startDate|endDate)/.test(withoutComments(read(path))));
    assert.deepEqual(ownComparisons, [], "nenhuma regra própria de ordem entre períodos fora da autoridade temporal");
    assert.ok(!scopes.some((path) => read(path).includes("function periodIsAfter")), "a regra divergente do Esperado × Observado foi removida");
  });
});
