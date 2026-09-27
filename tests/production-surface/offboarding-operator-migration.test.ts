import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

/**
 * Mission 202B — Governed Operator Offboarding Authority (D-131).
 *
 * STATIC MIGRATION PROOF (roda no CI, sem Postgres). Lê a DEFINIÇÃO
 * EFETIVA de cada função (a última `create [or replace] function` da
 * cadeia) e prova: um único núcleo de purga, na ordem derivada do grafo
 * real de FKs; as duas autoridades validando tudo ANTES do núcleo; o
 * operador sem nenhuma policy de dados; o registro de auditoria sem
 * dado financeiro; Storage do operador só dentro da remoção em lote.
 * A prova em Postgres real está em
 * `supabase/tests/database/offboarding_operator_authority.test.sql`.
 */

const ROOT = join(__dirname, "..", "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const OFFBOARDING = "20260926120000_company_offboarding.sql";
const OPERATOR = "20260927120000_offboarding_operator_authority.sql";

const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), "utf-8").replace(/--.*$/gm, "");
const operator = read(OPERATOR);

/** Última definição de uma função na cadeia inteira de migrations. */
function effectiveFunction(name: string): string {
  let found: string | undefined;
  for (const file of files) {
    for (const match of read(file).matchAll(
      new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`, "gi")
    )) {
      found = match[0];
    }
  }
  assert.ok(found, `função ${name} ausente`);
  return found;
}

const blocks = new Map<string, string>();
for (const file of files) {
  for (const match of read(file).matchAll(/create\s+table\s+public\.(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
    blocks.set(match[1], match[2]);
  }
}
const companyScoped = [...blocks.entries()]
  .filter(([, body]) => /company_id\s+uuid\s+not\s+null\s+references\s+public\.companies/i.test(body))
  .map(([name]) => name)
  .sort();
const edges = [...blocks.entries()].flatMap(([child, body]) =>
  [...body.matchAll(/references\s+public\.(\w+)/gi)]
    .map((m) => m[1])
    .filter((parent) => parent !== "companies" && parent !== child && companyScoped.includes(parent))
    .map((parent) => ({ child, parent }))
);

const core = effectiveFunction("company_purge_execute");
const coreOrder = [...core.matchAll(/delete\s+from\s+public\.(\w+)/gi)].map((m) => m[1]);
const ownerPurge = effectiveFunction("purge_closed_company");
const operatorPurge = effectiveFunction("operator_purge_closed_company");

describe("Mission 202B — núcleo único da purga", () => {
  test("a Migration 018 vem depois da 017", () => {
    assert.ok(files.includes(OPERATOR));
    assert.ok(files.indexOf(OFFBOARDING) < files.indexOf(OPERATOR));
  });

  test("o núcleo apaga cada tabela company-scoped exatamente uma vez, a empresa por último", () => {
    assert.equal(companyScoped.length, 11);
    assert.deepEqual([...coreOrder].sort(), [...companyScoped, "companies"].sort());
    assert.equal(new Set(coreOrder).size, coreOrder.length);
    assert.equal(coreOrder[coreOrder.length - 1], "companies");
  });

  test("no núcleo, todo filho é apagado antes do pai (grafo real de FKs)", () => {
    assert.ok(edges.length >= 10);
    for (const { child, parent } of edges) {
      assert.ok(coreOrder.indexOf(child) < coreOrder.indexOf(parent), `${child} antes de ${parent}`);
    }
  });

  test("cada DELETE do núcleo é restrito à empresa alvo e há verificação de zero restante", () => {
    for (const match of core.matchAll(/delete\s+from\s+public\.(\w+)\s+where\s+([^;]+);/gi)) {
      const [, table, where] = match;
      assert.match(where.trim(), table === "companies" ? /^id\s*=\s*p_company_id$/ : /^company_id\s*=\s*p_company_id$/, table);
    }
    for (const table of companyScoped) {
      assert.match(core, new RegExp(`from\\s+public\\.${table}\\s+where\\s+company_id\\s*=\\s*p_company_id\\)`), `verificação sem ${table}`);
    }
    assert.match(core, /when\s+foreign_key_violation\s+then[\s\S]*'blocked_by_external_reference'/);
    assert.doesNotMatch(core, /auth\.users|public\.users/, "o núcleo nunca toca na conta");
    assert.doesNotMatch(core, /\bexecute\b/i, "sem SQL dinâmico");
  });

  test("DELETE de dados só existe no núcleo: dono e operador delegam", () => {
    for (const [name, body] of [["purge_closed_company", ownerPurge], ["operator_purge_closed_company", operatorPurge]]) {
      assert.doesNotMatch(body, /delete\s+from/i, `${name} não deve apagar diretamente`);
      assert.match(body, /public\.company_purge_execute\(p_company_id\)/, `${name} delega ao núcleo`);
    }
    const deletesIn018 = [...operator.matchAll(/delete\s+from\s+public\.(\w+)/gi)].length;
    assert.equal(deletesIn018, coreOrder.length, "na 018, só o núcleo contém DELETE");
  });

  test("o fluxo do dono mantém os guards da 017, todos antes do núcleo", () => {
    const guards = ownerPurge.slice(0, ownerPurge.search(/company_purge_execute/));
    assert.match(guards, /v_uid\s+uuid\s*:=\s*auth\.uid\(\)/);
    assert.match(guards, /user_id\s*=\s*v_uid[\s\S]*for\s+update/);
    assert.match(guards, /v_deleted_at\s+is\s+null[\s\S]*'not_closed'/);
    assert.match(guards, /is\s+distinct\s+from\s+public\.company_purge_confirmation\(p_company_id\)/);
    assert.match(guards, /storage\.objects[\s\S]*'storage_not_empty'/);
    assert.match(ownerPurge, /security\s+definer/i);
    assert.match(ownerPurge, /set\s+search_path\s*=\s*''/i);
  });

  test("o fluxo do operador exige autoridade, empresa encerrada, registro, frase e Storage vazio antes do núcleo", () => {
    const guards = operatorPurge.slice(0, operatorPurge.search(/company_purge_execute/));
    const order = [
      /not\s+public\.is_offboarding_operator\(\)[\s\S]*?'not_found'/,
      /for\s+update/,
      /v_deleted_at\s+is\s+null[\s\S]*?'not_closed'/,
      /v_reference\s+is\s+null[\s\S]*?'not_registered'/,
      /is\s+distinct\s+from\s+public\.company_purge_confirmation\(p_company_id\)/,
      /storage\.objects[\s\S]*?'storage_not_empty'/,
    ].map((pattern) => guards.search(pattern));
    assert.ok(order.every((index) => index >= 0), `guards ausentes: ${order}`);
    assert.deepEqual([...order].sort((a, b) => a - b), order, "guards na ordem");
    assert.match(operatorPurge, /security\s+definer/i);
    assert.match(operatorPurge, /set\s+search_path\s*=\s*''/i);
  });
});

describe("Mission 202B — autoridade restrita ao ciclo de vida", () => {
  test("o operador não ganha nenhuma policy de dados: nenhuma policy da 018 toca tabelas de empresa", () => {
    const policies = [...operator.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+([\w.]+)/gi)].map((m) => ({ name: m[1], table: m[2] }));
    assert.deepEqual(policies.map((p) => p.table), ["storage.objects", "storage.objects"]);
    assert.doesNotMatch(operator, /alter\s+policy/i);
  });

  test("Storage: o operador só remove; a leitura vale apenas dentro da remoção em lote", () => {
    const select = operator.match(/create\s+policy\s+"documents_storage_select_offboarding_operator_removal"[\s\S]*?;/i)?.[0];
    const remove = operator.match(/create\s+policy\s+"documents_storage_delete_offboarding_operator"[\s\S]*?;/i)?.[0];
    assert.ok(select && remove);
    assert.match(select, /for\s+select\s+to\s+authenticated/i);
    assert.match(select, /storage\.operation\(\)\s*=\s*'storage\.object\.delete_many'/);
    assert.match(remove, /for\s+delete\s+to\s+authenticated/i);
    for (const policy of [select, remove]) {
      assert.match(policy, /bucket_id\s*=\s*'documents'/);
      assert.match(policy, /\(storage\.foldername\(name\)\)\[1\]\s*=\s*'company'/);
      assert.match(policy, /public\.offboarding_operator_can_remove\(\(storage\.foldername\(name\)\)\[2\]\)/);
    }
    const canRemove = effectiveFunction("offboarding_operator_can_remove");
    assert.match(canRemove, /public\.is_offboarding_operator\(\)/);
    assert.match(canRemove, /c\.deleted_at\s+is\s+not\s+null/);
    assert.match(canRemove, /r\.request_reference\s+is\s+not\s+null/);
  });

  test("a autoridade é verificada no banco por auth.uid() contra uma concessão ativa", () => {
    const check = effectiveFunction("is_offboarding_operator");
    assert.match(check, /o\.user_id\s*=\s*auth\.uid\(\)/);
    assert.match(check, /o\.revoked_at\s+is\s+null/);
    assert.match(check, /security\s+definer/i);
  });

  test("registros de autoridade e de offboarding: RLS sem policy e sem privilégio de cliente", () => {
    for (const table of ["offboarding_operators", "company_offboarding_records"]) {
      assert.match(operator, new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security;`, "i"));
      assert.match(operator, new RegExp(`revoke\\s+all\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+anon,\\s*authenticated;`, "i"));
      assert.doesNotMatch(operator, new RegExp(`create\\s+policy[^;]*on\\s+public\\.${table}`, "i"));
    }
  });

  test("núcleo, contagem interna, concessão e revogação: fora do alcance de qualquer papel de cliente e da service_role", () => {
    for (const signature of ["company_purge_execute\\(uuid\\)", "company_purge_counts\\(uuid\\)", "grant_offboarding_operator\\(uuid, text\\)", "revoke_offboarding_operator\\(uuid, text\\)"]) {
      assert.match(operator, new RegExp(`revoke all on function public\\.${signature} from public, anon, authenticated, service_role;`));
      assert.doesNotMatch(operator, new RegExp(`grant[^;]*public\\.${signature}`));
    }
  });

  test("funções do operador: só authenticated, nunca public/anon", () => {
    for (const signature of [
      "is_offboarding_operator\\(\\)",
      "operator_preview_company_purge\\(uuid\\)",
      "operator_register_offboarding\\(uuid, text, text\\)",
      "offboarding_operator_can_remove\\(text\\)",
      "operator_list_offboarding_storage_objects\\(uuid\\)",
      "operator_purge_closed_company\\(uuid, text\\)",
    ]) {
      assert.match(operator, new RegExp(`revoke all on function public\\.${signature} from public, anon;`));
      assert.match(operator, new RegExp(`grant execute on function public\\.${signature} to authenticated;`));
    }
  });

  test("a prévia do operador não devolve razão social, CNPJ, dono nem conteúdo — só estado, frases e contagens", () => {
    const preview = effectiveFunction("operator_preview_company_purge");
    const returned = preview.slice(preview.search(/return\s+jsonb_build_object\(\s*'found',\s*true/));
    assert.doesNotMatch(returned, /razao_social|cnpj|user_id|nome_original|storage_path|execution\b|diagnosis\b|decision\b/);
    assert.match(returned, /'counts',\s*public\.company_purge_counts\(p_company_id\)/);
  });

  test("o registro do operador nunca reabre nem apaga: só encerra empresa aberta e grava a referência", () => {
    const register = effectiveFunction("operator_register_offboarding");
    assert.doesNotMatch(register, /deleted_at\s*=\s*null|delete\s+from/i);
    assert.match(register, /update\s+public\.companies\s+set\s+deleted_at\s*=\s*now\(\)\s+where\s+id\s*=\s*p_company_id/i);
    assert.match(register, /p_reference\s+!~\s+'\^\[A-Za-z0-9\]/);
    assert.match(register, /public\.company_closure_confirmation\(p_company_id\)/);
  });
});

