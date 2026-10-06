import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { before, describe, test } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { DecisionExecutionEvent } from "@/efos/application/decision-execution";
import { deriveDecisionExecutionState } from "@/efos/application/decision-execution/deriveDecisionExecutionState";
import {
  createHumanDecision,
  isScenarioDecisionContext,
  readScenarioDecisionContext,
  type ScenarioDecisionContext,
} from "@/efos/application/decision-lifecycle";
import { buildExecutiveFinancialContext } from "@/efos/application/executive-context";
import { executeExecutiveChatAnalysis, type ExecutiveChatResolvedAction } from "@/efos/application/executive-chat";
import { buildFinancialOutcomeObservation } from "@/efos/application/financial-observation";
import { previousPeriodComparisonOf, type HistoricalExecution } from "@/efos/application/history";
import { CapturingExecutiveChatProvider } from "@/efos/application/synthetic-validation";
import type { Decision, Knowledge, LearningRecord } from "@/efos/domain";
import { buildOutcome } from "@/modules/decisions/lib/buildOutcome";
import { resolveDecisionFinancialBase } from "@/modules/decisions/lib/resolveDecisionFinancialBase";
import { resolveExpectedActualComparison } from "@/modules/decisions/lib/resolveExpectedActualComparison";
import {
  derivePeriodFromIndicators,
  hasCompleteFinancialTruth,
  resolveCurrentFinancialExecution,
} from "@/modules/decisions/lib/selectCurrentFinancialExecution";
import type { PersistedDecision } from "@/modules/decisions/services/decision-persistence.service";
import { ExecutiveChatActionCard } from "@/modules/executive-chat/components/ExecutiveChatActionCard";
import { toScenarioRequest } from "@/modules/executive-chat/lib/toScenarioRequest";
import { ReportDocument } from "@/modules/reports/components/ReportDocument";
import { selectReportLineage, type ReportLineageInputs } from "@/modules/reports/lib/report-lineage";
import { buildReportReading } from "@/modules/reports/lib/report-reading";
import { composeScenarioDecision, type ScenarioDecisionRequest } from "@/modules/scenarios/lib/composeScenarioDecision";
import { resolveScenarioBaselineFromHistory, type ScenarioBaselineResolution } from "@/modules/scenarios/lib/resolveScenarioBaselineFromHistory";
import type { ScenarioRequest } from "@/modules/scenarios/lib/runSingleScenario";
import {
  PROPOSAL_BASELINE_CHANGED_MESSAGE,
  baselineClaimMatches,
  fingerprintFinancialModel,
  type ScenarioBaselineIdentity,
} from "@/modules/scenarios/lib/scenarioBaselineIdentity";

import { buildFixtureHistories, FIXTURE_COMPANIES, type FixtureHistories } from "./fixtures/report-fixtures";
import { monthly } from "./fixtures/temporal-fixtures";

/**
 * Mission 210 — Governed Chat-to-Decision Lineage (D-135).
 *
 * `Contexto financeiro A → Executive Chat → ação governada → confirmação
 * humana → Decision → linhagem do relatório`, pelas MESMAS funções que o
 * produto executa: a âncora de cada resposta do Chat
 * (`resolveScenarioBaselineFromHistory`, também usada pela simulação e
 * pela decisão), a composição pura da decisão (`composeScenarioDecision`,
 * o miolo de `createScenarioDecisionAction`) e a linhagem do relatório
 * (`selectReportLineage`). Fixtures do pipeline real; sem rede, sem IA
 * real, sem banco. A fronteira entre empresas no banco é provada contra o
 * Supabase local (`tests/reports-local/`).
 */

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const ACTOR = "m210-pessoa-da-empresa";
const COMPANY = FIXTURE_COMPANIES.healthy;
const OTHER_COMPANY = FIXTURE_COMPANIES.deteriorating;
const STATE_AS_OF = "2026-10-05T12:00:00.000Z";

type ReadyBaseline = Extract<ScenarioBaselineResolution, { outcome: "ready" }>;

function readyBaseline(companyId: string, history: readonly HistoricalExecution[]): ReadyBaseline {
  const baseline = resolveScenarioBaselineFromHistory(companyId, history);
  assert.equal(baseline.outcome, "ready", baseline.outcome === "rejected" ? baseline.error : "");
  return baseline as ReadyBaseline;
}

interface ChatTurn {
  readonly proposals: readonly ExecutiveChatResolvedAction[];
  readonly baselineIdentity?: ScenarioBaselineIdentity;
}

/**
 * O que `askExecutiveChatQuestionAction()` faz depois de autenticar: resolve a
 * verdade financeira atual, monta o contexto canônico, pergunta ao provider
 * (aqui o stand-in determinístico da Mission 160) e devolve a âncora pela
 * mesma função da simulação.
 */
