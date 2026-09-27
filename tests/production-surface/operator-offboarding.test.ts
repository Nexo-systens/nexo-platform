import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  COMPANY_PURGE_FAILURE_MESSAGES,
  COMPANY_PURGE_RESOURCES,
  parseCompanyPurgePreview,
  parsePurgeDatabaseResult,
  runCompanyPurge,
  type CompanyOffboardingPorts,
  type CompanyPurgePreview,
} from "@/modules/companies/lib/company-offboarding";
import {
  OFFBOARDING_REGISTRATION_MESSAGES,
  isOffboardingReference,
  parseOffboardingRegistrationResult,
  parseOperatorPurgePreview,
  registerOffboardingRequest,
  type OffboardingRegistrationPort,
} from "@/modules/companies/lib/operator-offboarding";

/**
 * Mission 202B — Governed Operator Offboarding Authority (D-131).
 *
 * A autoridade do operador reutiliza a orquestração ÚNICA da purga
 * (`runCompanyPurge`); estes testes provam, com portas simuladas, que
 * uma empresa sem solicitação registrada nunca chega ao Storage nem ao
 * banco, e que a entrada do registro é validada antes do banco (D-128).
 * A prova com Postgres/Storage reais está em
 * `supabase/tests/database/offboarding_operator_authority.test.sql` e
 * `tests/offboarding-local/`.
 */

const COMPANY = "a1a1a1a1-0000-4000-8000-000000000001";
const CONFIRMATION = "EXCLUIR-A1A1A1A1";
const CLOSURE = "ENCERRAR-A1A1A1A1";
const ZERO_COUNTS = Object.fromEntries(COMPANY_PURGE_RESOURCES.map((r) => [r, 0])) as Record<(typeof COMPANY_PURGE_RESOURCES)[number], number>;

function operatorPorts(preview: CompanyPurgePreview) {
  const calls: string[] = [];
  let objects = [`company/${COMPANY}/doc/dre.csv`];
  let previews = 0;
  const ports: CompanyOffboardingPorts = {
    async preview() {
      calls.push("preview");
      previews += 1;
      return previews > 1 ? { found: false } : preview;
    },
    async listStorageObjects() {
      calls.push("list");
      return objects;
    },
    async removeStorageObjects(paths) {
      calls.push(`remove:${paths.length}`);
      objects = objects.filter((o) => !paths.includes(o));
    },
    async purgeDatabase() {
      calls.push("purge");
      return { ok: true, deleted: { companies: 1 } };
    },
  };
  return { ports, calls };
}

describe("Mission 202B — mesma orquestração para o operador", () => {
  test("empresa encerrada SEM solicitação registrada: nada é tocado (not_registered)", async () => {
    const { ports, calls } = operatorPorts({ found: true, closed: true, registered: false, confirmation: CONFIRMATION, counts: ZERO_COUNTS });
    assert.deepEqual(await runCompanyPurge(ports, { companyId: COMPANY, confirmation: CONFIRMATION }), { ok: false, reason: "not_registered" });
    assert.deepEqual(calls, ["preview"]);
  });

  test("empresa ATIVA continua recusada antes de qualquer outra coisa (not_closed)", async () => {
    const { ports, calls } = operatorPorts({ found: true, closed: false, registered: true, confirmation: CONFIRMATION, counts: ZERO_COUNTS });
    assert.deepEqual(await runCompanyPurge(ports, { companyId: COMPANY, confirmation: CONFIRMATION }), { ok: false, reason: "not_closed" });
    assert.deepEqual(calls, ["preview"]);
  });

  test("encerrada e registrada: Storage primeiro, depois o banco, depois a verificação", async () => {
    const { ports, calls } = operatorPorts({ found: true, closed: true, registered: true, confirmation: CONFIRMATION, counts: ZERO_COUNTS });
    const outcome = await runCompanyPurge(ports, { companyId: COMPANY, confirmation: CONFIRMATION });
    assert.deepEqual(outcome, { ok: true, storageObjectsRemoved: 1, deleted: { companies: 1 } });
    assert.deepEqual(calls, ["preview", "list", "remove:1", "list", "purge", "preview"]);
  });

  test("a prévia do dono (sem `registered`) segue exatamente como antes", async () => {
    const parsed = parseCompanyPurgePreview({ found: true, closed: true, confirmation: CONFIRMATION, counts: {} });
    assert.equal("registered" in parsed, false);
    const { ports } = operatorPorts({ found: true, closed: true, confirmation: CONFIRMATION, counts: ZERO_COUNTS });
    assert.equal((await runCompanyPurge(ports, { companyId: COMPANY, confirmation: CONFIRMATION })).ok, true);
  });

  test("o banco pode recusar com not_registered, com mensagem genérica", () => {
    assert.deepEqual(parsePurgeDatabaseResult({ ok: false, reason: "not_registered" }), { ok: false, reason: "not_registered" });
    assert.ok(COMPANY_PURGE_FAILURE_MESSAGES.not_registered.length > 0);
    assert.doesNotMatch(COMPANY_PURGE_FAILURE_MESSAGES.not_registered, /select|policy|operator|sql/i);
  });
});

