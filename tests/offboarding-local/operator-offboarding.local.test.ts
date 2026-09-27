import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { runCompanyPurge } from "@/modules/companies/lib/company-offboarding";
import { registerOffboardingRequest } from "@/modules/companies/lib/operator-offboarding";
import {
  createOffboardingRegistrationPort,
  createOperatorOffboardingPorts,
  isOffboardingOperator,
  previewForOperator,
} from "@/modules/companies/services/operator-offboarding.service";
import type { Database } from "@/types/database";

/**
 * Mission 202B — Governed Operator Offboarding Authority (D-131).
 *
 * Prova de ponta a ponta contra um Supabase LOCAL e descartável: o dono
 * cria a empresa, envia arquivos e NUNCA MAIS VOLTA; o operador de
 * offboarding (usuário real do Auth local, autoridade concedida pelo
 * dono do banco local) registra a solicitação, encerra e conclui a
 * purga com as MESMAS portas do server action — Storage API e RPC
 * reais, sem `service_role`. Prova também que o operador não lê,
 * não baixa, não lista e não grava dados da empresa.
 *
 * Como rodar (nunca contra o NEXO Pilot):
 *   npx supabase start
 *   (exportar SUPABASE_LOCAL_URL e SUPABASE_LOCAL_ANON_KEY a partir de `npx supabase status -o env`)
 *   npm run test:offboarding-local
 *
 * Travas: recusa URL que não seja localhost/127.0.0.1; a concessão usa
 * `supabase db query --local` (nunca `--linked`).
 */

const URL = process.env.SUPABASE_LOCAL_URL ?? "";
const ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY ?? "";
const BUCKET = "documents";

type Client = SupabaseClient<Database>;
type Actor = { client: Client; id: string };

function assertLocalTarget(): void {
  assert.ok(URL && ANON_KEY, "defina SUPABASE_LOCAL_URL e SUPABASE_LOCAL_ANON_KEY (npx supabase status -o env)");
  const host = new globalThis.URL(URL).hostname;
  assert.ok(host === "127.0.0.1" || host === "localhost", `recusado: ${host} não é um Supabase local`);
}