async function askChat(companyId: string, history: readonly HistoricalExecution[], question: string): Promise<ChatTurn> {
  const resolution = resolveCurrentFinancialExecution(companyId, history);
  assert.equal(resolution.outcome, "resolved");
  if (resolution.outcome !== "resolved") throw new Error("verdade financeira");
  const execution = resolution.execution.snapshot.execution;
  assert.ok(hasCompleteFinancialTruth(execution));
  const period = derivePeriodFromIndicators(execution.indicators);
  assert.ok(period);
  const context = buildExecutiveFinancialContext(
    companyId,
    period,
    execution.indicators,
    execution.evidence,
    execution.context,
    execution.reasoning,
    execution.recommendation,
    previousPeriodComparisonOf(history, resolution.execution),
    history,
    resolution.execution.executionId
  );
  const provider = new CapturingExecutiveChatProvider({
    providerName: "m210-sintetico",
    answerId: "m210-resposta",
    generatedAt: STATE_AS_OF,
    receivedAt: STATE_AS_OF,
  });
  const result = await executeExecutiveChatAnalysis(provider, context, "m210-instrucao", { text: question });
  assert.ok(result.success, result.success ? "" : result.error.message);
  if (!result.success) throw new Error("chat");
  const anchor = resolveScenarioBaselineFromHistory(companyId, history);
  return { proposals: result.value.proposedActions ?? [], baselineIdentity: anchor.outcome === "ready" ? anchor.identity : undefined };
}

function scenarioProposal(turn: ChatTurn): Extract<ExecutiveChatResolvedAction, { kind: "scenario" }> {
  const proposal = turn.proposals.find((action) => action.kind === "scenario");
  assert.ok(proposal && proposal.kind === "scenario", "o Chat deve propor um cenário");
  return proposal;
}

function decisionRequest(companyId: string, claim: unknown, request: ScenarioRequest, extra: Partial<ScenarioDecisionRequest> = {}): ScenarioDecisionRequest {
  return {
    companyId,
    evaluatedBaselineIdentity: claim as ScenarioBaselineIdentity,
    request,
    proposedBy: "executive-chat",
    type: "prioritize_sequence",
    priority: "high",
    confidence: "medium",
    title: "Reduzir despesas operacionais",
    description: "Cortar despesas administrativas no próximo ciclo.",
    rationale: "Proteger a margem do período analisado.",
    ...extra,
  };
}

/** A confirmação humana: o servidor resolve o baseline atual e compõe a decisão. */
function confirm(companyId: string, history: readonly HistoricalExecution[], request: ScenarioDecisionRequest, createdAt = "2026-09-10T12:00:00.000Z") {
  return composeScenarioDecision(request, ACTOR, readyBaseline(companyId, history), `m210-decisao-${createdAt}`, createdAt);
}

function persist(decision: Decision, diagnosisId: string | null = null): PersistedDecision {
  return {
    id: decision.id,
    companyId: decision.companyId,
    diagnosisId,
    reviewId: null,
    humanActorId: decision.humanActorId ?? null,
    decision,
    createdAt: decision.audit.createdAt,
  };
}

function lineageInputs(current: HistoricalExecution, extra: Partial<ReportLineageInputs> = {}): ReportLineageInputs {
  return { current, history: [current], diagnoses: [], decisions: [], financialObservations: [], outcomes: [], learningRecords: [], knowledge: [], ...extra };
}

const entity = (createdAt: string) => ({
  provenance: { source: "m210-fixture", confidence: { value: 70, level: "moderate" as const } },
  audit: { createdAt, updatedAt: createdAt, version: 1 },
});

let histories: FixtureHistories;
let turn: ChatTurn;
let chatDecision: Decision;

before(async () => {
  histories = await buildFixtureHistories();
  turn = await askChat(COMPANY, histories.healthy, "E se eu reduzir as despesas operacionais em 20 mil?");
  const proposal = scenarioProposal(turn);
  const composed = confirm(COMPANY, histories.healthy, decisionRequest(COMPANY, turn.baselineIdentity, toScenarioRequest(proposal.assumption)));
  assert.ok(composed.success, composed.success ? "" : composed.error);
  chatDecision = composed.decision;
});

