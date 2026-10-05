import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, test } from "node:test";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { readScenarioDecisionContext } from "@/efos/application/decision-lifecycle";
import { DefaultHistoricalExecutionService } from "@/efos/application/history";
import type { Decision } from "@/efos/domain";
import { SupabasePersistenceClient } from "@/efos/infrastructure/providers";
import { SupabaseExecutionRepository } from "@/efos/infrastructure/repositories";
import type { PersistedDecision } from "@/modules/decisions/services/decision-persistence.service";
import { selectReportLineage } from "@/modules/reports/lib/report-lineage";
import { composeScenarioDecision } from "@/modules/scenarios/lib/composeScenarioDecision";
import { resolveScenarioBaselineFromHistory } from "@/modules/scenarios/lib/resolveScenarioBaselineFromHistory";
import type { Database } from "@/types/database";

import { buildSyntheticExecution } from "../production-surface/fixtures/report-fixtures";

/**
 * Mission 210 — a decisão tomada a partir de uma proposta do Executive Chat,
 * de ponta a ponta contra um Supabase LOCAL e descartável: a âncora é
 * calculada sobre o histórico LIDO DO BANCO com a sessão do dono (como faz
 * a ação do Chat), a decisão é gravada em `public.decisions` sob RLS (mesma
 * forma de linha de `saveHumanDecision()`), lida de volta e encontrada pela
 * linhagem do relatório. Dois usuários reais do Auth local, nunca
 * `service_role`.
 *
 * Como rodar (nunca contra o NEXO Pilot): ver
 * `report-tenant-boundary.local.test.ts` — `npm run test:reports-local`.
 */

const URL = process.env.SUPABASE_LOCAL_URL ?? "";
const ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY ?? "";

type Client = SupabaseClient<Database>;
type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];

function assertLocalTarget(): void {
  assert.ok(URL && ANON_KEY, "defina SUPABASE_LOCAL_URL e SUPABASE_LOCAL_ANON_KEY (npx supabase status -o env)");
  const host = new globalThis.URL(URL).hostname;
  assert.ok(host === "127.0.0.1" || host === "localhost", `recusado: ${host} não é um Supabase local`);
}

/** Mesma espera da prova da Mission 208 (`PGRST303 JWT issued at future` no relógio do container). */
async function untilSessionAccepted(client: Client): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { error } = await client.from("companies").select("id").limit(1);
    if (!error) return;
    if (error.code !== "PGRST303") throw error;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("o PostgREST local não aceitou a sessão nova em 10s");
}