describe("Mission 202B — prévia do operador", () => {
  test("só estado, registro, frases e contagens; forma incompleta vira não encontrada", () => {
    const raw = {
      found: true,
      closed: true,
      registered: true,
      confirmation: CONFIRMATION,
      closure_confirmation: CLOSURE,
      counts: { documents: 2, storage_objects: 1 },
    };
    const parsed = parseOperatorPurgePreview(raw);
    assert.equal(parsed.found, true);
    if (parsed.found) {
      assert.equal(parsed.closureConfirmation, CLOSURE);
      assert.equal(parsed.registered, true);
      assert.equal(parsed.counts.documents, 2);
      assert.deepEqual(Object.keys(parsed).sort(), ["closed", "closureConfirmation", "confirmation", "counts", "found", "registered"]);
    }
    assert.deepEqual(parseOperatorPurgePreview({ ...raw, registered: undefined }), { found: false });
    assert.deepEqual(parseOperatorPurgePreview({ ...raw, closure_confirmation: 1 }), { found: false });
    assert.deepEqual(parseOperatorPurgePreview({ found: false }), { found: false });
    assert.deepEqual(parseOperatorPurgePreview(null), { found: false });
  });
});

describe("Mission 202B — registro da solicitação", () => {
  function registrationPort() {
    const calls: string[] = [];
    const port: OffboardingRegistrationPort = {
      async register(companyId, reference, confirmation) {
        calls.push(`${companyId}|${reference}|${confirmation}`);
        return { ok: true, closedNow: true, alreadyRegistered: false };
      },
    };
    return { port, calls };
  }

  test("identificador malformado nunca chega ao banco (D-128)", async () => {
    const { port, calls } = registrationPort();
    for (const companyId of ["not-a-uuid", "", null, 42, `${COMPANY} `]) {
      assert.deepEqual(await registerOffboardingRequest(port, { companyId, reference: "REG-1", confirmation: CLOSURE }), { ok: false, reason: "not_found" });
    }
    assert.deepEqual(calls, []);
  });

  test("referência: só o código do registro privado — nunca e-mail, espaço ou texto livre", async () => {
    for (const valid of ["REG-2026-001", "reg.2026/10:01", "A", "a".repeat(64)]) assert.equal(isOffboardingReference(valid), true, valid);
    for (const invalid of ["", "contato@empresa.com", "pedido da empresa", ".REG", "-REG", "a".repeat(65), "REG\n1", null, 7]) {
      assert.equal(isOffboardingReference(invalid), false, String(invalid));
    }
    const { port, calls } = registrationPort();
    assert.deepEqual(await registerOffboardingRequest(port, { companyId: COMPANY, reference: "fulano@empresa.com", confirmation: CLOSURE }), { ok: false, reason: "invalid_reference" });
    assert.deepEqual(await registerOffboardingRequest(port, { companyId: COMPANY, reference: "REG-1", confirmation: "" }), { ok: false, reason: "confirmation_mismatch" });
    assert.deepEqual(calls, []);
  });

  test("entrada válida segue para o banco, que decide a autoridade", async () => {
    const { port, calls } = registrationPort();
    assert.deepEqual(await registerOffboardingRequest(port, { companyId: COMPANY, reference: "REG-1", confirmation: CLOSURE }), { ok: true, closedNow: true, alreadyRegistered: false });
    assert.deepEqual(calls, [`${COMPANY}|REG-1|${CLOSURE}`]);
  });

  test("resultado do banco: formas conhecidas aceitas, qualquer outra é falha", () => {
    assert.deepEqual(parseOffboardingRegistrationResult({ ok: true, closed_now: false, already_registered: true }), { ok: true, closedNow: false, alreadyRegistered: true });
    for (const reason of ["not_found", "invalid_reference", "confirmation_mismatch"] as const) {
      assert.deepEqual(parseOffboardingRegistrationResult({ ok: false, reason }), { ok: false, reason });
      assert.ok(OFFBOARDING_REGISTRATION_MESSAGES[reason].length > 0);
    }
    for (const raw of [null, {}, { ok: false, reason: "boom" }, { ok: true }]) {
      assert.throws(() => parseOffboardingRegistrationResult(raw));
    }
  });
});
