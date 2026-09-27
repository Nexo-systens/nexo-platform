import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, test } from "node:test";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { runCompanyPurge, type CompanyOffboardingPorts } from "@/modules/companies/lib/company-offboarding";
import { createCompanyOffboardingPorts } from "@/modules/companies/services/company-offboarding.service";
import type { Database } from "@/types/database";

/**
 * Mission 202 — Tenant-Safe Company Offboarding & Data Purge (D-130).
 *
 * Prova de ponta a ponta contra um Supabase LOCAL e descartável:
 * usuários reais do Auth local, uploads reais pela Storage API, as
 * MESMAS portas do server action (`createCompanyOffboardingPorts`) e a
 * RPC real `purge_closed_company` da Migration 017. Nada de
 * `service_role`: cada ator usa só a própria sessão.
 *
 * Como rodar (nunca contra o NEXO Pilot):
 *   npx supabase start
 *   (exportar SUPABASE_LOCAL_URL e SUPABASE_LOCAL_ANON_KEY a partir de `npx supabase status -o env`)
 *   npm run test:offboarding-local
 *
 * Trava: o teste se recusa a rodar se a URL não for localhost/127.0.0.1.
 */

const URL = process.env.SUPABASE_LOCAL_URL ?? "";
const ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY ?? "";
const BUCKET = "documents";

type Client = SupabaseClient<Database>;

function assertLocalTarget(): void {
  assert.ok(URL && ANON_KEY, "defina SUPABASE_LOCAL_URL e SUPABASE_LOCAL_ANON_KEY (npx supabase status -o env)");
  const host = new globalThis.URL(URL).hostname;
  assert.ok(host === "127.0.0.1" || host === "localhost", `recusado: ${host} não é um Supabase local`);
}

