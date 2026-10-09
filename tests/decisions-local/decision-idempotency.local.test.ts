import assert from "node:assert/strict";
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { before, describe, test } from "node:test";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { createHumanDecision } from "@/efos/application/decision-lifecycle/createHumanDecision";
import { readScenarioDecisionContext } from "@/efos/application/decision-lifecycle";
import { DefaultHistoricalExecutionService } from "@/efos/application/history";
import type { Decision } from "@/efos/domain";
import { SupabasePersistenceClient } from "@/efos/infrastructure/providers";
import { SupabaseExecutionRepository } from "@/efos/infrastructure/repositories";
import { submitDecisionOnce, type DecisionSubmissionResult } from "@/modules/decisions/lib/decisionIdempotency";
import {
  humanDecisionRequestPayload,
  scenarioDecisionRequestPayload,
  type HumanDecisionRequestFields,
} from "@/modules/decisions/lib/decisionRequest";
import { deriveDecisionRequestFingerprint } from "@/modules/decisions/lib/decisionRequestFingerprint";
import { findDecisionBySubmission, saveHumanDecision } from "@/modules/decisions/services/decision-persistence.service";
import { composeScenarioDecision, type ScenarioDecisionRequest } from "@/modules/scenarios/lib/composeScenarioDecision";
import { resolveScenarioBaselineFromHistory } from "@/modules/scenarios/lib/resolveScenarioBaselineFromHistory";
import type { Database } from "@/types/database";

import { monthly } from "../production-surface/fixtures/temporal-fixtures";

/**
 * Mission 214 — Governed Decision Idempotency (D-137), de ponta a ponta
 * contra um Supabase LOCAL e descartável.
 *
 * Usa as MESMAS peças das duas ações que criam Decision — o fluxo único
 * `submitDecisionOnce()`, a impressão `deriveDecisionRequestFingerprint()`,
 * `findDecisionBySubmission()` e a gravação única `saveHumanDecision()` —
 * com a sessão de usuários reais do Auth local (PostgREST + RLS), nunca
 * `service_role`. Sessão e empresa (RLS, aberta), que as ações checam
 * antes, aparecem aqui como a policy do banco.
 *
 * O caso "vencedor que desfaz / confirma" usa uma sessão `psql` no
 * container do banco local, sincronizada por advisory lock e por
 * `pg_stat_activity` — sem esperas por tempo.
 *
 * Como rodar (nunca contra o NEXO Pilot):
 *   npx supabase start
 *   (exportar SUPABASE_LOCAL_URL e SUPABASE_LOCAL_ANON_KEY a partir de `npx supabase status -o env`;
 *    SUPABASE_LOCAL_DB_CONTAINER se o container do banco não for `supabase_db_nexo-platform`)
 *   npm run test:decisions-local
 */

const URL = process.env.SUPABASE_LOCAL_URL ?? "";
const ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY ?? "";
const DB_CONTAINER = process.env.SUPABASE_LOCAL_DB_CONTAINER ?? "supabase_db_nexo-platform";

type Client = SupabaseClient<Database>;
type Owner = { client: Client; id: string };
type Result = DecisionSubmissionResult<{ stage: string; error: string }>;

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
  const { data, error } = await client.auth.signUp({ email: `m214-${randomUUID()}@decisions.local.test`, password: randomUUID() });
  if (error || !data.user || !data.session) throw new Error(`signup local falhou: ${error?.message ?? "sem sessão"}`);
  await untilSessionAccepted(client);
  return { client, id: data.user.id };
}

async function newCompany(owner: Owner, cnpj: string): Promise<string> {
  const { data, error } = await owner.client.from("companies").insert({ user_id: owner.id, razao_social: `SMOKE M214 ${cnpj}`, cnpj }).select("id").single();
  if (error) throw error;
  return data.id;
}

const MANUAL: HumanDecisionRequestFields = {
  type: "prioritize_sequence",
  priority: "high",
  confidence: "medium",
  title: "Renegociar contratos de fornecedores",
  description: "Renegociar os três maiores contratos.",
  rationale: "Proteger a margem.",
};