describe("Mission 202B — auditoria mínima", () => {
  test("o registro de offboarding só tem ids técnicos, instantes, autoridade, referência e contagens", () => {
    const body = operator.match(/create\s+table\s+public\.company_offboarding_records\s*\(([\s\S]*?)\n\);/i)?.[1];
    assert.ok(body);
    const columns = [...body.matchAll(/^\s{4}(\w+)\s+(?:uuid|text|timestamptz|jsonb)/gm)].map((m) => m[1]).sort();
    assert.deepEqual(columns, [
      "closed_at",
      "closed_authority",
      "closed_by",
      "company_id",
      "created_at",
      "purge_authority",
      "purge_result",
      "purged_at",
      "purged_by",
      "request_reference",
      "request_registered_at",
      "request_registered_by",
    ]);
    assert.doesNotMatch(body, /references/i, "sem FK: o registro sobrevive à purga");
  });

  test("referências só no formato do registro privado (sem espaço nem @)", () => {
    const pattern = "'^[A-Za-z0-9][A-Za-z0-9._:/-]{0,63}$'";
    for (const column of ["grant_reference", "revoke_reference", "request_reference"]) {
      assert.ok(operator.includes(`check (${column} ~ ${pattern})`), column);
    }
    assert.ok(effectiveFunction("operator_register_offboarding").includes(`p_reference !~ ${pattern}`), "registro valida a referência");
  });

  test("encerramento registrado automaticamente para o dono; nenhum ON DELETE CASCADE novo", () => {
    assert.match(operator, /after\s+update\s+of\s+deleted_at\s+on\s+public\.companies/i);
    assert.match(operator, /when\s+\(old\.deleted_at\s+is\s+null\s+and\s+new\.deleted_at\s+is\s+not\s+null\)/i);
    assert.doesNotMatch(operator, /on\s+delete\s+cascade/i);
  });
});