describe("Mission 210 — contrato: do contexto financeiro à linhagem do relatório", () => {
  test("contexto A → Chat → ação governada → confirmação humana → Decision → relatório de A", () => {
    const [july, august] = histories.healthy;
    const proposal = scenarioProposal(turn);

    // O Chat só propõe: a ação não carrega empresa, id de entidade nem âncora.
    assert.equal(proposal.type, "PREPARE_OPERATING_COST_SCENARIO");
    assert.equal(proposal.assumption.kind, "operating_cost_change");
    assert.ok(!("companyId" in proposal) && !("baselineIdentity" in proposal));

    // A âncora é a verdade financeira de A (agosto), calculada pelo servidor.
    assert.ok(turn.baselineIdentity);
    assert.deepEqual(turn.baselineIdentity.period, derivePeriodFromIndicators(august.snapshot.execution.indicators!));
    assert.equal(turn.baselineIdentity.financialModelFingerprint, fingerprintFinancialModel(august.snapshot.execution.financialModel!));

    // A decisão é humana, da empresa, e guarda a origem e a âncora.
    assert.equal(chatDecision.companyId, COMPANY);
    assert.equal(chatDecision.humanActorId, ACTOR);
    assert.equal(chatDecision.provenance.source, "human-decision");
    assert.equal(chatDecision.basedOnDiagnosisId, undefined);
    assert.equal(chatDecision.basedOnRecommendationId, undefined);
    const context = readScenarioDecisionContext(chatDecision.supportingData);
    assert.ok(context);
    assert.equal(context.proposedBy, "executive-chat");
    assert.equal(context.baselineFingerprint, turn.baselineIdentity.financialModelFingerprint);
    assert.deepEqual(context.period, turn.baselineIdentity.period);
    assert.equal(context.alternative, undefined);

    // O relatório de agosto encontra a decisão pela linhagem de cenário; o de julho não.
    const augustLineage = selectReportLineage(lineageInputs(august, { decisions: [persist(chatDecision)] }));
    assert.deepEqual(augustLineage.decisions.map((link) => [link.decision.id, link.origin.kind]), [[chatDecision.id, "scenario"]]);
    const link = augustLineage.decisions[0];
    assert.ok(link.origin.kind === "scenario" && link.origin.scenario.proposedBy === "executive-chat");
    assert.deepEqual(selectReportLineage(lineageInputs(july, { decisions: [persist(chatDecision)] })).decisions, []);
  });

  test("proveniência: empresa, contexto financeiro, ação governada, decisão e instante", () => {
    const context = readScenarioDecisionContext(chatDecision.supportingData)!;
    const provenance = {
      company: chatDecision.companyId,
      financialContext: { period: context.period, fingerprintMatchesAnchor: context.baselineFingerprint === turn.baselineIdentity!.financialModelFingerprint },
      // A ação governada é derivável: cenário único de despesas operacionais proposto pelo Chat.
      chatAction: context.proposedBy === "executive-chat" && !context.alternative ? context.scenarioType : undefined,
      decision: chatDecision.id,
      at: chatDecision.audit.createdAt,
    };
    assert.deepEqual(provenance, {
      company: COMPANY,
      financialContext: { period: turn.baselineIdentity!.period, fingerprintMatchesAnchor: true },
      chatAction: "adjust_operating_costs",
      decision: chatDecision.id,
      at: "2026-09-10T12:00:00.000Z",
    });
  });

  test("comparação proposta pelo Chat: a alternativa escolhida vira decisão, a outra fica como contexto", async () => {
    const comparisonTurn = await askChat(
      COMPANY,
      histories.healthy,
      "Quero comparar reduzir as despesas operacionais em 20 mil com receber 5 dias mais rápido."
    );
    const comparison = comparisonTurn.proposals.find((action) => action.kind === "comparison");
    assert.ok(comparison && comparison.kind === "comparison");
    const composed = confirm(
      COMPANY,
      histories.healthy,
      decisionRequest(COMPANY, comparisonTurn.baselineIdentity, toScenarioRequest(comparison.alternativeB), {
        alternative: toScenarioRequest(comparison.alternativeA),
      })
    );
    assert.ok(composed.success);
    const context = readScenarioDecisionContext(composed.decision.supportingData)!;
    assert.equal(context.scenarioType, "adjust_collection_terms");
    assert.equal(context.alternative?.scenarioType, "adjust_operating_costs");
    assert.equal(context.proposedBy, "executive-chat");
  });
});

describe("Mission 210 — âncora financeira canônica", () => {
  test("a âncora da resposta é a identidade do baseline que a simulação e a decisão usam", () => {
    const baseline = readyBaseline(COMPANY, histories.healthy);
    assert.deepEqual(turn.baselineIdentity, baseline.identity);
    assert.ok(baselineClaimMatches(turn.baselineIdentity, baseline.identity));
  });

  test("sem verdade financeira defensável, não há âncora — nenhum cenário pode partir da resposta", async () => {
    const jan = await monthly("m210-ambigua", "01", 0.55);
    const febA = await monthly("m210-ambigua", "02", 0.55, "a");
    const febB = await monthly("m210-ambigua", "02", 0.7, "b");
    const anchor = resolveScenarioBaselineFromHistory("m210-ambigua", [jan, febA, febB]);
    assert.equal(anchor.outcome, "rejected");
  });

  test("a âncora é sempre da empresa da conversa", () => {
    const other = readyBaseline(OTHER_COMPANY, histories.deteriorating);
    assert.notEqual(other.identity.financialModelFingerprint, turn.baselineIdentity!.financialModelFingerprint);
  });
});

