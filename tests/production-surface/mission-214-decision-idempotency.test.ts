import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { createHumanDecision } from "@/efos/application/decision-lifecycle";
import type { Decision } from "@/efos/domain";
import {
  DECISION_IDEMPOTENCY_INDEX,
  isDecisionIdempotencyViolation,
  isIdempotencyKey,
  matchDecisionSubmission,
  submitDecisionOnce,
  type ExistingDecisionSubmission,
  type SaveHumanDecisionResult,
} from "@/modules/decisions/lib/decisionIdempotency";
import {
  canonicalJson,
  decisionIntentSignature,
  humanDecisionRequestPayload,
  NonCanonicalValueError,
  scenarioDecisionRequestPayload,
  type HumanDecisionRequestFields,
} from "@/modules/decisions/lib/decisionRequest";
import {
  DECISION_REQUEST_FINGERPRINT_FORMAT,
  deriveDecisionRequestFingerprint,
  isDecisionRequestFingerprint,
  type DecisionRequestScope,
} from "@/modules/decisions/lib/decisionRequestFingerprint";
import { newIdempotencyKey, useDecisionIdempotencyKey } from "@/modules/decisions/lib/useDecisionIdempotencyKey";
import type { PersistedDecision } from "@/modules/decisions/services/decision-persistence.service";
import type { ScenarioDecisionRequest } from "@/modules/scenarios/lib/composeScenarioDecision";

/**
 * Mission 214 — Governed Decision Idempotency (D-137). Prova no CI (sem
 * banco): pedido canônico, impressão versionada, fluxo único de submissão,
 * classificação do 23505, ciclo de vida da chave no formulário e a forma
 * das duas ações, da gravação única e da Migration 019. A prova com banco
 * real está em `supabase/tests/database/decision_idempotency.test.sql`
 * (pgTAP) e `tests/decisions-local/` (concorrência, Supabase local).
 */

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const sqlWithoutComments = (source: string) => source.replace(/--.*$/gm, "");
const files = (dir: string): string[] =>
  readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(join(ROOT, path)).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });

const COMPANY = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const KEY = "33333333-3333-4333-8333-333333333333";
const MIGRATION = "supabase/migrations/20261008120000_decision_idempotency.sql";

const MANUAL: HumanDecisionRequestFields = {
  type: "prioritize_sequence",
  priority: "high",
  confidence: "medium",
  title: "Renegociar contratos",
  description: "Renegociar os três maiores contratos.",
  rationale: "Proteger a margem.",
};

const SCENARIO: Omit<ScenarioDecisionRequest, "companyId"> = {
  evaluatedBaselineIdentity: {
    period: { startDate: "2026-08-01T00:00:00.000Z", endDate: "2026-08-31T23:59:59.000Z" },
    financialModelFingerprint: "fm-agosto",
  } as unknown as ScenarioDecisionRequest["evaluatedBaselineIdentity"],
  request: { kind: "operating_cost_change", operatingExpensesDeltaAmount: -10000, operatingExpensesDeltaCurrency: "BRL" },
  proposedBy: "executive-chat",
  type: "prioritize_sequence",
  priority: "high",
  confidence: "medium",
  title: "Reduzir despesas operacionais",
  description: "Cortar despesas administrativas.",
  rationale: "Recompor a margem.",
};

const humanScope: DecisionRequestScope = { entrypoint: "human-decision", companyId: COMPANY, humanActorId: ACTOR };
const fingerprintOf = (fields: HumanDecisionRequestFields, scope = humanScope) => deriveDecisionRequestFingerprint(scope, humanDecisionRequestPayload(fields));

