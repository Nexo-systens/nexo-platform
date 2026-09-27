import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  COMPANY_PURGE_FAILURE_MESSAGES,
  COMPANY_PURGE_RESOURCES,
  isCompanyStoragePath,
  parseCompanyPurgePreview,
  parsePurgeDatabaseResult,
  previewCompanyPurge,
  runCompanyPurge,
  type CompanyOffboardingPorts,
  type CompanyPurgePreview,
  type PurgeDatabaseResult,
} from "@/modules/companies/lib/company-offboarding";

/**
 * Mission 202 — Tenant-Safe Company Offboarding & Data Purge (D-130).
 *
 * Semântica de falha da orquestração Storage → banco, com portas
 * simuladas. A prova com Postgres/Storage REAIS está em
 * `supabase/tests/database/company_offboarding.test.sql` e
 * `tests/offboarding-local/` (Supabase local).
 */

const COMPANY = "a1a1a1a1-0000-4000-8000-000000000001";
const OTHER = "b1b1b1b1-0000-4000-8000-000000000003";
const CONFIRMATION = "EXCLUIR-A1A1A1A1";

const ZERO_COUNTS = Object.fromEntries(COMPANY_PURGE_RESOURCES.map((r) => [r, 0])) as Record<(typeof COMPANY_PURGE_RESOURCES)[number], number>;
const CLOSED: CompanyPurgePreview = { found: true, closed: true, confirmation: CONFIRMATION, counts: ZERO_COUNTS };

interface FakeOptions {
  preview?: CompanyPurgePreview;
  previewAfter?: CompanyPurgePreview;
  objects?: string[];
  listThrows?: boolean;
  removeThrows?: boolean;
  removeLeaves?: string[];
  purge?: PurgeDatabaseResult | "throw";
}

function fakePorts(options: FakeOptions = {}) {
  const calls: string[] = [];
  let objects = [...(options.objects ?? [])];
  let previews = 0;
  const ports: CompanyOffboardingPorts = {
    async preview(companyId) {
      calls.push(`preview:${companyId}`);
      previews += 1;
      if (previews > 1 && options.previewAfter) return options.previewAfter;
      return previews > 1 ? { found: false } : options.preview ?? CLOSED;
    },
    async listStorageObjects() {
      calls.push("list");
      if (options.listThrows) throw new Error("list failed");
      return objects;
    },
    async removeStorageObjects(paths) {
      calls.push(`remove:${paths.length}`);
      if (options.removeThrows) throw new Error("remove failed");
      objects = options.removeLeaves ?? objects.filter((o) => !paths.includes(o));
    },
    async purgeDatabase(companyId, confirmation) {
      calls.push(`purge:${companyId}:${confirmation}`);
      if (options.purge === "throw") throw new Error("db failed");
      return options.purge ?? { ok: true, deleted: { companies: 1 } };
    },
  };
  return { ports, calls, remaining: () => objects };
}

const objectPath = (suffix: string) => `company/${COMPANY}/${suffix}`;

describe("Mission 202 — entrada: identificador e confirmação", () => {
  test("UUID malformado é rejeitado antes de qualquer porta (D-128)", async () => {
    const { ports, calls } = fakePorts();
    for (const companyId of ["not-a-uuid", "", null, 42, `${COMPANY} `]) {
      assert.deepEqual(await runCompanyPurge(ports, { companyId, confirmation: CONFIRMATION }), { ok: false, reason: "not_found" });
      assert.deepEqual(await previewCompanyPurge(ports, companyId), { found: false });
    }
    assert.deepEqual(calls, []);
  });

  test("confirmação ausente é recusada antes de qualquer porta", async () => {
    const { ports, calls } = fakePorts();
    for (const confirmation of ["", undefined, null, true]) {
      assert.deepEqual(await runCompanyPurge(ports, { companyId: COMPANY, confirmation }), { ok: false, reason: "confirmation_mismatch" });
    }
    assert.deepEqual(calls, []);
  });

  test("não encontrada, não encerrada ou confirmação diferente: nada é listado, removido nem purgado", async () => {
    for (const [preview, confirmation, reason] of [
      [{ found: false }, CONFIRMATION, "not_found"],
      [{ ...CLOSED, closed: false }, CONFIRMATION, "not_closed"],
      [CLOSED, "EXCLUIR-00000000", "confirmation_mismatch"],
    ] as const) {
      const { ports, calls } = fakePorts({ preview, objects: [objectPath("d/x.csv")] });
      assert.deepEqual(await runCompanyPurge(ports, { companyId: COMPANY, confirmation }), { ok: false, reason });
      assert.deepEqual(calls, [`preview:${COMPANY}`]);
    }
  });
});