async function newUser(): Promise<{ client: Client; id: string }> {
  const client = createClient<Database>(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signUp({ email: `m210-${randomUUID()}@reports.local.test`, password: randomUUID() });
  if (error || !data.user || !data.session) throw new Error(`signup local falhou: ${error?.message ?? "sem sessão"}`);
  await untilSessionAccepted(client);
  return { client, id: data.user.id };
}

async function newCompany(owner: { client: Client; id: string }, cnpj: string): Promise<string> {
  const { data, error } = await owner.client
    .from("companies")
    .insert({ user_id: owner.id, razao_social: `SMOKE M210 ${cnpj}`, cnpj })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

function historyService(client: Client) {
  return new DefaultHistoricalExecutionService(new SupabaseExecutionRepository(new SupabasePersistenceClient(client)));
}

/** Mesma forma de linha de `saveHumanDecision()`. */
function decisionRow(decision: Decision) {
  return {
    id: decision.id,
    company_id: decision.companyId,
    diagnosis_id: decision.basedOnDiagnosisId ?? null,
    review_id: decision.basedOnReviewId ?? null,
    human_actor_id: decision.humanActorId ?? null,
    decision: decision as unknown as Database["public"]["Tables"]["decisions"]["Insert"]["decision"],
  };
}

function toPersisted(row: DecisionRow): PersistedDecision {
  return {
    id: row.id,
    companyId: row.company_id,
    diagnosisId: row.diagnosis_id,
    reviewId: row.review_id,
    humanActorId: row.human_actor_id,
    decision: row.decision as unknown as Decision,
    createdAt: row.created_at,
  };
}

describe("Mission 210 — decisão vinda do Chat respeita a fronteira de empresa (Supabase local)", () => {
  let ownerA: { client: Client; id: string };
  let ownerB: { client: Client; id: string };
  let companyA: string;
  let companyB: string;
  let chatDecision: Decision;

  before(async () => {
    assertLocalTarget();
    [ownerA, ownerB] = await Promise.all([newUser(), newUser()]);
    [companyA, companyB] = await Promise.all([newCompany(ownerA, "11222333000181"), newCompany(ownerB, "99888777000161")]);
    const execution = await buildSyntheticExecution(companyA, randomUUID(), new Date().toISOString());
    await new SupabaseExecutionRepository(new SupabasePersistenceClient(ownerA.client)).save(execution.snapshot);
  });

  test("A: âncora sobre o histórico lido do banco → decisão gravada sob RLS → o relatório de A a encontra", async () => {
    const history = await historyService(ownerA.client).getHistory(companyA);
    const anchor = resolveScenarioBaselineFromHistory(companyA, history);
    assert.equal(anchor.outcome, "ready");
    if (anchor.outcome !== "ready") return;

    const composed = composeScenarioDecision(
      {
        companyId: companyA,
        evaluatedBaselineIdentity: anchor.identity,
        request: { kind: "operating_cost_change", operatingExpensesDeltaAmount: -10000, operatingExpensesDeltaCurrency: "BRL" },
        proposedBy: "executive-chat",
        type: "prioritize_sequence",
        priority: "high",
        confidence: "medium",
        title: "Reduzir despesas operacionais",
        description: "Cortar despesas administrativas.",
        rationale: "Proteger a margem do período.",
      },
      ownerA.id,
      anchor,
      randomUUID(),
      new Date().toISOString()
    );
    assert.ok(composed.success);
    if (!composed.success) return;
    chatDecision = composed.decision;

    const { error } = await ownerA.client.from("decisions").insert(decisionRow(chatDecision));
    assert.equal(error, null);

    const { data: rows, error: readError } = await ownerA.client.from("decisions").select("*").eq("company_id", companyA);
    assert.equal(readError, null);
    const persisted = (rows ?? []).map(toPersisted);
    const roundTripped = persisted.find((row) => row.id === chatDecision.id);
    assert.ok(roundTripped);
    assert.equal(readScenarioDecisionContext(roundTripped.decision.supportingData)?.proposedBy, "executive-chat");

    const lineage = selectReportLineage({
      current: history[history.length - 1],
      diagnoses: [],
      decisions: persisted,
      financialObservations: [],
      outcomes: [],
      learningRecords: [],
      knowledge: [],
    });
    assert.deepEqual(lineage.decisions.map((link) => link.decision.id), [chatDecision.id]);
  });

  test("B não grava decisão na empresa de A, não lê as decisões de A e não assina como A", async () => {
    const forged: Decision = { ...chatDecision, id: randomUUID(), humanActorId: ownerB.id };
    const { error: crossInsert } = await ownerB.client.from("decisions").insert(decisionRow(forged));
    assert.ok(crossInsert, "RLS recusa decisão com company_id de outra empresa");

    const { data: visible, error: readError } = await ownerB.client.from("decisions").select("id").eq("company_id", companyA);
    assert.equal(readError, null);
    assert.deepEqual(visible, [], "as decisões de A não existem para B");

    const impersonated: Decision = { ...chatDecision, id: randomUUID(), companyId: companyB, humanActorId: ownerA.id };
    const { error: actorError } = await ownerB.client.from("decisions").insert(decisionRow(impersonated));
    assert.ok(actorError, "RLS recusa autoria humana que não é a da sessão");
  });

  test("empresa encerrada não recebe decisão nova", async () => {
    const closing = await newCompany(ownerA, "11444777000161");
    const { error: closeError } = await ownerA.client.from("companies").update({ deleted_at: new Date().toISOString() }).eq("id", closing);
    assert.equal(closeError, null);

    const late: Decision = { ...chatDecision, id: randomUUID(), companyId: closing };
    const { error } = await ownerA.client.from("decisions").insert(decisionRow(late));
    assert.ok(error, "RLS recusa decisão para empresa encerrada");
  });
});