describe("Mission 214 — pedido canônico", () => {
  test("JSON determinístico: a ordem das chaves não importa; a ordem dos arrays importa; undefined é omitido", () => {
    assert.equal(canonicalJson({ b: 1, a: { d: [2, 1], c: "x" } }), canonicalJson({ a: { c: "x", d: [2, 1] }, b: 1 }));
    assert.notEqual(canonicalJson({ list: [1, 2] }), canonicalJson({ list: [2, 1] }));
    assert.equal(canonicalJson({ a: 1, b: undefined }), canonicalJson({ a: 1 }));
    assert.equal(canonicalJson({ a: 1, b: null }), '{"a":1,"b":null}');
  });

  test("só JSON simples: Date, Map, função, não finito, bigint, array com buraco ou undefined são recusados", () => {
    const sparse: unknown[] = [];
    sparse[1] = 1;
    for (const value of [new Date(0), new Map(), () => 1, Number.NaN, Number.POSITIVE_INFINITY, BigInt(1), sparse, [undefined], Symbol("x")]) {
      assert.throws(() => canonicalJson({ value }), NonCanonicalValueError);
    }
  });

  test("decisão humana: exatamente os campos usados pelo servidor, com os padrões de createHumanDecision()", () => {
    const payload = humanDecisionRequestPayload(MANUAL);
    assert.deepEqual(Object.keys(payload).sort(), [
      "confidence", "contexts", "description", "diagnosisId", "evidences", "priority",
      "rationale", "reasonings", "recommendationId", "recommendations", "reviewId", "title", "type",
    ]);
    assert.equal(payload.diagnosisId, null);
    assert.deepEqual(payload.recommendations, []);
    const built = createHumanDecision({ humanActorId: ACTOR, companyId: COMPANY, ...MANUAL }, "id", "2026-10-08T00:00:00.000Z");
    assert.ok(built.success);
    if (built.success) assert.deepEqual(built.value.recommendations, payload.recommendations);
  });

  test("a chave, o id e instantes nunca entram no pedido", () => {
    const withExtras = { ...MANUAL, idempotencyKey: KEY, id: "x", createdAt: "2026-10-08", companyId: COMPANY } as HumanDecisionRequestFields;
    assert.equal(canonicalJson(humanDecisionRequestPayload(withExtras)), canonicalJson(humanDecisionRequestPayload(MANUAL)));
    const scenarioWithKey = { ...SCENARIO, idempotencyKey: KEY } as typeof SCENARIO;
    assert.equal(canonicalJson(scenarioDecisionRequestPayload(scenarioWithKey)), canonicalJson(scenarioDecisionRequestPayload(SCENARIO)));
  });

  test("cenário/Chat: âncora reivindicada, hipótese, alternativa e origem fazem parte do pedido", () => {
    const base = canonicalJson(scenarioDecisionRequestPayload(SCENARIO));
    assert.notEqual(canonicalJson(scenarioDecisionRequestPayload({ ...SCENARIO, proposedBy: undefined })), base, "Chat ≠ Scenario Lab");
    assert.notEqual(canonicalJson(scenarioDecisionRequestPayload({ ...SCENARIO, request: { ...SCENARIO.request, operatingExpensesDeltaAmount: -9000 } as typeof SCENARIO.request })), base);
    assert.notEqual(canonicalJson(scenarioDecisionRequestPayload({ ...SCENARIO, alternative: SCENARIO.request })), base);
    assert.notEqual(
      canonicalJson(scenarioDecisionRequestPayload({ ...SCENARIO, evaluatedBaselineIdentity: { ...SCENARIO.evaluatedBaselineIdentity, financialModelFingerprint: "fm-v2" } })),
      base
    );
  });
});

