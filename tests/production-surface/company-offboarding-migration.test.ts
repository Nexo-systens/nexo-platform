import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { COMPANY_PURGE_RESOURCES } from "@/modules/companies/lib/company-offboarding";

/**
 * Mission 202 — Tenant-Safe Company Offboarding & Data Purge (D-130).
 *
 * STATIC MIGRATION PROOF (roda no CI, sem Postgres). Deriva da cadeia
 * inteira de migrations quais tabelas pertencem a uma empresa e quais
 * FKs existem entre elas, e prova que a purga da Migration 017 cobre
 * TODAS, na ordem das dependências — uma tabela company-scoped nova que
 * não entrar na purga faz este teste falhar. A prova em Postgres real
 * está em `supabase/tests/database/company_offboarding.test.sql`.
 */

const MIGRATIONS_DIR = join(__dirname, "..", "..", "supabase", "migrations");
const OFFBOARDING = "20260926120000_company_offboarding.sql";

const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), "utf-8").replace(/--.*$/gm, "");
const offboarding = read(OFFBOARDING);

/** `create table public.x ( ... );` de todas as migrations. */
function tableBlocks(): Map<string, string> {
  const blocks = new Map<string, string>();
  for (const file of files) {
    for (const match of read(file).matchAll(/create\s+table\s+public\.(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
      blocks.set(match[1], match[2]);
    }
  }
  return blocks;
}

const blocks = tableBlocks();
const companyScoped = [...blocks.entries()]
  .filter(([, body]) => /company_id\s+uuid\s+not\s+null\s+references\s+public\.companies/i.test(body))
  .map(([name]) => name)
  .sort();

/** Arestas filho → pai entre tabelas company-scoped (FK para uma tabela, não para `companies`). */
const edges = [...blocks.entries()].flatMap(([child, body]) =>
  [...body.matchAll(/references\s+public\.(\w+)/gi)]
    .map((m) => m[1])
    .filter((parent) => parent !== "companies" && parent !== child && companyScoped.includes(parent))
    .map((parent) => ({ child, parent }))
);

function functionBody(name: string): string {
  const match = offboarding.match(new RegExp(`create\\s+function\\s+public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`, "i"));
  assert.ok(match, `função ${name} ausente da Migration 017`);
  return match[0];
}

const purge = functionBody("purge_closed_company");
const purgeOrder = [...purge.matchAll(/delete\s+from\s+public\.(\w+)/gi)].map((m) => m[1]);

describe("Mission 202 — cobertura e ordem da purga (derivadas do grafo real de FKs)", () => {
  test("a Migration 017 existe e é aditiva, depois de todas as anteriores", () => {
    assert.equal(files[files.length - 1], OFFBOARDING);
    assert.ok(files.indexOf("20260926000000_companies_cnpj_tenant_scoped_unique.sql") < files.indexOf(OFFBOARDING));
  });

  test("as 11 tabelas dependentes de uma empresa foram reconhecidas pelo grafo", () => {
    assert.deepEqual(companyScoped, [
      "decision_execution_events",
      "decision_outcomes",
      "decisions",
      "diagnosis_reviews",
      "documents",
      "executions",
      "executive_diagnoses",
      "financial_observations",
      "knowledge_evaluations",
      "knowledge_records",
      "learning_records",
    ]);
  });

  test("a purga apaga cada tabela company-scoped exatamente uma vez e a empresa por último", () => {
    assert.deepEqual([...purgeOrder].sort(), [...companyScoped, "companies"].sort());
    assert.equal(new Set(purgeOrder).size, purgeOrder.length);
    assert.equal(purgeOrder[purgeOrder.length - 1], "companies");
  });

  test("todo filho é apagado antes do pai referenciado (nenhuma violação de FK na ordem)", () => {
    assert.ok(edges.length >= 10, `arestas encontradas: ${edges.length}`);
    for (const { child, parent } of edges) {
      assert.ok(purgeOrder.indexOf(child) < purgeOrder.indexOf(parent), `${child} deve ser apagada antes de ${parent}`);
    }
  });

  test("cada DELETE é restrito à empresa alvo (company_id, ou id + dono para a própria empresa)", () => {
    for (const match of purge.matchAll(/delete\s+from\s+public\.(\w+)\s+where\s+([^;]+);/gi)) {
      const [, table, where] = match;
      const expected = table === "companies" ? /id\s*=\s*p_company_id\s+and\s+user_id\s*=\s*v_uid/ : /^company_id\s*=\s*p_company_id$/;
      assert.match(where.trim(), expected, table);
    }
  });

  test("a prévia e a verificação final cobrem as mesmas tabelas; o front conhece os mesmos recursos", () => {
    const preview = functionBody("preview_company_purge");
    for (const table of companyScoped) {
      assert.match(preview, new RegExp(`'${table}'`), `prévia sem ${table}`);
      assert.match(purge, new RegExp(`from\\s+public\\.${table}\\s+where\\s+company_id\\s*=\\s*p_company_id\\)`), `verificação sem ${table}`);
    }
    assert.deepEqual([...COMPANY_PURGE_RESOURCES].sort(), [...companyScoped, "storage_objects"].sort());
  });

  test("nenhum ON DELETE CASCADE novo: continua existindo só o de public.users → auth.users", () => {
    const cascades = files.flatMap((file) => (read(file).match(/on\s+delete\s+cascade/gi) ?? []).map(() => file));
    assert.deepEqual(cascades, ["20260719185615_users_profile.sql"]);
  });
});

describe("Mission 202 — fronteira de segurança das funções", () => {
  test("só a purga é SECURITY DEFINER; prévia e listagem ficam sob RLS; todas com search_path vazio", () => {
    assert.match(purge, /security\s+definer/i);
    for (const name of ["preview_company_purge", "list_closed_company_storage_objects"]) {
      assert.match(functionBody(name), /security\s+invoker/i, name);
    }
    for (const name of ["purge_closed_company", "preview_company_purge", "list_closed_company_storage_objects", "company_purge_confirmation"]) {
      assert.match(functionBody(name), /set\s+search_path\s*=\s*''/i, name);
    }
  });

  test("a purga valida auth.uid(), posse, encerramento, confirmação e Storage vazio ANTES do primeiro DELETE", () => {
    const firstDelete = purge.search(/delete\s+from/i);
    const guards = purge.slice(0, firstDelete);
    assert.match(guards, /v_uid\s+uuid\s*:=\s*auth\.uid\(\)/);
    assert.match(guards, /user_id\s*=\s*v_uid[\s\S]*for\s+update/);
    assert.match(guards, /v_deleted_at\s+is\s+null[\s\S]*'not_closed'/);
    assert.match(guards, /is\s+distinct\s+from\s+public\.company_purge_confirmation\(p_company_id\)/);
    assert.match(guards, /storage\.objects[\s\S]*'storage_not_empty'/);
    assert.doesNotMatch(purge, /auth\.users|public\.users/, "a purga nunca toca na conta");
    assert.doesNotMatch(purge, /\bexecute\b/i, "sem SQL dinâmico");
  });

  test("nenhuma função de offboarding é executável por public ou anon; só authenticated", () => {
    for (const signature of [
      "company_purge_confirmation\\(uuid\\)",
      "preview_company_purge\\(uuid\\)",
      "list_closed_company_storage_objects\\(uuid\\)",
      "purge_closed_company\\(uuid, text\\)",
    ]) {
      assert.match(offboarding, new RegExp(`revoke all on function public\\.${signature} from public;`));
      assert.match(offboarding, new RegExp(`revoke all on function public\\.${signature} from anon;`));
      assert.match(offboarding, new RegExp(`grant execute on function public\\.${signature} to authenticated;`));
    }
  });
});

describe("Mission 202 — encerramento monotônico e empresa encerrada sem novos dados", () => {
  function alteredPolicy(name: string): string {
    const match = offboarding.match(new RegExp(`alter\\s+policy\\s+"${name}"[\\s\\S]*?;`, "i"));
    assert.ok(match, `policy ${name} não foi endurecida`);
    return match[0];
  }

  test("companies: UPDATE só em empresa aberta (sem reabrir), WITH CHECK só com a posse (permite encerrar)", () => {
    const policy = alteredPolicy("companies_update_own");
    assert.match(policy, /using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s+and\s+deleted_at\s+is\s+null\s*\)/i);
    assert.match(policy, /with\s+check\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i);
  });

  test("toda gravação company-scoped exige empresa aberta", () => {
    for (const table of companyScoped) {
      assert.match(alteredPolicy(`${table}_insert_own`), /c\.deleted_at\s+is\s+null/, `${table}_insert_own`);
    }
    assert.equal((alteredPolicy("documents_update_own").match(/c\.deleted_at\s+is\s+null/g) ?? []).length, 2);
    assert.match(alteredPolicy("documents_storage_insert_own"), /c\.deleted_at\s+is\s+null/);
  });

  test("financial_observations passa a exigir execuções e desfecho da MESMA empresa", () => {
    const policy = alteredPolicy("financial_observations_insert_own");
    assert.match(policy, /e\.execution_id\s*=\s*financial_observations\.baseline_execution_id\s+and\s+e\.company_id\s*=\s*financial_observations\.company_id/);
    assert.match(policy, /e\.execution_id\s*=\s*financial_observations\.observation_execution_id\s+and\s+e\.company_id\s*=\s*financial_observations\.company_id/);
    assert.match(policy, /o\.id\s*=\s*financial_observations\.human_outcome_id\s+and\s+o\.company_id\s*=\s*financial_observations\.company_id/);
  });

  test("Storage: DELETE só no prefixo exato de empresa ENCERRADA do próprio dono", () => {
    const match = offboarding.match(/create\s+policy\s+"documents_storage_delete_closed_company"[\s\S]*?;/i);
    assert.ok(match);
    const policy = match[0];
    assert.match(policy, /for\s+delete/i);
    assert.match(policy, /bucket_id\s*=\s*'documents'/);
    assert.match(policy, /\(storage\.foldername\(name\)\)\[1\]\s*=\s*'company'/);
    assert.match(policy, /c\.user_id\s*=\s*auth\.uid\(\)/);
    assert.match(policy, /c\.deleted_at\s+is\s+not\s+null/);
  });
});