describe("Mission 210 — contexto desatualizado entre a proposta e a confirmação", () => {
  test("uma análise nova (março) depois da proposta (fevereiro): recusa, nunca reassocia a março", async () => {
    const company = "m210-desatualizada";
    const jan = await monthly(company, "01", 0.55);
    const feb = await monthly(company, "02", 0.6);
    const proposalTurn = await askChat(company, [jan, feb], "E se eu reduzir as despesas operacionais em 10 mil?");
    const request = toScenarioRequest(scenarioProposal(proposalTurn).assumption);

    const mar = await monthly(company, "03", 0.65);
    const result = confirm(company, [jan, feb, mar], decisionRequest(company, proposalTurn.baselineIdentity, request));
    assert.equal(result.success, false);
    assert.ok(!result.success);
    assert.equal(result.stage, "stale-baseline");
    assert.equal(result.error, PROPOSAL_BASELINE_CHANGED_MESSAGE);

    // Uma nova pergunta ancora em março, e aí a decisão pertence a março.
    const freshTurn = await askChat(company, [jan, feb, mar], "E se eu reduzir as despesas operacionais em 10 mil?");
    const fresh = confirm(company, [jan, feb, mar], decisionRequest(company, freshTurn.baselineIdentity, request));
    assert.ok(fresh.success);
    assert.deepEqual(readScenarioDecisionContext(fresh.decision.supportingData)!.period, derivePeriodFromIndicators(mar.snapshot.execution.indicators!));
  });

  test("a mensagem de recusa do Scenario Lab continua a mesma quando a origem não é o Chat", async () => {
    const company = "m210-desatualizada-lab";
    const jan = await monthly(company, "01", 0.55);
    const feb = await monthly(company, "02", 0.6);
    const claim = readyBaseline(company, [jan, feb]).identity;
    const mar = await monthly(company, "03", 0.65);
    const result = confirm(company, [jan, feb, mar], decisionRequest(company, claim, { kind: "collection_period_change", collectionPeriodDeltaDays: -5 }, { proposedBy: undefined }));
    assert.ok(!result.success);
    assert.equal(result.stage, "stale-baseline");
    assert.match(result.error, /execute a simulação novamente/);
  });
});

