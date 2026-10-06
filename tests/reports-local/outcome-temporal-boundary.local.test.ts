import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, test } from "node:test";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { deriveDecisionExecutionState } from "@/efos/application/decision-execution/deriveDecisionExecutionState";
import { buildFinancialOutcomeObservation, keepPosteriorObservations, type FinancialOutcomeObservation } from "@/efos/application/financial-observation";
import { DefaultHistoricalExecutionService, positionedExecutionOf, type HistoricalExecution } from "@/efos/application/history";
import type { Decision } from "@/efos/domain";
import { SupabasePersistenceClient } from "@/efos/infrastructure/providers";
import { SupabaseExecutionRepository } from "@/efos/infrastructure/repositories";
import { resolveDecisionFinancialBase } from "@/modules/decisions/lib/resolveDecisionFinancialBase";
import { resolveCurrentFinancialExecution } from "@/modules/decisions/lib/selectCurrentFinancialExecution";
import { composeScenarioDecision } from "@/modules/scenarios/lib/composeScenarioDecision";
import { resolveScenarioBaselineFromHistory } from "@/modules/scenarios/lib/resolveScenarioBaselineFromHistory";
import type { Database } from "@/types/database";

import { monthly } from "../production-surface/fixtures/temporal-fixtures";

/**
 * Mission 211 — integridade temporal do resultado de uma decisão contra um
 * Supabase LOCAL e descartável: a base vem do histórico LIDO DO BANCO com a
 * sessão do dono, a observação de setembro é gravada sob RLS (mesma forma de
 * linha de `saveFinancialOutcomeObservation()`) e relida pela mesma regra da
 * porta de leitura (`keepPosteriorObservations`). Dois usuários reais do Auth
 * local, nunca `service_role`.
 *
 * Como rodar (nunca contra o NEXO Pilot): ver
 * `report-tenant-boundary.local.test.ts` — `npm run test:reports-local`.
 */

const URL = process.env.SUPABASE_LOCAL_URL ?? "";
const ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY ?? "";

type Client = SupabaseClient<Database>;
type Owner = { client: Client; id: string };
type ObservationRow = Database["public"]["Tables"]["financial_observations"]["Row"];

function assertLocalTarget(): void {
  assert.ok(URL && ANON_KEY, "defina SUPABASE_LOCAL_URL e SUPABASE_LOCAL_ANON_KEY (npx supabase status -o env)");
  const host = new globalThis.URL(URL).hostname;
  assert.ok(host === "127.0.0.1" || host === "localhost", `recusado: ${host} não é um Supabase local`);
}

async function untilSessionAccepted(client: Client): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { error } = await client.from("companies").select("id").limit(1);
    if (!error) return;
    if (error.code !== "PGRST303") throw error;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("o PostgREST local não aceitou a sessão nova em 10s");
}