describe("Mission 202 — Storage antes do banco", () => {
  test("sucesso: ordem exata prévia → lista → remove → relista → purga → verificação", async () => {
    const { ports, calls, remaining } = fakePorts({ objects: [objectPath("doc-1/dre.csv"), objectPath("orfao/x.csv")] });
    const outcome = await runCompanyPurge(ports, { companyId: COMPANY, confirmation: CONFIRMATION });
    assert.deepEqual(outcome, { ok: true, storageObjectsRemoved: 2, deleted: { companies: 1 } });
    assert.deepEqual(calls, [`preview:${COMPANY}`, "list", "remove:2", "list", `purge:${COMPANY}:${CONFIRMATION}`, `preview:${COMPANY}`]);
    assert.deepEqual(remaining(), []);
  });

  test("empresa sem arquivos: não chama remove, purga o banco normalmente", async () => {
    const { ports, calls } = fakePorts({ objects: [] });
    assert.equal((await runCompanyPurge(ports, { companyId: COMPANY, confirmation: CONFIRMATION })).ok, true);
    assert.ok(!calls.some((c) => c.startsWith("remove")));
  });

  test("falha ao listar ou remover: o banco NÃO é purgado", async () => {
    for (const options of [{ listThrows: true }, { removeThrows: true }]) {
      const { ports, calls } = fakePorts({ objects: [objectPath("d/x.csv")], ...options });
      assert.deepEqual(await runCompanyPurge(ports, { companyId: COMPANY, confirmation: CONFIRMATION }), { ok: false, reason: "storage_failed" });
      assert.ok(!calls.some((c) => c.startsWith("purge")), JSON.stringify(calls));
    }
  });

  test("remove() que não apaga tudo (ex.: RLS recusou em silêncio): storage_incomplete, banco intacto", async () => {
    const leftover = objectPath("d/x.csv");
    const { ports, calls } = fakePorts({ objects: [leftover], removeLeaves: [leftover] });
    assert.deepEqual(await runCompanyPurge(ports, { companyId: COMPANY, confirmation: CONFIRMATION }), { ok: false, reason: "storage_incomplete" });
    assert.ok(!calls.some((c) => c.startsWith("purge")));
  });

  test("caminho fora do prefixo exato da empresa: nada é removido nem purgado", async () => {
    for (const unsafe of [
      `company/${OTHER}/d/x.csv`,
      `company/${COMPANY}/../${OTHER}/x.csv`,
      `company/${COMPANY}//x.csv`,
      `company/${COMPANY}/`,
      `company/${COMPANY}`,
      `other/${COMPANY}/x.csv`,
      `company/${COMPANY}/d\\x.csv`,
    ]) {
      const { ports, calls } = fakePorts({ objects: [objectPath("ok.csv"), unsafe] });
      assert.deepEqual(await runCompanyPurge(ports, { companyId: COMPANY, confirmation: CONFIRMATION }), { ok: false, reason: "unsafe_storage_path" }, unsafe);
      assert.deepEqual(calls, [`preview:${COMPANY}`, "list"], unsafe);
    }
  });
});

describe("Mission 202 — falha do banco depois do Storage e nova tentativa", () => {
  test("banco falha depois de o Storage ser esvaziado: database_failed; repetir completa a purga sem novo remove", async () => {
    const first = fakePorts({ objects: [objectPath("d/x.csv")], purge: "throw" });
    assert.deepEqual(await runCompanyPurge(first.ports, { companyId: COMPANY, confirmation: CONFIRMATION }), { ok: false, reason: "database_failed" });
    assert.deepEqual(first.remaining(), [], "Storage já foi esvaziado");

    const retry = fakePorts({ objects: first.remaining() });
    const outcome = await runCompanyPurge(retry.ports, { companyId: COMPANY, confirmation: CONFIRMATION });
    assert.equal(outcome.ok, true);
    assert.ok(!retry.calls.some((c) => c.startsWith("remove")), "nova tentativa não precisa remover nada");
  });

  test("recusas do banco chegam intactas (ex.: referência de outra empresa)", async () => {
    for (const reason of ["blocked_by_external_reference", "storage_not_empty", "not_closed"] as const) {
      const { ports } = fakePorts({ purge: { ok: false, reason } });
      assert.deepEqual(await runCompanyPurge(ports, { companyId: COMPANY, confirmation: CONFIRMATION }), { ok: false, reason });
    }
  });

  test("a verificação final não aceita uma empresa que ainda aparece", async () => {
    const { ports } = fakePorts({ previewAfter: CLOSED });
    assert.deepEqual(await runCompanyPurge(ports, { companyId: COMPANY, confirmation: CONFIRMATION }), { ok: false, reason: "verification_failed" });
  });
});

describe("Mission 202 — contratos auxiliares", () => {
  test("isCompanyStoragePath só aceita o prefixo exato e segmentos não ambíguos", () => {
    assert.equal(isCompanyStoragePath(COMPANY, objectPath("doc/dre.csv")), true);
    assert.equal(isCompanyStoragePath(COMPANY, `company/${OTHER}/doc/dre.csv`), false);
    assert.equal(isCompanyStoragePath("not-a-uuid", "company/not-a-uuid/x"), false);
    assert.equal(isCompanyStoragePath(COMPANY, 42), false);
  });

  test("respostas inesperadas das RPCs nunca viram sucesso", () => {
    for (const raw of [null, 42, "x", {}, { found: "true" }, { found: true, closed: true }]) {
      assert.deepEqual(parseCompanyPurgePreview(raw), { found: false });
    }
    for (const raw of [null, {}, { ok: false, reason: "inventado" }, { ok: true }]) {
      assert.throws(() => parsePurgeDatabaseResult(raw));
    }
    assert.deepEqual(parsePurgeDatabaseResult({ ok: false, reason: "not_found" }), { ok: false, reason: "not_found" });
  });

  test("toda falha tem mensagem para o usuário, sem jargão interno", () => {
    for (const message of Object.values(COMPANY_PURGE_FAILURE_MESSAGES)) {
      assert.ok(message.length > 0);
      assert.doesNotMatch(message, /sql|rls|policy|storage\.objects|postgres|supabase|service_role|42501|23503/i);
    }
  });
});