describe("Mission 210 — ação adulterada falha com segurança", () => {
  const anchorOf = () => turn.baselineIdentity!;
  const validRequest: ScenarioRequest = { kind: "operating_cost_change", operatingExpensesDeltaAmount: -20000, operatingExpensesDeltaCurrency: "BRL" };
  const rejects = (request: ScenarioDecisionRequest, stage: "stale-baseline" | "assumption" | "command") => {
    const result = confirm(COMPANY, histories.healthy, request);
    assert.equal(result.success, false);
    assert.ok(!result.success);
    assert.equal(result.stage, stage);
  };

  test("tipo de ação alterado", () => {
    rejects(decisionRequest(COMPANY, anchorOf(), { kind: "delete_company" } as unknown as ScenarioRequest), "assumption");
  });

  test("parâmetro adulterado: valor não finito, moeda trocada, corte maior que a despesa", () => {
    rejects(decisionRequest(COMPANY, anchorOf(), { ...validRequest, operatingExpensesDeltaAmount: Number.NaN }), "assumption");
    rejects(decisionRequest(COMPANY, anchorOf(), { ...validRequest, operatingExpensesDeltaCurrency: "USD" }), "assumption");
    rejects(decisionRequest(COMPANY, anchorOf(), { ...validRequest, operatingExpensesDeltaAmount: -1_000_000_000 }), "assumption");
  });

  test("âncora adulterada ou malformada: recusa, nunca exceção", () => {
    const anchor = anchorOf();
    const claims: unknown[] = [
      { ...anchor, financialModelFingerprint: `${anchor.financialModelFingerprint} ` },
      { ...anchor, period: { startDate: "2026-07-01T00:00:00.000Z", endDate: anchor.period.endDate } },
      { period: anchor.period },
      { financialModelFingerprint: anchor.financialModelFingerprint },
      { period: "agosto", financialModelFingerprint: anchor.financialModelFingerprint },
      {},
      null,
      "agosto",
      42,
    ];
    for (const claim of claims) rejects(decisionRequest(COMPANY, claim, validRequest), "stale-baseline");
  });

  test("empresa adulterada: o baseline de A nunca sustenta uma decisão de B", () => {
    const result = composeScenarioDecision(
      decisionRequest(OTHER_COMPANY, anchorOf(), validRequest),
      ACTOR,
      readyBaseline(COMPANY, histories.healthy),
      "m210-decisao-cruzada",
      STATE_AS_OF
    );
    assert.ok(!result.success);
    assert.equal(result.stage, "assumption");
  });

  test("referência de outra empresa: a âncora de B não confirma uma decisão em A", () => {
    const foreignAnchor = readyBaseline(OTHER_COMPANY, histories.deteriorating).identity;
    rejects(decisionRequest(COMPANY, foreignAnchor, validRequest), "stale-baseline");
  });

  test("referência inexistente: empresa sem histórico não tem baseline — o servidor para antes de compor", () => {
    const baseline = resolveScenarioBaselineFromHistory("m210-sem-historico", []);
    assert.equal(baseline.outcome, "rejected");
  });

  test("origem adulterada: fora do vocabulário fechado, a decisão inteira é recusada", () => {
    for (const proposedBy of ["executive-ai", "EXECUTIVE-CHAT", "", {}, ["executive-chat"]]) {
      rejects(decisionRequest(COMPANY, anchorOf(), validRequest, { proposedBy: proposedBy as never }), "command");
    }
  });

  test("na leitura, uma origem desconhecida gravada fora do servidor não é reconhecida", () => {
    const context = readScenarioDecisionContext(chatDecision.supportingData)!;
    const forged = { ...context, proposedBy: "executive-ai" };
    assert.equal(isScenarioDecisionContext(forged), false);
    const forgedDecision: Decision = { ...chatDecision, id: "m210-forjada", supportingData: { scenarioContext: forged } };
    const lineage = selectReportLineage(lineageInputs(histories.healthy[1], { decisions: [persist(forgedDecision)] }));
    assert.deepEqual(lineage.decisions, []);
  });

  test("a decisão manual não aceita mais linhagem vinda do navegador (`supportingData`)", () => {
    const source = read("modules/decisions/actions/human-review.actions.ts");
    const input = source.slice(source.indexOf("export interface CreateHumanDecisionInput"), source.indexOf("export type CreateHumanDecisionResult"));
    assert.doesNotMatch(input, /supportingData\?:/);
    assert.doesNotMatch(source, /input\.supportingData/);
  });
});

describe("Mission 210 — servidor como autoridade", () => {
  const decisionAction = read("modules/scenarios/actions/scenario-decision.actions.ts");
  const simulationActions = read("modules/scenarios/actions/scenario-simulation.actions.ts");

  test("confirmação: sessão, empresa ativa sob RLS e baseline atual antes de compor e gravar", () => {
    const body = decisionAction.slice(decisionAction.indexOf("export async function createScenarioDecisionAction"));
    const order = ["getCurrentUser()", "getCompanyById(input.companyId)", "resolveScenarioBaseline(input.companyId)", "composeScenarioDecision(", "saveHumanDecision("];
    const positions = order.map((needle) => body.indexOf(needle));
    assert.ok(positions.every((position) => position > 0), `faltando: ${order.filter((_, i) => positions[i] < 0).join(", ")}`);
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, "a ordem das checagens mudou");
    // `humanActorId` vem da sessão, nunca do input.
    assert.match(body, /composeScenarioDecision\(input, user\.id,/);
  });

  test("empresa encerrada: `getCompanyById` exclui `deleted_at` e o INSERT de `decisions` exige empresa ativa no banco", () => {
    const service = read("modules/companies/services/company.service.ts");
    const getById = service.slice(service.indexOf("export async function getCompanyById"), service.indexOf("export async function createCompany"));
    assert.match(getById, /\.is\("deleted_at", null\)/);
    const migration = read("supabase/migrations/20260926120000_company_offboarding.sql");
    const decisionsInsert = migration.slice(migration.indexOf('alter policy "decisions_insert_own"'));
    assert.match(decisionsInsert.slice(0, 500), /with check[\s\S]*c\.user_id = auth\.uid\(\)[\s\S]*c\.deleted_at is null/);
  });

  test("simulação e comparação do Chat recusam quando a âncora não confere — antes de simular", () => {
    for (const name of ["simulateScenarioAction", "compareScenariosAction"]) {
      const body = simulationActions.slice(simulationActions.indexOf(`export async function ${name}`));
      const check = body.indexOf("baselineClaimMatches(input.expectedBaselineIdentity, baseline.identity)");
      const simulate = body.indexOf("runSingleScenario(");
      assert.ok(check > 0 && check < simulate, `${name}: a âncora precisa ser checada antes de simular`);
    }
  });

  test("a âncora da resposta é calculada pelo servidor, pela mesma função, sobre o mesmo histórico", () => {
    const chatAction = read("modules/executive-chat/actions/executive-chat.actions.ts");
    assert.match(chatAction, /resolveScenarioBaselineFromHistory\(input\.companyId, history\)/);
    assert.match(chatAction, /baselineIdentity: anchor\.outcome === "ready" \? anchor\.identity : undefined/);
    assert.match(simulationActions, /return resolveScenarioBaselineFromHistory\(companyId, history\);/);
  });

  test("a âncora volta como reivindicação — nunca como contexto para o modelo", () => {
    const panel = read("modules/executive-chat/components/ExecutiveChatPanel.tsx");
    assert.match(panel, /turns\.map\(\(turn\) => \(\{ role: turn\.role, content: turn\.content \}\)\)/);
    assert.match(panel, /baselineIdentity=\{turn\.baselineIdentity\}/);
    const card = read("modules/executive-chat/components/ExecutiveChatActionCard.tsx");
    assert.match(card, /simulateScenarioAction\(\{ companyId, \.\.\.request, expectedBaselineIdentity: baselineIdentity \}\)/);
    const comparisonCard = read("modules/executive-chat/components/ExecutiveChatComparisonCard.tsx");
    assert.match(comparisonCard, /expectedBaselineIdentity: baselineIdentity/);
    for (const source of [card, comparisonCard]) {
      assert.match(source, /evaluatedBaselineIdentity=\{baselineIdentity\}/);
      assert.match(source, /proposedBy="executive-chat"/);
    }
  });
});

