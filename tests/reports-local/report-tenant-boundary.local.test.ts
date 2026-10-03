import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, test } from "node:test";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { DIAGNOSIS_BOUNDARIES } from "@/efos/application/executive-diagnosis";
import { SupabasePersistenceClient } from "@/efos/infrastructure/providers";
import { SupabaseExecutionRepository } from "@/efos/infrastructure/repositories";
import {
  listDiagnosisLinks,
  listReportCompanies,
  listReportEntries,
  resolveReportCompanyId,
} from "@/modules/reports/services/report-queries";
import type { Database } from "@/types/database";

import { buildSyntheticExecution } from "../production-surface/fixtures/report-fixtures";

/**
 * Mission 208 — prova de ponta a ponta da fronteira de empresa do relatório
 * executivo, contra um Supabase LOCAL e descartável: dois usuários reais do
 * Auth local, cada um só com a própria sessão (nunca `service_role`), e as
 * MESMAS consultas que as páginas `/reports` e `/reports/[executionId]`
 * usam (`report-queries.ts`) mais o repositório canônico de execuções.
 *
 * Como rodar (nunca contra o NEXO Pilot):
 *   npx supabase start
 *   (exportar SUPABASE_LOCAL_URL e SUPABASE_LOCAL_ANON_KEY a partir de `npx supabase status -o env`)
 *   npm run test:reports-local
 *
 * Trava: recusa qualquer URL que não seja localhost/127.0.0.1.
 */

const URL = process.env.SUPABASE_LOCAL_URL ?? "";
const ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY ?? "";

type Client = SupabaseClient<Database>;

function assertLocalTarget(): void {
  assert.ok(URL && ANON_KEY, "defina SUPABASE_LOCAL_URL e SUPABASE_LOCAL_ANON_KEY (npx supabase status -o env)");
  const host = new globalThis.URL(URL).hostname;
  assert.ok(host === "127.0.0.1" || host === "localhost", `recusado: ${host} não é um Supabase local`);
}

/**
 * O PostgREST local recusa por alguns instantes um JWT recém-emitido quando o
 * relógio do container está atrás do host (`PGRST303 JWT issued at future`,
 * mesma assinatura observada na Mission 204). Espera a sessão nova ser
 * aceita — nunca troca de credencial nem relaxa a verificação.
 */
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
  const { data, error } = await client.auth.signUp({ email: `m208-${randomUUID()}@reports.local.test`, password: randomUUID() });
  if (error || !data.user || !data.session) throw new Error(`signup local falhou: ${error?.message ?? "sem sessão"}`);
  await untilSessionAccepted(client);
  return { client, id: data.user.id };
}

async function newCompany(owner: { client: Client; id: string }, cnpj: string): Promise<string> {
  const { data, error } = await owner.client
    .from("companies")
    .insert({ user_id: owner.id, razao_social: `SMOKE M208 ${cnpj}`, cnpj })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

describe("Mission 208 — relatório executivo respeita a fronteira de empresa (Supabase local)", () => {
  let ownerA: { client: Client; id: string };
  let ownerB: { client: Client; id: string };
  let companyA: string;
  let companyB: string;
  const executionA = randomUUID();

  before(async () => {
    assertLocalTarget();
    [ownerA, ownerB] = await Promise.all([newUser(), newUser()]);
    [companyA, companyB] = await Promise.all([newCompany(ownerA, "11222333000181"), newCompany(ownerB, "99888777000161")]);

    // A grava a própria análise pelo repositório canônico, com a própria sessão.
    const execution = await buildSyntheticExecution(companyA, executionA, new Date().toISOString());
    await new SupabaseExecutionRepository(new SupabasePersistenceClient(ownerA.client)).save(execution.snapshot);

    const { error } = await ownerA.client.from("executive_diagnoses").insert({
      company_id: companyA,
      execution_id: executionA,
      provider_name: "m208-local",
      diagnosis: {
        id: randomUUID(),
        basedOn: { generatedAt: new Date().toISOString() },
        executiveSummary: { statement: "Leitura sintética local.", basis: {} },
        interpretations: [],
        hypotheses: [],
        risks: [],
        priorities: [],
        possibleActions: [],
        questions: [],
        uncertainties: [],
        conflictInterpretations: [],
        boundaries: DIAGNOSIS_BOUNDARIES,
      } as unknown as Database["public"]["Tables"]["executive_diagnoses"]["Insert"]["diagnosis"],
    });
    if (error) throw error;
  });

  test("o dono vê o próprio relatório: empresa resolvida, período canônico e leitura da IA ligada", async () => {
    assert.equal(await resolveReportCompanyId(ownerA.client, executionA), companyA);
    const entry = (await listReportEntries(ownerA.client)).find((candidate) => candidate.executionId === executionA);
    assert.ok(entry && entry.hasReport && entry.period, "o índice do dono lista o relatório com período");
    assert.ok((await listDiagnosisLinks(ownerA.client)).some((link) => link.executionId === executionA));
  });

  test("B nunca resolve, lista nem lê o relatório de A — nem por id direto", async () => {
    assert.equal(await resolveReportCompanyId(ownerB.client, executionA), null, "id direto de outra empresa = inexistente");
    assert.ok(!(await listReportEntries(ownerB.client)).some((entry) => entry.executionId === executionA || entry.companyId === companyA));
    assert.ok(!(await listDiagnosisLinks(ownerB.client)).some((link) => link.executionId === executionA || link.companyId === companyA));
    assert.ok(!(await listReportCompanies(ownerB.client)).some((company) => company.id === companyA));

    const repository = new SupabaseExecutionRepository(new SupabasePersistenceClient(ownerB.client));
    assert.equal(await repository.findByExecutionId(executionA), undefined);
    assert.deepEqual(await repository.findByCompany(companyA), []);
  });

  test("B não grava relatório nem leitura da IA em nome da empresa de A", async () => {
    const forged = await buildSyntheticExecution(companyA, randomUUID(), new Date().toISOString());
    await assert.rejects(
      new SupabaseExecutionRepository(new SupabasePersistenceClient(ownerB.client)).save(forged.snapshot),
      "RLS recusa execução com company_id de outra empresa"
    );
    const { error } = await ownerB.client
      .from("executive_diagnoses")
      .insert({ company_id: companyA, execution_id: executionA, diagnosis: {} });
    assert.ok(error, "RLS recusa leitura da IA para empresa de outro dono");
    assert.ok(companyB, "B tem a própria empresa");
  });

  test("id malformado nunca chega ao banco e é indistinguível de inexistente", async () => {
    assert.equal(await resolveReportCompanyId(ownerA.client, "nao-e-um-uuid"), null);
    assert.equal(await resolveReportCompanyId(ownerA.client, randomUUID()), null);
  });
});