describe("Mission 214 — impressão versionada", () => {
  test("formato `decision-request:v1:<64 hex>`, o mesmo do check da Migration 019", () => {
    const fingerprint = fingerprintOf(MANUAL);
    assert.ok(fingerprint);
    assert.equal(DECISION_REQUEST_FINGERPRINT_FORMAT, "decision-request:v1");
    assert.match(fingerprint!, /^decision-request:v1:[0-9a-f]{64}$/);
    assert.ok(isDecisionRequestFingerprint(fingerprint));
    assert.ok(!isDecisionRequestFingerprint("a".repeat(64)), "sem versão: recusado");
    const migration = read(MIGRATION);
    assert.match(migration, /request_fingerprint ~ '\^decision-request:v\[1-9\]\[0-9\]\*:\[0-9a-f\]\{64\}\$'/);
  });

  test("determinística e sensível a cada campo do pedido — sem hipernormalização do texto humano", () => {
    assert.equal(fingerprintOf(MANUAL), fingerprintOf({ ...MANUAL }));
    const variants: HumanDecisionRequestFields[] = [
      { ...MANUAL, type: "execute_immediately" },
      { ...MANUAL, priority: "low" },
      { ...MANUAL, confidence: "high" },
      { ...MANUAL, title: `${MANUAL.title}.` },
      { ...MANUAL, description: `${MANUAL.description} ` },
      { ...MANUAL, rationale: MANUAL.rationale.toLowerCase() },
      { ...MANUAL, diagnosisId: "d" },
      { ...MANUAL, reviewId: "r" },
      { ...MANUAL, recommendationId: "action-1" },
      { ...MANUAL, recommendations: ["x"] },
      { ...MANUAL, reasonings: ["x"] },
      { ...MANUAL, contexts: ["x"] },
      { ...MANUAL, evidences: ["x"] },
    ];
    const prints = new Set([fingerprintOf(MANUAL), ...variants.map((variant) => fingerprintOf(variant))]);
    assert.equal(prints.size, variants.length + 1);
  });

  test("presa ao entrypoint, à empresa e ao ator", () => {
    const base = fingerprintOf(MANUAL);
    assert.notEqual(fingerprintOf(MANUAL, { ...humanScope, entrypoint: "scenario-decision" }), base);
    assert.notEqual(fingerprintOf(MANUAL, { ...humanScope, companyId: "44444444-4444-4444-8444-444444444444" }), base);
    assert.notEqual(fingerprintOf(MANUAL, { ...humanScope, humanActorId: "55555555-5555-4555-8555-555555555555" }), base);
  });

  test("pedido fora do JSON canônico: nenhuma impressão (a ação recusa), nunca exceção", () => {
    assert.equal(deriveDecisionRequestFingerprint(humanScope, { when: new Date(0) }), undefined);
    assert.equal(deriveDecisionRequestFingerprint(humanScope, humanDecisionRequestPayload({ ...MANUAL, title: Number.NaN as unknown as string })), undefined);
  });
});