/** Decisão humana (Recomendação ou Manual) pelo fluxo único, como `createHumanDecisionAction()`. */
function submitHuman(owner: Owner, companyId: string, fields: HumanDecisionRequestFields, key: string): Promise<Result> {
  const requestFingerprint = deriveDecisionRequestFingerprint(
    { entrypoint: "human-decision", companyId, humanActorId: owner.id },
    humanDecisionRequestPayload(fields)
  );
  assert.ok(requestFingerprint);
  return submitDecisionOnce({
    requestFingerprint,
    findExisting: () => findDecisionBySubmission(companyId, owner.id, key, owner.client),
    validateAndCompose: async () => {
      const built = createHumanDecision({ humanActorId: owner.id, companyId, ...fields }, randomUUID(), new Date().toISOString());
      return built.success ? { ok: true, decision: built.value } : { ok: false, failure: { stage: "command", error: "inválido" } };
    },
    save: (decision: Decision) => saveHumanDecision(decision, { idempotencyKey: key, requestFingerprint }, owner.client),
  });
}

function historyOf(owner: Owner, companyId: string) {
  return new DefaultHistoricalExecutionService(new SupabaseExecutionRepository(new SupabasePersistenceClient(owner.client))).getHistory(companyId);
}

/** Decisão de cenário/Chat pelo fluxo único, como `createScenarioDecisionAction()`: baseline lido do banco. */
function submitScenario(owner: Owner, request: ScenarioDecisionRequest, key: string, validations: { count: number }): Promise<Result> {
  const requestFingerprint = deriveDecisionRequestFingerprint(
    { entrypoint: "scenario-decision", companyId: request.companyId, humanActorId: owner.id },
    scenarioDecisionRequestPayload(request)
  );
  assert.ok(requestFingerprint);
  return submitDecisionOnce({
    requestFingerprint,
    findExisting: () => findDecisionBySubmission(request.companyId, owner.id, key, owner.client),
    validateAndCompose: async () => {
      validations.count += 1;
      const baseline = resolveScenarioBaselineFromHistory(request.companyId, await historyOf(owner, request.companyId));
      if (baseline.outcome === "rejected") return { ok: false, failure: { stage: "financial-truth", error: baseline.error } };
      const composed = composeScenarioDecision(request, owner.id, baseline, randomUUID(), new Date().toISOString());
      return composed.success ? { ok: true, decision: composed.decision } : { ok: false, failure: { stage: composed.stage, error: composed.error } };
    },
    save: (decision: Decision) => saveHumanDecision(decision, { idempotencyKey: key, requestFingerprint }, owner.client),
    recheckAfter: (failure) => failure.stage === "financial-truth" || failure.stage === "stale-baseline",
  });
}

async function rowsWithKey(owner: Owner, companyId: string, key: string): Promise<number> {
  const { count, error } = await owner.client
    .from("decisions")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("idempotency_key", key);
  if (error) throw error;
  return count ?? 0;
}

function idOf(result: Result): string | undefined {
  return result.outcome === "CREATED" || result.outcome === "REPLAYED" ? result.decision.id : undefined;
}

// --- psql no container do banco local (só para o caso com transação aberta) ---

function psql(sql: string): string {
  return execFileSync("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-X", "-At", "-v", "ON_ERROR_STOP=1"], {
    input: sql,
    encoding: "utf8",
  }).trim();
}

function openPsql(): { process: ChildProcessWithoutNullStreams; output: () => string; exited: Promise<number | null> } {
  const child = spawn("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-X", "-At", "-v", "ON_ERROR_STOP=1"]);
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  const exited = new Promise<number | null>((resolve) => child.on("close", resolve));
  return { process: child, output: () => output, exited };
}

async function until(condition: () => boolean, what: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`não aconteceu: ${what}`);
}

/**
 * Uma transação do dono insere a linha com a chave e PARA (advisory lock do
 * controlador); o pedido do app com a mesma chave fica esperando no índice
 * único; só então a transação termina com `rollback` ou `commit`.
 */