async function newUser(): Promise<{ client: Client; id: string }> {
  const client = createClient<Database>(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signUp({
    email: `m202-${randomUUID()}@offboarding.local.test`,
    password: randomUUID(),
  });
  if (error || !data.user || !data.session) throw new Error(`signup local falhou: ${error?.message ?? "sem sessão"}`);
  return { client, id: data.user.id };
}

async function newCompany(owner: { client: Client; id: string }, cnpj: string): Promise<string> {
  const { data, error } = await owner.client
    .from("companies")
    .insert({ user_id: owner.id, razao_social: `SMOKE M202 ${cnpj}`, cnpj })
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

describe("Mission 202 — offboarding de ponta a ponta no Supabase local (Storage API + RPC reais)", () => {
  let ownerA: { client: Client; id: string };
  let ownerB: { client: Client; id: string };
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
    companyA1 = await newCompany(ownerA, "11222333000181");
    companyA2 = await newCompany(ownerA, "99888777000161");
    companyB1 = await newCompany(ownerB, "11222333000181");

    // A1: dois documentos aceitos + um objeto órfão (upload sem registro).
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
  });

  test("empresa ATIVA: purga recusada, arquivos de documentos aceitos continuam imutáveis (D-123)", async () => {
    const outcome = await runCompanyPurge(createCompanyOffboardingPorts(ownerA.client), {
      companyId: companyA1,
      confirmation: `EXCLUIR-${companyA1.slice(0, 8).toUpperCase()}`,
    });
    assert.deepEqual(outcome, { ok: false, reason: "not_closed" });

    await ownerA.client.storage.from(BUCKET).remove([pathsA1[0]]);
    assert.equal(await canDownload(ownerA.client, pathsA1[0]), true, "remove() direto numa empresa aberta não apaga documento aceito");
  });

  test("encerramento: monotônico e sem novos dados por API direta", async () => {
    const { error: closeError } = await ownerA.client
      .from("companies")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", companyA1);
    assert.equal(closeError, null);

    await ownerA.client.from("companies").update({ deleted_at: null }).eq("id", companyA1);
    const { data: stillClosed } = await ownerA.client.from("companies").select("deleted_at").eq("id", companyA1).single();
    assert.notEqual(stillClosed?.deleted_at, null, "a empresa encerrada não pode ser reaberta pelo usuário");

    const { error: uploadError } = await ownerA.client.storage
      .from(BUCKET)
      .upload(`company/${companyA1}/novo/x.csv`, new Blob(["x"]), { contentType: "text/csv" });
    assert.notEqual(uploadError, null, "upload no prefixo da empresa encerrada é recusado");

    const { error: executionError } = await ownerA.client
      .from("executions")
      .insert({ execution_id: randomUUID(), company_id: companyA1, metadata: {}, execution: {} });
    assert.notEqual(executionError, null, "nova execução na empresa encerrada é recusada");
  });

  test("owner B não alcança A1 (prévia, purga e Storage), e a resposta é idêntica à de um UUID inexistente", async () => {
    const portsB = createCompanyOffboardingPorts(ownerB.client);
    const confirmation = `EXCLUIR-${companyA1.slice(0, 8).toUpperCase()}`;
    const byB = await runCompanyPurge(portsB, { companyId: companyA1, confirmation });
    const missing = await runCompanyPurge(portsB, { companyId: randomUUID(), confirmation });
    assert.deepEqual(byB, { ok: false, reason: "not_found" });
    assert.deepEqual(byB, missing);

    await ownerB.client.storage.from(BUCKET).remove(pathsA1);
    assert.deepEqual(await portsB.listStorageObjects(companyA1), []);
    assert.equal((await createCompanyOffboardingPorts(ownerA.client).listStorageObjects(companyA1)).length, 3, "remove() de B não apagou nada de A1");
  });

  test("identificador malformado e confirmação errada nunca apagam nada", async () => {
    const portsA = createCompanyOffboardingPorts(ownerA.client);
    assert.deepEqual(await runCompanyPurge(portsA, { companyId: "not-a-uuid", confirmation: "x" }), { ok: false, reason: "not_found" });
    assert.deepEqual(await runCompanyPurge(portsA, { companyId: companyA1, confirmation: "EXCLUIR-00000000" }), {
      ok: false,
      reason: "confirmation_mismatch",
    });
    assert.equal((await portsA.listStorageObjects(companyA1)).length, 3);
  });

  test("falha no Storage: o banco NÃO é purgado e a empresa continua encerrada", async () => {
    const real = createCompanyOffboardingPorts(ownerA.client);
    const failingStorage: CompanyOffboardingPorts = {
      ...real,
      removeStorageObjects: async () => {
        throw new Error("storage indisponível (simulado)");
      },
    };
    const confirmation = `EXCLUIR-${companyA1.slice(0, 8).toUpperCase()}`;
    assert.deepEqual(await runCompanyPurge(failingStorage, { companyId: companyA1, confirmation }), {
      ok: false,
      reason: "storage_failed",
    });
    const preview = await real.preview(companyA1);
    assert.equal(preview.found && preview.counts.documents, 2, "dados estruturados intactos");
    assert.equal(preview.found && preview.counts.storage_objects, 3, "arquivos intactos");
  });

  test("purga completa: Storage e banco limpos, outra empresa do dono e empresa de outro dono intactas, conta preservada", async () => {
    const portsA = createCompanyOffboardingPorts(ownerA.client);
    const preview = await portsA.preview(companyA1);
    assert.ok(preview.found && preview.closed);

    const outcome = await runCompanyPurge(portsA, { companyId: companyA1, confirmation: preview.found ? preview.confirmation : "" });
    assert.equal(outcome.ok, true, JSON.stringify(outcome));
    if (!outcome.ok) return;
    assert.equal(outcome.storageObjectsRemoved, 3, "inclui o objeto órfão");
    assert.equal(outcome.deleted.companies, 1);
    assert.equal(outcome.deleted.documents, 2);
    assert.equal(outcome.deleted.executions, 1);

    assert.deepEqual(await portsA.preview(companyA1), { found: false });
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

  test("nova tentativa depois do sucesso é inofensiva", async () => {
    const outcome = await runCompanyPurge(createCompanyOffboardingPorts(ownerA.client), {
      companyId: companyA1,
      confirmation: `EXCLUIR-${companyA1.slice(0, 8).toUpperCase()}`,
    });
    assert.deepEqual(outcome, { ok: false, reason: "not_found" });
  });

  test("a CNPJ da empresa purgada volta a poder ser cadastrada pelo mesmo dono (D-126)", async () => {
    const recreated = await newCompany(ownerA, "11222333000181");
    assert.ok(recreated);
  });
});