describe("Mission 214 — fluxo único de submissão (submitDecisionOnce)", () => {
  const persisted = (id: string): PersistedDecision => ({
    id,
    companyId: COMPANY,
    diagnosisId: null,
    reviewId: null,
    humanActorId: ACTOR,
    decision: { id } as unknown as Decision,
    createdAt: "2026-10-08T00:00:00.000Z",
  });
  const FP = "decision-request:v1:" + "a".repeat(64);
  const decision = { id: "novo" } as unknown as Decision;

  function steps(options: {
    existing?: (ExistingDecisionSubmission | undefined)[];
    valid?: boolean;
    failure?: { stage: string };
    recheck?: boolean;
    saveResult?: SaveHumanDecisionResult;
  }) {
    const calls = { find: 0, validate: 0, save: 0 };
    const queue = [...(options.existing ?? [])];
    return {
      calls,
      run: () =>
        submitDecisionOnce<{ stage: string }>({
          requestFingerprint: FP,
          findExisting: async () => {
            calls.find += 1;
            return queue.shift();
          },
          validateAndCompose: async () => {
            calls.validate += 1;
            return options.valid === false ? { ok: false, failure: options.failure ?? { stage: "stale-baseline" } } : { ok: true, decision };
          },
          save: async () => {
            calls.save += 1;
            return options.saveResult ?? { outcome: "CREATED", decision: persisted("novo") };
          },
          recheckAfter: options.recheck === undefined ? undefined : () => options.recheck!,
        }),
    };
  }

  test("já gravada com a mesma impressão: devolve (REPLAYED) sem revalidar nem gravar", async () => {
    const flow = steps({ existing: [{ decision: persisted("gravada"), requestFingerprint: FP }] });
    const result = await flow.run();
    assert.equal(result.outcome, "REPLAYED");
    assert.equal(result.outcome === "REPLAYED" ? result.decision.id : "", "gravada");
    assert.deepEqual(flow.calls, { find: 1, validate: 0, save: 0 });
  });

  test("já gravada com outra impressão: recusa, sem revalidar nem gravar", async () => {
    const flow = steps({ existing: [{ decision: persisted("gravada"), requestFingerprint: "decision-request:v1:" + "b".repeat(64) }] });
    assert.equal((await flow.run()).outcome, "KEY_REUSED_WITH_DIFFERENT_PAYLOAD");
    assert.deepEqual(flow.calls, { find: 1, validate: 0, save: 0 });
  });

  test("intenção nova: TODAS as validações antes da gravação única", async () => {
    const flow = steps({});
    assert.equal((await flow.run()).outcome, "CREATED");
    assert.deepEqual(flow.calls, { find: 1, validate: 1, save: 1 });
  });

  test("intenção nova inválida: recusa, nada gravado — a idempotência nunca legitima um pedido inválido", async () => {
    const flow = steps({ valid: false });
    const result = await flow.run();
    assert.equal(result.outcome, "REJECTED");
    assert.deepEqual(flow.calls, { find: 1, validate: 1, save: 0 });
  });

  test("recusa dependente do momento: a chave é procurada mais uma vez (só leitura)", async () => {
    const won = steps({ valid: false, recheck: true, existing: [undefined, { decision: persisted("vencedora"), requestFingerprint: FP }] });
    const result = await won.run();
    assert.equal(result.outcome, "REPLAYED");
    assert.deepEqual(won.calls, { find: 2, validate: 1, save: 0 });

    const nothing = steps({ valid: false, recheck: true, existing: [undefined, undefined] });
    assert.equal((await nothing.run()).outcome, "REJECTED");
    assert.deepEqual(nothing.calls, { find: 2, validate: 1, save: 0 });

    const other = steps({ valid: false, recheck: false });
    assert.equal((await other.run()).outcome, "REJECTED");
    assert.deepEqual(other.calls, { find: 1, validate: 1, save: 0 });
  });

  test("o resultado da gravação (corrida decidida pelo índice) passa adiante sem reinterpretação", async () => {
    for (const saveResult of [
      { outcome: "REPLAYED", decision: persisted("vencedora") },
      { outcome: "KEY_REUSED_WITH_DIFFERENT_PAYLOAD" },
    ] as const) {
      assert.deepEqual(await steps({ saveResult }).run(), saveResult);
    }
  });

  test("matchDecisionSubmission compara a impressão gravada; histórico sem impressão nunca é reenvio", () => {
    assert.equal(matchDecisionSubmission({ decision: persisted("x"), requestFingerprint: FP }, FP).outcome, "REPLAYED");
    assert.equal(matchDecisionSubmission({ decision: persisted("x"), requestFingerprint: null }, FP).outcome, "KEY_REUSED_WITH_DIFFERENT_PAYLOAD");
  });
});

describe("Mission 214 — classificação do 23505 e da chave", () => {
  test("só o 23505 do índice nomeado é reenvio; a chave primária e outros erros não", () => {
    assert.equal(DECISION_IDEMPOTENCY_INDEX, "decisions_idempotency_key_unique");
    assert.ok(isDecisionIdempotencyViolation({ code: "23505", message: 'duplicate key value violates unique constraint "decisions_idempotency_key_unique"' }));
    assert.ok(!isDecisionIdempotencyViolation({ code: "23505", message: 'duplicate key value violates unique constraint "decisions_pkey"' }));
    assert.ok(!isDecisionIdempotencyViolation({ code: "42501", message: '"decisions_idempotency_key_unique"' }));
    assert.ok(!isDecisionIdempotencyViolation({ code: "23505" }));
    assert.ok(!isDecisionIdempotencyViolation("23505"));
    assert.ok(!isDecisionIdempotencyViolation(null));
  });

  test("a chave é um UUID textual; qualquer outra coisa é recusada antes do banco", () => {
    assert.ok(isIdempotencyKey(KEY));
    for (const value of [undefined, null, "", "abc", 1, `${KEY} `, { key: KEY }]) assert.ok(!isIdempotencyKey(value));
  });
});