async function racePendingWinner(owner: Owner, companyId: string, fields: HumanDecisionRequestFields, end: "rollback" | "commit"): Promise<{ result: Result; key: string }> {
  const key = randomUUID();
  const lock = Math.floor(Math.random() * 1_000_000_000);
  const fingerprint = deriveDecisionRequestFingerprint({ entrypoint: "human-decision", companyId, humanActorId: owner.id }, humanDecisionRequestPayload(fields));
  assert.ok(fingerprint);

  const controller = openPsql();
  controller.process.stdin.write(`select 'locked' from pg_advisory_lock(${lock});\n`);
  await until(() => controller.output().includes("locked"), "controlador com o lock");

  const winner = openPsql();
  winner.process.stdin.end(
    [
      "begin;",
      "set local role authenticated;",
      `select set_config('request.jwt.claims', '{"sub":"${owner.id}","role":"authenticated"}', true) is not null;`,
      `insert into public.decisions (company_id, human_actor_id, decision, idempotency_key, request_fingerprint) values ('${companyId}', '${owner.id}', '{"title":"vencedor"}', '${key}', '${fingerprint}');`,
      `select pg_advisory_xact_lock(${lock});`,
      `${end};`,
      "",
    ].join("\n")
  );
  const waiting = (event: string) => Number(psql(`select count(*) from pg_stat_activity where wait_event_type in ('Lock') and wait_event = '${event}';`));
  await until(() => waiting("advisory") >= 1, "vencedor parado com a linha inserida");

  const pending = submitHuman(owner, companyId, fields, key);
  await until(() => waiting("transactionid") >= 1, "pedido do app esperando no índice único");

  controller.process.stdin.end(`select pg_advisory_unlock(${lock});\n\\q\n`);
  assert.equal(await winner.exited, 0, winner.output());
  await controller.exited;
  return { result: await pending, key };
}