describe("Mission 202B — superfície do produto", () => {
  const source = (path: string) => readFileSync(join(ROOT, path), "utf-8");

  test("a página do operador não existe para quem não é operador", () => {
    const page = source("app/(app)/operator/offboarding/page.tsx");
    assert.match(page, /if\s*\(!\(await\s+isOffboardingOperator\(supabase\)\)\)\s*notFound\(\)/);
  });

  test("as portas do operador chamam só as RPCs do operador e nunca usam service_role", () => {
    const service = source("modules/companies/services/operator-offboarding.service.ts");
    const rpcs = [...service.matchAll(/\.rpc\("(\w+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(rpcs, [
      "is_offboarding_operator",
      "operator_list_offboarding_storage_objects",
      "operator_preview_company_purge",
      "operator_purge_closed_company",
      "operator_register_offboarding",
    ]);
    for (const path of [
      "modules/companies/services/operator-offboarding.service.ts",
      "modules/companies/actions/operator-offboarding.actions.ts",
      "modules/companies/services/company-offboarding.service.ts",
    ]) {
      const code = source(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      assert.doesNotMatch(code, /service_role|SERVICE_ROLE/, path);
    }
  });

  test("toda action do operador confere a autoridade no banco antes de agir", () => {
    const actions = source("modules/companies/actions/operator-offboarding.actions.ts");
    const exported = [...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    assert.equal(exported.length, 3);
    assert.equal((actions.match(/await isOffboardingOperator\(supabase\)/g) ?? []).length, 3);
  });
});
