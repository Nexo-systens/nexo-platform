import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  isTenantScopedCnpjViolation,
  OWN_DUPLICATE_CNPJ_MESSAGE,
  TENANT_SCOPED_CNPJ_CONSTRAINT,
} from "@/modules/companies/utils/cnpj-uniqueness";

/**
 * Mission 199B Security Closure — CNPJ Cross-Tenant Enumeration (D-126).
 *
 * A matriz adversarial da Mission 199B mostrou que a unicidade GLOBAL
 * de `companies.cnpj` era um oráculo cross-tenant: o índice único do
 * Postgres enxerga linhas de todos os tenants por cima do RLS, então
 * cadastrar/editar a PRÓPRIA empresa com o CNPJ de outro tenant falhava
 * com 23505 e a UI respondia "Já existe uma empresa cadastrada com este
 * CNPJ." — revelando a existência daquele CNPJ em outro tenant.
 *
 * STATIC MIGRATION-CHAIN PROOF + prova de código — não LIVE POSTGRES
 * PROOF. Este repositório não tem Postgres embutível nem Docker em CI
 * (mesma limitação de `migration-chain-dependency-graph.test.ts`); a
 * semântica "mesmo tenant rejeita / tenant diferente permite" é provada
 * sobre a chave de unicidade REAL extraída da cadeia de migrations,
 * aplicada por um modelo explícito de índice único (abaixo) — nunca
 * afirmada como execução de Postgres.
 */

const MIGRATIONS_DIR = join(__dirname, "..", "..", "supabase", "migrations");
const FIX_MIGRATION = "20260926000000_companies_cnpj_tenant_scoped_unique.sql";

function listMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function readMigration(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), "utf-8");
}

function stripSqlComments(sql: string): string {
  return sql.replace(/--.*$/gm, "");
}

/**
 * Chave de unicidade de `public.companies` que envolve `cnpj`, depois de
 * aplicar a cadeia inteira em ordem: a Migration 001 cria a unicidade
 * global (`document text not null unique`, renomeada para `cnpj` na
 * 003); a correção remove toda unicidade de coluna única em `cnpj` e
 * adiciona uma constraint composta. Qualquer migration posterior que
 * recriar `unique (cnpj)` volta a tornar a chave global.
 */
function finalCnpjUniquenessKey(): string[] {
  let key: string[] = [];

  for (const file of listMigrations()) {
    const sql = stripSqlComments(readMigration(file));

    if (/create\s+table\s+public\.companies[\s\S]*?\bdocument\s+text\s+not\s+null\s+unique/i.test(sql)) {
      key = ["cnpj"];
    }

    if (/drop\s+constraint\s+%I/i.test(sql) && /con\.conkey\s*=\s*array\[cnpj_attnum\]/i.test(sql)) {
      key = [];
    }

    for (const match of sql.matchAll(
      /alter\s+table\s+public\.companies\s+add\s+constraint\s+\w+\s+unique\s*\(([^)]+)\)/gi
    )) {
      const columns = match[1].split(",").map((c) => c.trim().toLowerCase());
      if (columns.includes("cnpj")) key = columns;
    }

    if (/create\s+unique\s+index\s+\w+\s+on\s+public\.companies\s*\(\s*cnpj\s*\)/i.test(sql)) {
      key = ["cnpj"];
    }
  }

  return key;
}

type CompanyRow = { id: string; user_id: string; cnpj: string };

/**
 * Modelo explícito de um índice único sobre `key`: duas linhas colidem
 * quando todas as colunas da chave são iguais. É exatamente o que o
 * Postgres avalia — e, como no Postgres, o modelo enxerga TODAS as
 * linhas (nenhum filtro de RLS participa da checagem de unicidade).
 */
function violatesUnique(rows: readonly CompanyRow[], candidate: CompanyRow, key: readonly string[]): boolean {
  return rows.some(
    (row) =>
      row.id !== candidate.id &&
      key.every((column) => row[column as keyof CompanyRow] === candidate[column as keyof CompanyRow])
  );
}

const USER_A = "user-a";
const USER_B = "user-b";
const CNPJ_A = "11222333000181";