async function newUser(): Promise<Owner> {
  const client = createClient<Database>(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signUp({ email: `m211-${randomUUID()}@reports.local.test`, password: randomUUID() });
  if (error || !data.user || !data.session) throw new Error(`signup local falhou: ${error?.message ?? "sem sessão"}`);
  await untilSessionAccepted(client);
  return { client, id: data.user.id };
}

async function newCompany(owner: Owner, cnpj: string): Promise<string> {
  const { data, error } = await owner.client.from("companies").insert({ user_id: owner.id, razao_social: `SMOKE M211 ${cnpj}`, cnpj }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function saveMonth(owner: Owner, companyId: string, month: string, costRatio: number): Promise<void> {
  const execution = await monthly(companyId, month, costRatio, "v1", randomUUID());
  await new SupabaseExecutionRepository(new SupabasePersistenceClient(owner.client)).save(execution.snapshot);
}

function historyOf(owner: Owner, companyId: string): Promise<readonly HistoricalExecution[]> {
  return new DefaultHistoricalExecutionService(new SupabaseExecutionRepository(new SupabasePersistenceClient(owner.client))).getHistory(companyId);
}

async function decideOnCurrentTruth(owner: Owner, companyId: string): Promise<Decision> {
  const history = await historyOf(owner, companyId);
  const baseline = resolveScenarioBaselineFromHistory(companyId, history);
  assert.equal(baseline.outcome, "ready");
  if (baseline.outcome !== "ready") throw new Error("baseline");
  const composed = composeScenarioDecision(
    {
      companyId,
      evaluatedBaselineIdentity: baseline.identity,
      request: { kind: "operating_cost_change", operatingExpensesDeltaAmount: -10000, operatingExpensesDeltaCurrency: "BRL" },
      type: "prioritize_sequence",
      priority: "high",
      confidence: "medium",
      title: "Reduzir despesas operacionais",
      description: "Cortar despesas administrativas.",
      rationale: "Proteger a margem.",
    },
    owner.id,
    baseline,
    randomUUID(),
    new Date().toISOString()
  );
  assert.ok(composed.success);
  if (!composed.success) throw new Error("decisão");
  const decision = composed.decision;
  const { error } = await owner.client.from("decisions").insert({
    id: decision.id,
    company_id: companyId,
    diagnosis_id: null,
    review_id: null,
    human_actor_id: owner.id,
    decision: decision as unknown as Database["public"]["Tables"]["decisions"]["Insert"]["decision"],
  });
  if (error) throw error;
  return decision;
}

function observationRow(observation: FinancialOutcomeObservation, overrides: Partial<Database["public"]["Tables"]["financial_observations"]["Insert"]> = {}) {
  return {
    id: observation.id,
    decision_id: observation.decisionId,
    company_id: observation.companyId,
    human_outcome_id: null,
    computed_by: observation.computedBy,
    classification: observation.classification,
    baseline_execution_id: observation.window.baselineExecutionId,
    baseline_executed_at: observation.window.baselineExecutedAt,
    observation_execution_id: observation.window.observationExecutionId,
    observation_executed_at: observation.window.observationExecutedAt,
    metrics: observation.metrics as unknown as Database["public"]["Tables"]["financial_observations"]["Insert"]["metrics"],
    computed_at: observation.computedAt,
    ...overrides,
  };
}

function toObservation(row: ObservationRow): FinancialOutcomeObservation {
  return {
    id: row.id,
    decisionId: row.decision_id,
    companyId: row.company_id,
    computedBy: row.computed_by,
    computedAt: row.computed_at,
    classification: row.classification,
    window: {
      decisionId: row.decision_id,
      baselineExecutionId: row.baseline_execution_id,
      baselineExecutedAt: row.baseline_executed_at,
      observationExecutionId: row.observation_execution_id,
      observationExecutedAt: row.observation_executed_at,
    },
    metrics: row.metrics as unknown as FinancialOutcomeObservation["metrics"],
  };
}

describe("Mission 211 — resultado de decisão: período posterior e fronteira de empresa (Supabase local)", () => {
  let ownerA: Owner;
  let ownerB: Owner;
  let companyA: string;
  let companyB: string;
  let decision: Decision;
  let observation: FinancialOutcomeObservation;

  before(async () => {
    assertLocalTarget();
    [ownerA, ownerB] = await Promise.all([newUser(), newUser()]);
    [companyA, companyB] = await Promise.all([newCompany(ownerA, "11222333000181"), newCompany(ownerB, "99888777000161")]);
    await saveMonth(ownerA, companyA, "08", 0.6);
    await saveMonth(ownerB, companyB, "09", 0.5);
    decision = await decideOnCurrentTruth(ownerA, companyA);
  });

  test("agosto de base: sem setembro, nada é observado; com setembro, a observação é gravada e relida como resultado", async () => {
    // Execução concluída logo depois da análise de agosto (as fixtures usam instantes fixos de execução).
    const [august] = await historyOf(ownerA, companyA);
    const completedAt = new Date(Date.parse(august.executedAt) + 100).toISOString();
    const state = deriveDecisionExecutionState([
      { id: randomUUID(), decisionId: decision.id, companyId: companyA, status: "IN_PROGRESS", actorId: ownerA.id, occurredAt: completedAt },
      { id: randomUUID(), decisionId: decision.id, companyId: companyA, status: "COMPLETED", actorId: ownerA.id, occurredAt: completedAt },
    ]);
    const observeNow = async () => {
      const history = await historyOf(ownerA, companyA);
      const { base } = resolveDecisionFinancialBase({ decision, decisionCreatedAt: decision.audit.createdAt, history });
      return buildFinancialOutcomeObservation(
        { id: decision.id, companyId: companyA, createdAt: decision.audit.createdAt },
        state,
        base,
        resolveCurrentFinancialExecution(companyA, history),
        undefined,
        ownerA.id,
        randomUUID(),
        new Date().toISOString()
      );
    };

    const tooEarly = await observeNow();
    assert.ok(!tooEarly.success && tooEarly.error.code === "NOT_AFTER_DECISION_BASE");

    await saveMonth(ownerA, companyA, "09", 0.5);
    const built = await observeNow();
    assert.ok(built.success, built.success ? "" : JSON.stringify(built.error));
    observation = built.value;
    const { error } = await ownerA.client.from("financial_observations").insert(observationRow(observation));
    assert.equal(error, null);

    const { data: rows } = await ownerA.client.from("financial_observations").select("*").eq("decision_id", decision.id);
    const history = await historyOf(ownerA, companyA);
    const kept = keepPosteriorObservations((rows ?? []).map(toObservation), history.map(positionedExecutionOf));
    assert.deepEqual(kept.map((entry) => entry.id), [observation.id]);
    assert.ok(kept[0].window.baselinePeriod && kept[0].window.observationPeriod);
  });

  test("B não lê nem grava observação na decisão de A; A não cita execução de B", async () => {
    const { data: visible, error: readError } = await ownerB.client.from("financial_observations").select("id").eq("decision_id", decision.id);
    assert.equal(readError, null);
    assert.deepEqual(visible, [], "as observações de A não existem para B");

    const { error: crossInsert } = await ownerB.client
      .from("financial_observations")
      .insert(observationRow({ ...observation, id: randomUUID(), computedBy: ownerB.id }));
    assert.ok(crossInsert, "RLS recusa observação na decisão de outra empresa");

    const [executionB] = await historyOf(ownerB, companyB);
    const { error: foreignExecution } = await ownerA.client.from("financial_observations").insert(
      observationRow({ ...observation, id: randomUUID() }, { observation_execution_id: executionB.executionId, observation_executed_at: executionB.executedAt })
    );
    assert.ok(foreignExecution, "RLS recusa observação que cita execução de outra empresa");
  });

  test("empresa encerrada não recebe observação nova", async () => {
    const closing = await newCompany(ownerA, "11444777000161");
    await saveMonth(ownerA, closing, "08", 0.6);
    const closingDecision = await decideOnCurrentTruth(ownerA, closing);
    const { error: closeError } = await ownerA.client.from("companies").update({ deleted_at: new Date().toISOString() }).eq("id", closing);
    assert.equal(closeError, null);

    const [execution] = await historyOf(ownerA, companyA);
    const { error } = await ownerA.client.from("financial_observations").insert(
      observationRow({ ...observation, id: randomUUID(), decisionId: closingDecision.id, companyId: closing }, {
        baseline_execution_id: execution.executionId,
        observation_execution_id: execution.executionId,
      })
    );
    assert.ok(error, "RLS recusa observação para empresa encerrada");
  });
});