describe("Mission 214 — idempotência da criação de Decision (Supabase local)", () => {
  let ownerA: Owner;
  let ownerB: Owner;
  let companyA: string;
  let companyAClosed: string;
  let companyB: string;
  let diagnosisA: string;

  before(async () => {
    assertLocalTarget();
    [ownerA, ownerB] = await Promise.all([newUser(), newUser()]);
    [companyA, companyAClosed, companyB] = await Promise.all([
      newCompany(ownerA, "11222333000181"),
      newCompany(ownerA, "99888777000161"),
      newCompany(ownerB, "11222333000181"),
    ]);
    const august = await monthly(companyA, "08", 0.62, "v1", randomUUID());
    await new SupabaseExecutionRepository(new SupabasePersistenceClient(ownerA.client)).save(august.snapshot);
    const { data, error } = await ownerA.client
      .from("executive_diagnoses")
      .insert({ company_id: companyA, execution_id: august.executionId, provider_name: "m214-local", diagnosis: {} })
      .select("id")
      .single();
    if (error) throw error;
    diagnosisA = data.id;
  });

  test("Recomendação: o mesmo pedido de novo (resposta perdida) devolve a MESMA Decision; 1 linha", async () => {
    const fields = { ...MANUAL, diagnosisId: diagnosisA, recommendationId: "action-1" };
    const key = randomUUID();
    const first = await submitHuman(ownerA, companyA, fields, key);
    assert.equal(first.outcome, "CREATED");
    // a resposta "se perdeu": o formulário reenvia com a mesma chave
    const retry = await submitHuman(ownerA, companyA, fields, key);
    assert.equal(retry.outcome, "REPLAYED");
    assert.equal(idOf(retry), idOf(first));
    assert.equal(await rowsWithKey(ownerA, companyA, key), 1);

    // outra chave, mesma recomendação: nova intenção legítima
    const again = await submitHuman(ownerA, companyA, fields, randomUUID());
    assert.equal(again.outcome, "CREATED");
    assert.notEqual(idOf(again), idOf(first));
  });

  test("Manual: 10 pedidos simultâneos com a mesma chave → 10 sucessos, 1 Decision", async () => {
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 10 }, () => submitHuman(ownerA, companyA, MANUAL, key)));
    assert.equal(results.filter((r) => r.outcome === "CREATED").length, 1);
    assert.equal(results.filter((r) => r.outcome === "REPLAYED").length, 9);
    assert.equal(new Set(results.map(idOf)).size, 1);
    assert.equal(await rowsWithKey(ownerA, companyA, key), 1);
  });

  test("mesma chave + outro pedido: recusa em sequência e em corrida — nunca 2 Decisions", async () => {
    const key = randomUUID();
    assert.equal((await submitHuman(ownerA, companyA, MANUAL, key)).outcome, "CREATED");
    const changed = await submitHuman(ownerA, companyA, { ...MANUAL, rationale: "Outra justificativa." }, key);
    assert.equal(changed.outcome, "KEY_REUSED_WITH_DIFFERENT_PAYLOAD");
    assert.equal(await rowsWithKey(ownerA, companyA, key), 1);
    const kept = await findDecisionBySubmission(companyA, ownerA.id, key, ownerA.client);
    assert.equal(kept?.decision.decision.rationale, MANUAL.rationale, "a Decision gravada não é substituída");

    const raceKey = randomUUID();
    const other = { ...MANUAL, title: "Outra decisão" };
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => submitHuman(ownerA, companyA, i % 2 === 0 ? MANUAL : other, raceKey)));
    const created = results.filter((r) => r.outcome === "CREATED");
    assert.equal(created.length, 1);
    const winnerTitle = created[0].outcome === "CREATED" ? created[0].decision.decision.title : "";
    for (const [i, result] of results.entries()) {
      const title = i % 2 === 0 ? MANUAL.title : other.title;
      assert.equal(result.outcome === "KEY_REUSED_WITH_DIFFERENT_PAYLOAD", title !== winnerTitle, `pedido ${i}: ${result.outcome}`);
    }
    assert.equal(await rowsWithKey(ownerA, companyA, raceKey), 1);
  });

  test("outra chave + mesmo pedido: nova Decision (sem deduplicação semântica)", async () => {
    const first = await submitHuman(ownerA, companyA, MANUAL, randomUUID());
    const second = await submitHuman(ownerA, companyA, MANUAL, randomUUID());
    assert.equal(first.outcome, "CREATED");
    assert.equal(second.outcome, "CREATED");
    assert.notEqual(idOf(first), idOf(second));
  });

  test("vencedor que DESFAZ: o pedido que esperava no índice grava (CREATED); 1 linha", async () => {
    const { result, key } = await racePendingWinner(ownerA, companyA, MANUAL, "rollback");
    assert.equal(result.outcome, "CREATED");
    assert.equal(await rowsWithKey(ownerA, companyA, key), 1);
  });

  test("vencedor que CONFIRMA: o pedido que esperava no índice vira reenvio (REPLAYED) da linha vencedora", async () => {
    const { result, key } = await racePendingWinner(ownerA, companyA, MANUAL, "commit");
    assert.equal(result.outcome, "REPLAYED");
    assert.equal(result.outcome === "REPLAYED" ? result.decision.decision.title : "", "vencedor");
    assert.equal(await rowsWithKey(ownerA, companyA, key), 1);
  });

  test("Cenário/Chat: âncora desatualizada recusa ANTES da 1ª gravação; depois de gravada, o reenvio devolve mesmo com análise nova", async () => {
    const anchor = resolveScenarioBaselineFromHistory(companyA, await historyOf(ownerA, companyA));
    assert.equal(anchor.outcome, "ready");
    if (anchor.outcome !== "ready") return;
    const request: ScenarioDecisionRequest = {
      companyId: companyA,
      evaluatedBaselineIdentity: anchor.identity,
      request: { kind: "operating_cost_change", operatingExpensesDeltaAmount: -10000, operatingExpensesDeltaCurrency: "BRL" },
      proposedBy: "executive-chat",
      type: "prioritize_sequence",
      priority: "high",
      confidence: "medium",
      title: "Reduzir despesas operacionais",
      description: "Cortar despesas administrativas.",
      rationale: "Recompor a margem de agosto.",
    };
    const key = randomUUID();
    const validations = { count: 0 };
    const first = await submitScenario(ownerA, request, key, validations);
    assert.equal(first.outcome, "CREATED");
    assert.equal(first.outcome === "CREATED" ? readScenarioDecisionContext(first.decision.decision.supportingData)?.proposedBy : undefined, "executive-chat");

    // uma análise nova (setembro) chega depois da gravação
    const september = await monthly(companyA, "09", 0.58, "v1", randomUUID());
    await new SupabaseExecutionRepository(new SupabasePersistenceClient(ownerA.client)).save(september.snapshot);

    const replay = await submitScenario(ownerA, request, key, validations);
    assert.equal(replay.outcome, "REPLAYED");
    assert.equal(idOf(replay), idOf(first));
    assert.equal(validations.count, 1, "o reenvio não revalida o contexto nem recomputa");

    // intenção NOVA com a âncora de agosto: recusada antes de gravar
    const staleKey = randomUUID();
    const stale = await submitScenario(ownerA, request, staleKey, validations);
    assert.equal(stale.outcome, "REJECTED");
    assert.equal(stale.outcome === "REJECTED" ? stale.failure.stage : "", "stale-baseline");
    assert.equal(await rowsWithKey(ownerA, companyA, staleKey), 0);
  });

  test("tenants: a mesma chave em A e B não cruza; A não enxerga a de B; escrita de A em B é RLS (42501), nunca 23505", async () => {
    const key = randomUUID();
    const a = await submitHuman(ownerA, companyA, MANUAL, key);
    const b = await submitHuman(ownerB, companyB, MANUAL, key);
    assert.equal(a.outcome, "CREATED");
    assert.equal(b.outcome, "CREATED", "a mesma chave em outra empresa é outra intenção");
    assert.notEqual(idOf(a), idOf(b));

    assert.equal(await findDecisionBySubmission(companyB, ownerB.id, key, ownerA.client), undefined, "A não descobre a Decision de B");
    assert.equal(await findDecisionBySubmission(companyB, ownerA.id, key, ownerB.client), undefined, "a busca é presa ao ator: B não acha a chave sob outro ator");

    // escrita de A que colidiria EXATAMENTE com a linha de B
    const forged = createHumanDecision({ humanActorId: ownerB.id, companyId: companyB, ...MANUAL }, randomUUID(), new Date().toISOString());
    assert.ok(forged.success);
    if (!forged.success) return;
    const fingerprint = deriveDecisionRequestFingerprint({ entrypoint: "human-decision", companyId: companyB, humanActorId: ownerB.id }, humanDecisionRequestPayload(MANUAL));
    assert.ok(fingerprint);
    await assert.rejects(saveHumanDecision(forged.value, { idempotencyKey: key, requestFingerprint: fingerprint }, ownerA.client), (error: { code?: string }) => {
      assert.equal(error.code, "42501");
      return true;
    });
    assert.equal(await rowsWithKey(ownerB, companyB, key), 1);
  });

  test("empresa encerrada: nenhuma Decision nova; a gravada antes continua só no banco, e a empresa sai da leitura do app (D-130)", async () => {
    const key = randomUUID();
    const before = await submitHuman(ownerA, companyAClosed, MANUAL, key);
    assert.equal(before.outcome, "CREATED");
    const { error: closeError } = await ownerA.client.from("companies").update({ deleted_at: new Date().toISOString() }).eq("id", companyAClosed);
    if (closeError) throw closeError;

    await assert.rejects(submitHuman(ownerA, companyAClosed, MANUAL, randomUUID()), (error: { code?: string }) => {
      assert.equal(error.code, "42501");
      return true;
    });
    // mesmo filtro de `getCompanyById()`: as ações respondem "Empresa não encontrada ou sem acesso." antes da busca pela chave
    const { data: visible } = await ownerA.client.from("companies").select("id").eq("id", companyAClosed).is("deleted_at", null).maybeSingle();
    assert.equal(visible, null);
    assert.equal(await rowsWithKey(ownerA, companyAClosed, key), 1);
  });

  test("o reenvio nunca grava nada: nenhuma Decision, resultado ou aprendizado a mais", async () => {
    const key = randomUUID();
    const first = await submitHuman(ownerA, companyA, MANUAL, key);
    const decisionId = idOf(first);
    assert.ok(decisionId);
    const { error } = await ownerA.client
      .from("decision_outcomes")
      .insert({ decision_id: decisionId, company_id: companyA, recorded_by: ownerA.id, status: "positive", observed_at: new Date().toISOString(), description: "sintético" });
    if (error) throw error;

    const count = async (table: "decisions" | "decision_outcomes" | "learning_records") =>
      (await ownerA.client.from(table).select("*", { count: "exact", head: true }).eq("company_id", companyA)).count;
    const snapshot = async () => [await count("decisions"), await count("decision_outcomes"), await count("learning_records")];
    const beforeReplay = await snapshot();
    const replays = await Promise.all(Array.from({ length: 5 }, () => submitHuman(ownerA, companyA, MANUAL, key)));
    assert.ok(replays.every((r) => r.outcome === "REPLAYED" && r.decision.id === decisionId));
    assert.deepEqual(await snapshot(), beforeReplay);
  });
});