describe("Mission 199B Security Closure — unicidade de companies.cnpj escopada ao tenant (D-126)", () => {
  test("a migration de correção existe, é a mais recente da cadeia e nunca edita a Migration 001/003", () => {
    const files = listMigrations();
    assert.ok(files.includes(FIX_MIGRATION), `${FIX_MIGRATION} deve existir`);
    assert.equal(files[files.length - 1], FIX_MIGRATION, "a correção deve ser aditiva, depois de toda migration já aplicada");

    const initial = stripSqlComments(readMigration("20260715151336_initial_schema.sql"));
    assert.match(initial, /\bdocument\s+text\s+not\s+null\s+unique/i, "a Migration 001 permanece intacta (histórico nunca reescrito)");
  });

  test("depois da cadeia inteira, a chave de unicidade que envolve cnpj é (user_id, cnpj) — nunca cnpj sozinho", () => {
    assert.deepEqual(finalCnpjUniquenessKey(), ["user_id", "cnpj"]);
  });

  test("a correção remove a unicidade global pelo catálogo (qualquer nome, só chave exata em cnpj) e nomeia a nova constraint como a aplicação espera", () => {
    const sql = stripSqlComments(readMigration(FIX_MIGRATION));

    assert.match(sql, /con\.contype\s*=\s*'u'/i, "remove constraints UNIQUE");
    assert.match(sql, /con\.conkey\s*=\s*array\[cnpj_attnum\]/i, "somente a chave exata (cnpj) — nunca uma composta");
    assert.match(sql, /i\.indisunique[\s\S]*not\s+i\.indisprimary[\s\S]*i\.indnatts\s*=\s*1/i, "índice único avulso de uma coluna, nunca a PK");
    assert.match(
      sql,
      new RegExp(`add\\s+constraint\\s+${TENANT_SCOPED_CNPJ_CONSTRAINT}\\s+unique\\s*\\(\\s*user_id\\s*,\\s*cnpj\\s*\\)`, "i")
    );
    assert.doesNotMatch(sql, /\b(delete\s+from|truncate|drop\s+table|update\s+public\.)/i, "nunca altera nem apaga dado");
  });

  test("INSERT: mesmo tenant + mesmo CNPJ é rejeitado; tenant diferente + mesmo CNPJ é permitido", () => {
    const key = finalCnpjUniquenessKey();
    const rows: CompanyRow[] = [{ id: "company-a", user_id: USER_A, cnpj: CNPJ_A }];

    assert.equal(
      violatesUnique(rows, { id: "company-a2", user_id: USER_A, cnpj: CNPJ_A }, key),
      true,
      "o mesmo dono nunca tem duas empresas com o mesmo CNPJ"
    );
    assert.equal(
      violatesUnique(rows, { id: "company-b", user_id: USER_B, cnpj: CNPJ_A }, key),
      false,
      "outro dono cadastra o mesmo CNPJ sem colidir — nenhum sinal sobre o tenant A"
    );
  });

  test("UPDATE: mudar para um CNPJ que o próprio dono já usa é rejeitado; para o CNPJ de outro tenant é permitido", () => {
    const key = finalCnpjUniquenessKey();
    const rows: CompanyRow[] = [
      { id: "company-a", user_id: USER_A, cnpj: CNPJ_A },
      { id: "company-b1", user_id: USER_B, cnpj: "99888777000161" },
      { id: "company-b2", user_id: USER_B, cnpj: "55444333000191" },
    ];

    assert.equal(
      violatesUnique(rows, { id: "company-b2", user_id: USER_B, cnpj: "99888777000161" }, key),
      true
    );
    assert.equal(violatesUnique(rows, { id: "company-b2", user_id: USER_B, cnpj: CNPJ_A }, key), false);
  });

  test("a antiga chave global colidiria entre tenants — prova de que o modelo detecta o defeito original", () => {
    const rows: CompanyRow[] = [{ id: "company-a", user_id: USER_A, cnpj: CNPJ_A }];
    assert.equal(violatesUnique(rows, { id: "company-b", user_id: USER_B, cnpj: CNPJ_A }, ["cnpj"]), true);
  });
});

describe("Mission 199B Security Closure — o erro nunca revela a existência de outro tenant", () => {
  test("só a violação da constraint escopada ao dono autoriza a mensagem de CNPJ duplicado", () => {
    assert.equal(
      isTenantScopedCnpjViolation({
        code: "23505",
        message: `duplicate key value violates unique constraint "${TENANT_SCOPED_CNPJ_CONSTRAINT}"`,
      }),
      true
    );
  });

  test("a antiga unicidade global (ambiente ainda sem a Migration 016) nunca produz a mensagem de CNPJ duplicado", () => {
    assert.equal(
      isTenantScopedCnpjViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "companies_document_key"',
      }),
      false
    );
  });

  test("outros erros e valores malformados nunca são tratados como CNPJ duplicado", () => {
    assert.equal(isTenantScopedCnpjViolation({ code: "42501", message: TENANT_SCOPED_CNPJ_CONSTRAINT }), false);
    assert.equal(isTenantScopedCnpjViolation({ code: "23505" }), false);
    assert.equal(isTenantScopedCnpjViolation(null), false);
    assert.equal(isTenantScopedCnpjViolation("23505"), false);
  });

  test("a mensagem fala do PRÓPRIO usuário, nunca da existência do CNPJ na plataforma", () => {
    assert.match(OWN_DUPLICATE_CNPJ_MESSAGE, /^Você já tem uma empresa/);
    assert.doesNotMatch(OWN_DUPLICATE_CNPJ_MESSAGE, /já existe/i);
  });

  test("INSERT e UPDATE de empresa usam o mesmo mapeamento escopado — a mensagem global antiga não existe mais", () => {
    const actions = readFileSync(
      join(__dirname, "..", "..", "modules", "companies", "actions", "company.actions.ts"),
      "utf-8"
    );

    assert.equal(
      actions.match(/isTenantScopedCnpjViolation\(error\)/g)?.length,
      2,
      "createCompanyAction() e updateCompanyAction() devem usar o mapeamento escopado"
    );
    assert.doesNotMatch(actions, /Já existe uma empresa cadastrada com este CNPJ/);
    assert.doesNotMatch(actions, /code\s*===\s*"23505"/, "nenhum mapeamento de 23505 genérico paralelo");
  });
});