describe("Mission 214 — ciclo de vida da chave no formulário", () => {
  test("mesma assinatura → mesma chave; pedido mudou → chave nova; depois do sucesso → chave nova", () => {
    const seen: Record<string, string> = {};
    function Probe() {
      const submission = useDecisionIdempotencyKey();
      seen.first = submission.keyFor("pedido-a");
      seen.retry = submission.keyFor("pedido-a");
      seen.changed = submission.keyFor("pedido-b");
      submission.settle();
      seen.afterSuccess = submission.keyFor("pedido-b");
      return null;
    }
    renderToStaticMarkup(createElement(Probe));
    assert.ok(isIdempotencyKey(seen.first));
    assert.equal(seen.retry, seen.first, "reenvio do mesmo pedido mantém a chave");
    assert.notEqual(seen.changed, seen.first, "pedido mudou: chave nova");
    assert.notEqual(seen.afterSuccess, seen.changed, "depois do sucesso: chave nova");
  });

  test("a assinatura da intenção muda exatamente quando o pedido canônico (ou a empresa) muda", () => {
    const signature = (fields: HumanDecisionRequestFields, company = COMPANY) => decisionIntentSignature(company, humanDecisionRequestPayload(fields));
    assert.equal(signature(MANUAL), signature({ ...MANUAL }));
    assert.notEqual(signature(MANUAL), signature({ ...MANUAL, rationale: "Outra." }));
    assert.notEqual(signature(MANUAL), signature(MANUAL, "44444444-4444-4444-8444-444444444444"));
  });

  test("chaves são UUID v4", () => {
    for (let i = 0; i < 20; i += 1) assert.match(newIdempotencyKey(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test("os dois formulários: chave por intenção, nunca gerada na renderização nem exibida; duplo clique continua bloqueado", () => {
    for (const path of ["modules/decisions/components/HumanDecisionSection.tsx", "modules/scenarios/components/ScenarioDecisionForm.tsx"]) {
      const source = withoutComments(read(path));
      assert.match(source, /const submission = useDecisionIdempotencyKey\(\);/, path);
      assert.match(source, /if \(!canSubmit \|\| submittingRef\.current\) return;/, path);
      const handler = source.slice(source.indexOf("async function handleSubmit"), source.indexOf("return (", source.indexOf("async function handleSubmit")));
      assert.match(handler, /const idempotencyKey = submission\.keyFor\(decisionIntentSignature\(companyId, \w+DecisionRequestPayload\(\w+\)\)\);/, path);
      assert.match(handler, /\{ \.\.\.\w+, idempotencyKey \}/, path);
      // sucesso (criada ou devolvida) e chave reaproveitada encerram a intenção; erro de rede não
      assert.equal((handler.match(/submission\.settle\(\);/g) ?? []).length, 2, path);
      assert.match(handler, /result\.stage === "idempotency"[\s\S]*?submission\.settle\(\);[\s\S]*?router\.refresh\(\);/, path);
      const catchBlock = handler.slice(handler.indexOf("} catch {"), handler.indexOf("} finally {"));
      assert.doesNotMatch(catchBlock, /settle/, `${path}: resposta perdida mantém a chave`);
      assert.match(catchBlock, /DECISION_SUBMISSION_RETRY_MESSAGE/, path);
      assert.doesNotMatch(source, /randomUUID|newIdempotencyKey/, `${path}: nenhuma chave gerada fora do hook`);
      const markup = source.slice(source.indexOf("return (", source.indexOf("async function handleSubmit")));
      assert.doesNotMatch(markup, /idempotencyKey/, `${path}: a chave nunca aparece na tela`);
    }
  });
});

describe("Mission 214 — as duas ações e a gravação única", () => {
  const actions = [
    { path: "modules/decisions/actions/human-review.actions.ts", name: "createHumanDecisionAction", entrypoint: "human-decision", payload: "humanDecisionRequestPayload" },
    { path: "modules/scenarios/actions/scenario-decision.actions.ts", name: "createScenarioDecisionAction", entrypoint: "scenario-decision", payload: "scenarioDecisionRequestPayload" },
  ];

  test("ordem: sessão → formato da chave → empresa (RLS, aberta) → impressão → fluxo único", () => {
    for (const action of actions) {
      const body = withoutComments(read(action.path));
      const start = body.indexOf(`export async function ${action.name}`);
      const fn = body.slice(start);
      const order = [
        "getCurrentUser()",
        "isIdempotencyKey(input.idempotencyKey)",
        "getCompanyById(input.companyId)",
        `entrypoint: "${action.entrypoint}", companyId: input.companyId, humanActorId: user.id`,
        `${action.payload}(input)`,
        "submitDecisionOnce<",
      ];
      const positions = order.map((needle) => fn.indexOf(needle));
      assert.ok(positions.every((position) => position > 0), `${action.name}: faltando ${order.filter((_, i) => positions[i] < 0).join(", ")}`);
      assert.deepEqual([...positions].sort((a, b) => a - b), positions, `${action.name}: a ordem mudou`);
      assert.match(fn, /findExisting: \(\) => findDecisionBySubmission\(input\.companyId, user\.id, input\.idempotencyKey\)/, action.name);
      assert.match(fn, /save: \(decision\) => saveHumanDecision\(decision, \{ idempotencyKey: input\.idempotencyKey, requestFingerprint \}\)/, action.name);
      assert.match(fn, /replayed: outcome\.outcome === "REPLAYED"/, action.name);
      assert.match(fn, /stage: "idempotency", error: IDEMPOTENCY_KEY_REUSED_MESSAGE/, action.name);
    }
  });

  test("cenário/Chat: baseline, âncora (stale) e recomputação ficam DENTRO da validação de intenção nova; a releitura tardia só nas recusas dependentes do momento", () => {
    const source = withoutComments(read("modules/scenarios/actions/scenario-decision.actions.ts"));
    const validation = source.slice(source.indexOf("validateAndCompose:"), source.indexOf("save: (decision)"));
    assert.match(validation, /resolveScenarioBaseline\(input\.companyId\)/);
    assert.match(validation, /composeScenarioDecision\(input, user\.id, baseline,/);
    assert.match(source, /new Set\(\["financial-truth", "stale-baseline"\]\)/);
    assert.match(source, /recheckAfter: \(failure\) => TIME_DEPENDENT_STAGES\.has\(failure\.stage\)/);
  });

  test("uma única gravação de Decision: só `saveHumanDecision()` faz INSERT em decisions, sempre com chave e impressão", () => {
    const writers = [...files("modules"), ...files("app"), ...files("efos"), ...files("lib")].filter((path) => {
      const source = withoutComments(read(path));
      return /from\("decisions"\)\s*\.insert\(/.test(source);
    });
    assert.deepEqual(writers, ["modules/decisions/services/decision-persistence.service.ts"]);
    const service = withoutComments(read("modules/decisions/services/decision-persistence.service.ts"));
    const save = service.slice(service.indexOf("export async function saveHumanDecision("), service.indexOf("export async function findDecisionBySubmission("));
    assert.match(save, /submission: DecisionSubmission,/);
    assert.match(save, /idempotency_key: submission\.idempotencyKey,\s*request_fingerprint: submission\.requestFingerprint,/);
    assert.match(save, /if \(isDecisionIdempotencyViolation\(error\)\) \{[\s\S]*findDecisionBySubmission\([\s\S]*matchDecisionSubmission\(existing, submission\.requestFingerprint\)/);
    assert.match(save, /if \(!existing\) throw error;/, "conflito sem linha visível: falha fechada");
    const find = service.slice(service.indexOf("export async function findDecisionBySubmission("));
    assert.match(find, /\.eq\("company_id", companyId\)\s*\.eq\("human_actor_id", humanActorId\)\s*\.eq\("idempotency_key", idempotencyKey\)/);
  });

  test("nada novo no Chat, na IA, no relatório nem a jusante: sem deduplicação no renderer", () => {
    for (const path of ["modules/decisions/lib/decisionIdempotency.ts", "modules/decisions/lib/decisionRequest.ts", "modules/decisions/lib/decisionRequestFingerprint.ts", "modules/decisions/lib/useDecisionIdempotencyKey.ts"]) {
      assert.doesNotMatch(read(path), /anthropic|@\/lib\/ai|executeExecutive/i, path);
    }
    for (const path of [...files("modules/reports"), ...files("modules/executive-chat")]) {
      assert.doesNotMatch(read(path), /idempotenc|request_fingerprint|idempotency_key/i, path);
    }
    for (const path of ["modules/decisions/actions/decision-execution.actions.ts", "modules/decisions/actions/learning-derivation.actions.ts", "modules/decisions/actions/financial-observation.actions.ts"]) {
      assert.doesNotMatch(read(path), /idempotenc/i, `${path}: contratos a jusante inalterados`);
    }
  });
});

describe("Mission 214 — Migration 019", () => {
  const migration = read(MIGRATION);
  const sql = sqlWithoutComments(migration);

  test("colunas nullable, três checks nomeados e índice único parcial com o nome do contrato", () => {
    assert.match(sql, /add column idempotency_key uuid,\s*add column request_fingerprint text;/);
    for (const name of ["decisions_idempotency_pair_check", "decisions_idempotency_human_actor_check", "decisions_request_fingerprint_format_check"]) {
      assert.match(sql, new RegExp(`add constraint ${name}`));
    }
    assert.match(sql, /check \(\(idempotency_key is null\) = \(request_fingerprint is null\)\)/);
    assert.match(sql, /check \(idempotency_key is null or human_actor_id is not null\)/);
    assert.match(
      sql,
      new RegExp(`create unique index ${DECISION_IDEMPOTENCY_INDEX}\\s+on public\\.decisions \\(company_id, human_actor_id, idempotency_key\\)\\s+where idempotency_key is not null;`)
    );
  });

  test("sem backfill, sem default, sem RLS/grant/função nova, sem SECURITY DEFINER", () => {
    assert.doesNotMatch(sql, /update public\.decisions|default /i);
    assert.doesNotMatch(sql, /create policy|alter policy|drop policy|grant |revoke |create (or replace )?function|security definer/i);
  });

  test("é a 19ª da cadeia e os tipos refletem as duas colunas", () => {
    const chain = readdirSync(join(ROOT, "supabase", "migrations")).filter((name) => name.endsWith(".sql")).sort();
    assert.equal(chain.length, 19);
    assert.equal(chain.at(-1), "20261008120000_decision_idempotency.sql");
    const types = read("types/database.ts");
    const decisions = types.slice(types.indexOf("      decisions: {"), types.indexOf("      decision_execution_events: {"));
    assert.equal((decisions.match(/idempotency_key\??: string \| null;/g) ?? []).length, 3);
    assert.equal((decisions.match(/request_fingerprint\??: string \| null;/g) ?? []).length, 3);
  });

  test("o teste pgTAP oficial existe e fixa o índice e os checks", () => {
    const pgtap = read("supabase/tests/database/decision_idempotency.test.sql");
    assert.match(pgtap, /select plan\(\d+\);/);
    assert.match(pgtap, /decisions_idempotency_key_unique/);
    assert.match(pgtap, /a_collide_into_b/);
    assert.match(pgtap, /rollback;\s*$/);
  });
});