/** SQL como dono do banco LOCAL — o único caminho de concessão (D-131). */
function localDatabaseOwnerSql(sql: string): Array<Record<string, unknown>> {
  const file = join(tmpdir(), `m202b-${randomUUID()}.sql`);
  writeFileSync(file, sql);
  try {
    const out = execSync(`npx supabase db query --local -o json -f "${file}"`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const json = out.slice(out.indexOf("{"));
    return (JSON.parse(json) as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  } finally {
    rmSync(file, { force: true });
  }
}

async function newUser(): Promise<Actor> {
  const client = createClient<Database>(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signUp({
    email: `m202b-${randomUUID()}@offboarding.local.test`,
    password: randomUUID(),
  });
  if (error || !data.user || !data.session) throw new Error(`signup local falhou: ${error?.message ?? "sem sessão"}`);
  return { client, id: data.user.id };
}

async function newCompany(owner: Actor, cnpj: string): Promise<string> {
  const { data, error } = await owner.client
    .from("companies")
    .insert({ user_id: owner.id, razao_social: `SMOKE M202B ${cnpj}`, cnpj })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function upload(client: Client, path: string): Promise<void> {
  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, new Blob(["Receita Bruta de Vendas R$ 1.000,00\n"], { type: "text/csv" }), { contentType: "text/csv" });
  if (error) throw error;
}

async function registerDocument(client: Client, companyId: string, path: string): Promise<void> {
  const { error } = await client.from("documents").insert({
    company_id: companyId,
    nome_original: "dre.csv",
    nome_armazenado: "dre.csv",
    categoria: "dre",
    tipo_arquivo: "text/csv",
    tamanho_bytes: 36,
    storage_path: path,
    hash_arquivo: "sintetico",
  });
  if (error) throw error;
}

async function canDownload(client: Client, path: string): Promise<boolean> {
  const { data, error } = await client.storage.from(BUCKET).download(path);
  return !error && data !== null;
}

const purgePhrase = (id: string) => `EXCLUIR-${id.slice(0, 8).toUpperCase()}`;
const closurePhrase = (id: string) => `ENCERRAR-${id.slice(0, 8).toUpperCase()}`;

describe("Mission 202B — offboarding pelo operador sem sessão do dono (Supabase local, Storage API + RPC reais)", () => {
  let ownerA: Actor;
  let ownerB: Actor;
  let operator: Actor;
  let regular: Actor;
  let companyA1: string;
  let companyA2: string;
  let companyB1: string;
  const pathsA1: string[] = [];
  let pathA2: string;
  let pathB1: string;

  before(async () => {
    assertLocalTarget();
    ownerA = await newUser();
    ownerB = await newUser();
    operator = await newUser();
    regular = await newUser();
    companyA1 = await newCompany(ownerA, "11222333000181");
    companyA2 = await newCompany(ownerA, "99888777000161");
    companyB1 = await newCompany(ownerB, "11222333000181");

    // A1: dois documentos aceitos + um objeto órfão; uma análise.
    for (const suffix of ["doc-1/dre.csv", "doc-2/balanco.csv", "orfao/rejeitado.csv"]) {
      const path = `company/${companyA1}/${suffix}`;
      await upload(ownerA.client, path);
      pathsA1.push(path);
    }
    await registerDocument(ownerA.client, companyA1, pathsA1[0]);
    await registerDocument(ownerA.client, companyA1, pathsA1[1]);
    const { error: executionError } = await ownerA.client
      .from("executions")
      .insert({ execution_id: randomUUID(), company_id: companyA1, metadata: {}, execution: {} });
    if (executionError) throw executionError;

    pathA2 = `company/${companyA2}/doc-1/dre.csv`;
    await upload(ownerA.client, pathA2);
    await registerDocument(ownerA.client, companyA2, pathA2);

    pathB1 = `company/${companyB1}/doc-1/dre.csv`;
    await upload(ownerB.client, pathB1);
    await registerDocument(ownerB.client, companyB1, pathB1);
    // A partir daqui o dono de A1 não faz mais nada: só é usado para CONFERIR o estado.
  });

  after(() => {
    if (operator) {
      localDatabaseOwnerSql(
        `select public.revoke_offboarding_operator('${operator.id}', 'E2E-REVOKE') from public.offboarding_operators where user_id = '${operator.id}' and revoked_at is null;`
      );
    }
  });

  test("sem concessão, a conta não tem nenhuma autoridade (idêntico a inexistente)", async () => {
    assert.equal(await isOffboardingOperator(operator.client), false);
    assert.deepEqual(await previewForOperator(operator.client, companyA1), { found: false });
    const register = await registerOffboardingRequest(createOffboardingRegistrationPort(operator.client), {
      companyId: companyA1,
      reference: "E2E-REG-1",
      confirmation: closurePhrase(companyA1),
    });
    assert.deepEqual(register, { ok: false, reason: "not_found" });
  });

  test("concessão governada: só o dono do banco concede; a conta passa a ser operador", async () => {
    localDatabaseOwnerSql(`select public.grant_offboarding_operator('${operator.id}', 'E2E-GRANT');`);
    assert.equal(await isOffboardingOperator(operator.client), true);
    assert.equal(await isOffboardingOperator(regular.client), false, "outra conta continua sem autoridade");
  });

  test("operador NÃO lê, NÃO baixa, NÃO lista e NÃO grava dados da empresa", async () => {
    const reads = await Promise.all([
      operator.client.from("companies").select("id").eq("id", companyA1),
      operator.client.from("documents").select("id").eq("company_id", companyA1),
      operator.client.from("executions").select("id").eq("company_id", companyA1),
    ]);
    for (const { data } of reads) assert.deepEqual(data, []);
    assert.equal(await canDownload(operator.client, pathsA1[0]), false, "download negado");
    const { data: listed } = await operator.client.storage.from(BUCKET).list(`company/${companyA1}/doc-1`);
    assert.deepEqual(listed ?? [], [], "listagem negada");
    const { error: uploadError } = await operator.client.storage
      .from(BUCKET)
      .upload(`company/${companyA1}/novo/x.csv`, new Blob(["x"]), { contentType: "text/csv" });
    assert.notEqual(uploadError, null, "upload negado");
    const { error: insertError } = await operator.client
      .from("executions")
      .insert({ execution_id: randomUUID(), company_id: companyA1, metadata: {}, execution: {} });
    assert.notEqual(insertError, null, "gravação negada");
  });

  test("empresa ATIVA: o operador não purga e não remove arquivos", async () => {
    const outcome = await runCompanyPurge(createOperatorOffboardingPorts(operator.client), {
      companyId: companyA1,
      confirmation: purgePhrase(companyA1),
    });
    assert.deepEqual(outcome, { ok: false, reason: "not_closed" });
    await operator.client.storage.from(BUCKET).remove(pathsA1);
    for (const path of pathsA1) assert.equal(await canDownload(ownerA.client, path), true, `${path} intacto`);
  });

  test("registro da solicitação: referência e frase validadas; encerra a empresa aberta", async () => {
    const port = createOffboardingRegistrationPort(operator.client);
    assert.deepEqual(
      await registerOffboardingRequest(port, { companyId: companyA1, reference: "dono@empresa.com", confirmation: closurePhrase(companyA1) }),
      { ok: false, reason: "invalid_reference" }
    );
    assert.deepEqual(
      await registerOffboardingRequest(port, { companyId: "not-a-uuid", reference: "E2E-REG-1", confirmation: "x" }),
      { ok: false, reason: "not_found" }
    );
    assert.deepEqual(
      await registerOffboardingRequest(port, { companyId: companyA1, reference: "E2E-REG-1", confirmation: "ENCERRAR-00000000" }),
      { ok: false, reason: "confirmation_mismatch" }
    );
    assert.deepEqual(
      await registerOffboardingRequest(port, { companyId: companyA1, reference: "E2E-REG-1", confirmation: closurePhrase(companyA1) }),
      { ok: true, closedNow: true, alreadyRegistered: false }
    );
    const { data } = await ownerA.client.from("companies").select("deleted_at").eq("id", companyA1).single();
    assert.notEqual(data?.deleted_at, null, "A1 encerrada pelo operador");
    const preview = await previewForOperator(operator.client, companyA1);
    assert.ok(preview.found && preview.closed && preview.registered);
    assert.equal(preview.found && preview.counts.storage_objects, 3);
  });

  test("mesmo registrada, o operador continua sem baixar, listar ou ler a empresa", async () => {
    assert.equal(await canDownload(operator.client, pathsA1[0]), false);
    const { data: listed } = await operator.client.storage.from(BUCKET).list(`company/${companyA1}/doc-1`);
    assert.deepEqual(listed ?? [], []);
    const { data: docs } = await operator.client.from("documents").select("id").eq("company_id", companyA1);
    assert.deepEqual(docs, []);
    const { data: signed } = await operator.client.storage.from(BUCKET).createSignedUrl(pathsA1[0], 60);
    assert.equal(signed, null, "URL assinada negada");
  });

  test("usuário comum não ganha nada: resposta idêntica à de inexistente, arquivos intactos", async () => {
    const ports = createOperatorOffboardingPorts(regular.client);
    const onA1 = await runCompanyPurge(ports, { companyId: companyA1, confirmation: purgePhrase(companyA1) });
    const missing = await runCompanyPurge(ports, { companyId: randomUUID(), confirmation: purgePhrase(companyA1) });
    assert.deepEqual(onA1, { ok: false, reason: "not_found" });
    assert.deepEqual(onA1, missing);
    await regular.client.storage.from(BUCKET).remove(pathsA1);
    const preview = await previewForOperator(operator.client, companyA1);
    assert.equal(preview.found && preview.counts.storage_objects, 3, "remove() do usuário comum não apagou nada");
  });

  test("purga pelo operador SEM sessão do dono: Storage e banco limpos, controles intactos, conta preservada", async () => {
    const ports = createOperatorOffboardingPorts(operator.client);
    assert.deepEqual(await runCompanyPurge(ports, { companyId: companyA1, confirmation: "EXCLUIR-00000000" }), {
      ok: false,
      reason: "confirmation_mismatch",
    });

    const outcome = await runCompanyPurge(ports, { companyId: companyA1, confirmation: purgePhrase(companyA1) });
    assert.equal(outcome.ok, true, JSON.stringify(outcome));
    if (!outcome.ok) return;
    assert.equal(outcome.storageObjectsRemoved, 3, "inclui o objeto órfão");
    assert.equal(outcome.deleted.companies, 1);
    assert.equal(outcome.deleted.documents, 2);
    assert.equal(outcome.deleted.executions, 1);

    assert.deepEqual(await previewForOperator(operator.client, companyA1), { found: false });
    for (const path of pathsA1) assert.equal(await canDownload(ownerA.client, path), false, `${path} não existe mais`);

    const { data: sibling } = await ownerA.client.from("companies").select("id").eq("id", companyA2);
    assert.equal(sibling?.length, 1, "A2 (mesmo dono) intacta");
    assert.equal(await canDownload(ownerA.client, pathA2), true, "arquivo de A2 intacto");
    const { data: other } = await ownerB.client.from("companies").select("id").eq("id", companyB1);
    assert.equal(other?.length, 1, "B1 (outro dono) intacta");
    assert.equal(await canDownload(ownerB.client, pathB1), true, "arquivo de B1 intacto");

    const { data: me, error: meError } = await ownerA.client.auth.getUser();
    assert.equal(meError, null);
    assert.equal(me.user?.id, ownerA.id, "a conta do dono continua existindo");
  });

  test("auditoria mínima: encerramento e purga do operador registrados, sem dado da empresa", () => {
    const [record] = localDatabaseOwnerSql(
      `select closed_authority, closed_by = '${operator.id}' as closed_by_operator, request_reference, purge_authority,
              purged_by = '${operator.id}' as purged_by_operator, purged_at is not null as purged, purge_result
       from public.company_offboarding_records where company_id = '${companyA1}';`
    );
    assert.equal(record.closed_authority, "operator");
    assert.equal(record.closed_by_operator, true);
    assert.equal(record.request_reference, "E2E-REG-1");
    assert.equal(record.purge_authority, "operator");
    assert.equal(record.purged_by_operator, true);
    assert.equal(record.purged, true);
    const result = typeof record.purge_result === "string" ? JSON.parse(record.purge_result) : record.purge_result;
    assert.equal((result as Record<string, number>).documents, 2);
  });

  test("nova tentativa é inofensiva e a autoridade revogada some imediatamente", async () => {
    const ports = createOperatorOffboardingPorts(operator.client);
    assert.deepEqual(await runCompanyPurge(ports, { companyId: companyA1, confirmation: purgePhrase(companyA1) }), {
      ok: false,
      reason: "not_found",
    });
    localDatabaseOwnerSql(`select public.revoke_offboarding_operator('${operator.id}', 'E2E-REVOKE');`);
    assert.equal(await isOffboardingOperator(operator.client), false);
    assert.deepEqual(await previewForOperator(operator.client, companyA2), { found: false });
  });
});