describe("Mission 210 — uma proposta, no máximo uma decisão", () => {
  test("o formulário bloqueia duplo envio e o cartão do Chat não reoferece a decisão depois de registrada", () => {
    const form = read("modules/scenarios/components/ScenarioDecisionForm.tsx");
    assert.match(form, /if \(!canSubmit \|\| submittingRef\.current\) return;/);
    assert.match(form, /submittingRef\.current = true;/);
    for (const path of ["modules/executive-chat/components/ExecutiveChatActionCard.tsx", "modules/executive-chat/components/ExecutiveChatComparisonCard.tsx"]) {
      const source = read(path);
      assert.match(source, /setDecided\(true\)/);
      const decidedBranch = source.indexOf("{decided ? (");
      assert.ok(decidedBranch > 0 && decidedBranch < source.indexOf("<ScenarioDecisionForm"), `${path}: depois de registrada, a confirmação substitui o formulário`);
    }
  });
});

describe("Mission 210 — sem segunda fonte de verdade", () => {
  const files = (dir: string): string[] =>
    readdirSync(join(ROOT, dir)).flatMap((name) => {
      const path = `${dir}/${name}`;
      return statSync(join(ROOT, path)).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  const productionFiles = [...files("modules"), ...files("app"), ...files("efos")];
  const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const callers = (needle: string) => {
    const definition = new RegExp(`export (async )?function ${needle.slice(0, -1)}\\(`);
    return productionFiles.filter((path) => {
      const source = withoutComments(read(path));
      return source.includes(needle) && !definition.test(source);
    });
  };

  test("uma composição e uma gravação de decisão humana", () => {
    assert.deepEqual(callers("createHumanDecision(").sort(), ["modules/decisions/actions/human-review.actions.ts", "modules/scenarios/lib/composeScenarioDecision.ts"]);
    assert.deepEqual(callers("saveHumanDecision(").sort(), ["modules/decisions/actions/human-review.actions.ts", "modules/scenarios/actions/scenario-decision.actions.ts"]);
    assert.deepEqual(callers("createScenarioDecisionAction(").sort(), ["modules/scenarios/components/ScenarioDecisionForm.tsx"]);
  });

  test("o Chat não cria decisão: só o formulário humano, pela ação de cenário existente", () => {
    for (const path of files("modules/executive-chat")) {
      const source = withoutComments(read(path));
      for (const forbidden of ["createHumanDecision", "saveHumanDecision", "createScenarioDecisionAction", "createHumanDecisionAction", "from(\"decisions\")"]) {
        assert.ok(!source.includes(forbidden), `${path} não pode usar ${forbidden}`);
      }
    }
  });

  test("o relatório não tem busca específica do Chat: a linhagem de cenário é a mesma", () => {
    const lineage = withoutComments(read("modules/reports/lib/report-lineage.ts"));
    assert.doesNotMatch(lineage, /chat/i);
    assert.match(lineage, /readScenarioDecisionContext\(persisted\.decision\.supportingData\)/);
  });

  test("o contexto financeiro não é copiado para texto livre: título, descrição e justificativa são da pessoa", () => {
    const decision = chatDecision;
    for (const text of [decision.title, decision.description, decision.rationale]) {
      assert.doesNotMatch(text, /Executive Chat|agosto|R\$/);
    }
  });
});

describe("Mission 210 — pontes existentes intactas", () => {
  test("Recomendação → Decisão: continua entrando pelo diagnóstico, nunca como cenário", () => {
    const recommendation = createHumanDecision(
      {
        humanActorId: ACTOR,
        diagnosisId: "m210-diagnostico",
        recommendationId: "m210-prioridade-1",
        companyId: COMPANY,
        type: "execute_immediately",
        priority: "high",
        confidence: "medium",
        title: "Revisar custos",
        description: "Renegociar contratos.",
        rationale: "Proteger a margem.",
      },
      "m210-decisao-recomendacao",
      STATE_AS_OF
    );
    assert.ok(recommendation.success);
    assert.equal(readScenarioDecisionContext(recommendation.value.supportingData), undefined);
    assert.equal(recommendation.value.basedOnRecommendationId, "m210-prioridade-1");
    const august = histories.healthy[1];
    const lineage = selectReportLineage(
      lineageInputs(august, {
        diagnoses: [{ id: "m210-diagnostico", companyId: COMPANY, executionId: august.executionId, diagnosis: {} as never, providerName: "m210", createdAt: STATE_AS_OF }],
        decisions: [persist(recommendation.value, "m210-diagnostico")],
      })
    );
    assert.deepEqual(lineage.decisions.map((link) => link.origin.kind), ["diagnosis"]);
  });

  test("Cenário (Scenario Lab) → Decisão: sem `proposedBy`, mesmo formato de contexto e mesmo rótulo", () => {
    const lab = confirm(
      COMPANY,
      histories.healthy,
      decisionRequest(COMPANY, turn.baselineIdentity, { kind: "operating_cost_change", operatingExpensesDeltaAmount: -20000, operatingExpensesDeltaCurrency: "BRL" }, { proposedBy: undefined }),
      "2026-09-11T12:00:00.000Z"
    );
    assert.ok(lab.success);
    const persistedShape = JSON.parse(JSON.stringify(lab.decision.supportingData)) as { scenarioContext: ScenarioDecisionContext };
    assert.deepEqual(Object.keys(persistedShape.scenarioContext).sort(), ["assumption", "baselineFingerprint", "comparison", "nature", "period", "scenarioType"]);

    const [, august] = histories.healthy;
    const reading = buildReportReading({
      history: histories.healthy,
      current: august,
      diagnoses: [],
      reviewsByDiagnosis: {},
      decisions: [persist(lab.decision), persist(chatDecision)],
      executionEvents: [],
      outcomes: [],
      financialObservations: [],
      learningRecords: [],
      knowledge: [],
      stateAsOf: STATE_AS_OF,
    });
    assert.ok(reading);
    const labels = Object.fromEntries(reading.decisions.map((entry) => [entry.id, entry.originLabel]));
    assert.match(labels[lab.decision.id], /^Cenário avaliado no Scenario Lab: /);
    assert.match(labels[chatDecision.id], /^Origem: Executive Chat — proposta na conversa e confirmada pela empresa\. Cenário: /);
    assert.deepEqual(reading.scenarios.map((entry) => entry.proposedBy ?? null).sort(), ["Executive Chat", null].sort());
  });
});

describe("Mission 210 — Outcome e Knowledge seguem a cadeia canônica", () => {
  test("Outcome, observação financeira e Esperado × Observado funcionam para a decisão vinda do Chat", async () => {
    const company = "m210-ciclo";
    const jan = await monthly(company, "01", 0.55);
    const feb = await monthly(company, "02", 0.6);
    const proposalTurn = await askChat(company, [jan, feb], "E se eu reduzir as despesas operacionais em 10 mil?");
    const createdAt = new Date(Date.parse(feb.executedAt) + 100).toISOString();
    const composed = confirm(company, [jan, feb], decisionRequest(company, proposalTurn.baselineIdentity, toScenarioRequest(scenarioProposal(proposalTurn).assumption)), createdAt);
    assert.ok(composed.success);
    const decision = composed.decision;

    const outcome = buildOutcome(
      { decisionId: decision.id, companyId: company, status: "positive", observedAt: createdAt, description: "Despesas reduzidas." },
      ACTOR,
      "m210-resultado",
      createdAt
    );
    assert.ok(outcome.success);
    assert.equal(outcome.value.decisionId, decision.id);

    const events: DecisionExecutionEvent[] = [
      { id: "m210-evento-1", decisionId: decision.id, companyId: company, status: "IN_PROGRESS", actorId: ACTOR, occurredAt: new Date(Date.parse(createdAt) + 100).toISOString() },
      { id: "m210-evento-2", decisionId: decision.id, companyId: company, status: "COMPLETED", actorId: ACTOR, occurredAt: new Date(Date.parse(createdAt) + 200).toISOString() },
    ];
    const mar = await monthly(company, "03", 0.65);
    const observation = buildFinancialOutcomeObservation(
      { id: decision.id, companyId: company, createdAt },
      deriveDecisionExecutionState(events),
      resolveDecisionFinancialBase({ decision, decisionCreatedAt: createdAt, history: [jan, feb, mar] }).base,
      resolveCurrentFinancialExecution(company, [jan, feb, mar]),
      outcome.value.id,
      ACTOR,
      "m210-observacao",
      STATE_AS_OF
    );
    assert.ok(observation.success, observation.success ? "" : JSON.stringify(observation.error));
    assert.equal(observation.value.window.observationExecutionId, mar.executionId);

    const expected = resolveExpectedActualComparison(decision, [jan, feb, mar]);
    assert.equal(expected.live.outcome, "built");

    const lineage = selectReportLineage(
      lineageInputs(mar, { history: [jan, feb, mar], decisions: [persist(decision)], financialObservations: [observation.value], outcomes: [outcome.value] })
    );
    assert.deepEqual(lineage.observedDecisions.map((entry) => entry.id), [decision.id]);
  });

  test("Knowledge derivado da decisão do Chat entra no relatório pela mesma cadeia", () => {
    const learning: LearningRecord = {
      id: "m210-aprendizado",
      companyId: COMPANY,
      type: "observation",
      confidence: "medium",
      title: "Corte de despesas",
      description: "Resultado registrado.",
      source: "user_feedback",
      decisions: [chatDecision.id],
      recommendations: [],
      reasonings: [],
      contexts: [],
      evidences: [],
      supportingData: {},
      outcomeIds: [],
      ...entity(STATE_AS_OF),
    };
    const knowledge: Knowledge = {
      id: "m210-conhecimento",
      companyId: COMPANY,
      category: "accumulated_learning",
      statement: "Cortes de despesa foram acompanhados de margem maior.",
      derivedFromOutcomeIds: [],
      derivedFromLearningRecordIds: [learning.id],
      ...entity(STATE_AS_OF),
    };
    const lineage = selectReportLineage(
      lineageInputs(histories.healthy[1], { decisions: [persist(chatDecision)], learningRecords: [learning], knowledge: [knowledge] })
    );
    assert.deepEqual(lineage.knowledge.map((record) => record.id), ["m210-conhecimento"]);
  });
});

describe("Mission 210 — fronteira entre empresas na leitura", () => {
  test("a decisão do Chat de outra empresa nunca entra no relatório, mesmo com o mesmo período", () => {
    const foreign = persist({ ...chatDecision, id: "m210-decisao-estrangeira", companyId: OTHER_COMPANY });
    const lineage = selectReportLineage(lineageInputs(histories.healthy[1], { decisions: [foreign, { ...persist(chatDecision), id: "m210-linha-estrangeira", companyId: OTHER_COMPANY }] }));
    assert.deepEqual(lineage.decisions, []);
  });
});

describe("Mission 210 — apresentação", () => {
  const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");

  test("o cartão do Chat é uma proposta que exige confirmação; sem âncora, não oferece simulação", () => {
    const proposal = scenarioProposal(turn);
    const withAnchor = strip(renderToStaticMarkup(createElement(ExecutiveChatActionCard, { companyId: COMPANY, action: proposal, baselineIdentity: turn.baselineIdentity })));
    assert.match(withAnchor, /Simular/);
    assert.doesNotMatch(withAnchor, /Executado|Criad[ao]|Decisão da IA/);
    const withoutAnchorHtml = renderToStaticMarkup(createElement(ExecutiveChatActionCard, { companyId: COMPANY, action: proposal }));
    assert.doesNotMatch(withoutAnchorHtml, /<button/);
    assert.match(strip(withoutAnchorHtml), /Simulação indisponível para esta resposta/);
  });

  test("no relatório: decisão da empresa com origem no Executive Chat, nunca decisão da IA", () => {
    const [, august] = histories.healthy;
    const reading = buildReportReading({
      history: histories.healthy,
      current: august,
      diagnoses: [],
      reviewsByDiagnosis: {},
      decisions: [persist(chatDecision)],
      executionEvents: [],
      outcomes: [],
      financialObservations: [],
      learningRecords: [],
      knowledge: [],
      stateAsOf: STATE_AS_OF,
    });
    assert.ok(reading);
    const text = strip(
      renderToStaticMarkup(createElement(ReportDocument, { company: { id: COMPANY, razao_social: "EMPRESA SINTÉTICA M210", cnpj: "11222333000181" }, reading }))
    );
    assert.match(text, /Decisão da empresa/);
    assert.match(text, /Origem: Executive Chat/);
    assert.doesNotMatch(text, /Decisão da IA|decisão da IA|a IA decidiu/);
    assert.doesNotMatch(text, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  });
});
