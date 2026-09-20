import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

/**
 * Mission 197 — Production Surface & Deployment Closure Gate, Seção 6/8.
 *
 * STATIC POLICY PROOF — não LIVE RLS EXECUTION PROOF. Este repositório
 * não tem Docker/Supabase CLI disponível neste ambiente (mesma limitação
 * já declarada por toda missão anterior que tocou banco real), então
 * nenhuma policy de RLS é de fato executada contra um Postgres real
 * aqui. O que este arquivo prova, deterministicamente, é que o TEXTO
 * da migration que concede DELETE em `storage.objects` para o bucket
 * `documents` (Migration 015, Mission 197) segue o MESMO modelo de
 * menor privilégio já usado pelas policies de SELECT/INSERT da
 * Migration 004 — nunca uma policy mais ampla (`using (true)`, `for
 * delete to authenticated` sem predicado de empresa, etc.).
 *
 * Prova estática dos quatro itens da Seção 8 que este ambiente consegue
 * verificar sem um Postgres real:
 *   A/B/C — o predicado da policy é sintaticamente idêntico ao já usado
 *           por `documents_storage_select_own`/`documents_storage_insert_own`
 *           (mesmo path→companyId→auth.uid(), nunca uma condição mais
 *           fraca) — a MESMA prova que já sustenta essas duas policies
 *           em produção desde a Migration 004.
 *   D     — `removeStorageObject()` agora verifica `error` e lança,
 *           como toda outra função deste arquivo (prova de código, não
 *           de SQL — ver o teste de leitura de arquivo abaixo).
 */

const MIGRATIONS_DIR = join(__dirname, "..", "..", "supabase", "migrations");

function readMigration(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), "utf-8");
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
}

describe("Mission 197 — Storage DELETE policy (static policy proof, nunca live RLS execution proof)", () => {
  test("Migration 015 concede DELETE em storage.objects para o bucket documents", () => {
    const migration = readMigration("20260920000000_documents_storage_delete_policy.sql");

    assert.match(migration, /for delete/i);
    assert.match(migration, /on storage\.objects/i);
    assert.match(migration, /bucket_id\s*=\s*'documents'/i);
  });

  test("a policy de DELETE usa o MESMO predicado de autoridade de empresa já usado por SELECT/INSERT (Migration 004) — nunca um predicado mais fraco", () => {
    const coreMigration = readMigration("20260719205643_documents_core.sql");
    const deleteMigration = readMigration("20260920000000_documents_storage_delete_policy.sql");

    // Mesmo trecho literal de autoridade usado pelas duas policies já
    // em produção — provar textualmente que a nova policy reaproveita
    // exatamente esta condição, nunca uma paralela divergente.
    const ownershipPredicate =
      "where c.id::text = (storage.foldername(name))[2]\n              and c.user_id = auth.uid()";

    assert.ok(
      coreMigration.includes(ownershipPredicate),
      "pré-condição: o predicado de referência precisa existir em Migration 004 exatamente como esperado"
    );
    assert.ok(
      deleteMigration.includes(ownershipPredicate),
      "a policy de DELETE deve reaproveitar o MESMO predicado de autoridade de empresa (path -> companyId -> auth.uid()) já usado por documents_storage_select_own/documents_storage_insert_own — nunca uma condição nova/mais fraca"
    );
  });

  test("a policy de DELETE só se aplica a objetos ÓRFÃOS — estruturalmente incapaz de apagar os bytes de um documento já aceito/persistido", () => {
    const deleteMigration = readMigration("20260920000000_documents_storage_delete_policy.sql");

    // Segunda condição da policy (AND, nunca OR): nenhuma linha de
    // public.documents pode referenciar o path — preserva o invariante
    // de imutabilidade física já documentado pela Migration 004, mesmo
    // para o próprio dono da empresa chamando a API de Storage direto.
    assert.match(
      deleteMigration,
      /and\s+not\s+exists\s*\(\s*select\s+1\s+from\s+public\.documents\s+d\s+where\s+d\.storage_path\s*=\s*name\s*\)/i,
      "a policy deve negar a remoção de qualquer path que ainda tenha uma linha correspondente em public.documents (aceito ou soft-deleted) — nunca apenas autoridade de empresa isolada"
    );
  });

  test("nenhuma migration concede uma policy de DELETE ampla (using (true) / sem predicado de empresa) em storage.objects", () => {
    const broadPolicyPattern = /for\s+delete[\s\S]{0,200}using\s*\(\s*true\s*\)/i;

    for (const file of migrationFiles()) {
      const content = readMigration(file);
      assert.ok(
        !broadPolicyPattern.test(content),
        `${file} não deve conceder uma policy de DELETE ampla (using (true)) em storage.objects — least privilege é o invariante (Seção 6 da missão)`
      );
    }
  });

  test("Migration 004 documenta a ausência histórica de DELETE, nunca reescrita — apenas superada aditivamente pela Migration 015", () => {
    const coreMigration = readMigration("20260719205643_documents_core.sql");
    // A migration histórica permanece intacta (REGRA: nunca reescrever
    // migration já aplicada) — a ausência de DELETE ali é um fato
    // histórico correto no momento em que foi escrita, superado por uma
    // migration NOVA (015), nunca por edição da 004.
    assert.match(coreMigration, /sem policy de update\/delete/i);
  });
});

describe("Mission 197 — removeStorageObject() observa falhas reais (prova de código, item D da Seção 8)", () => {
  test("document.service.ts verifica `error` e lança, como toda outra função do arquivo — nunca mais um no-op silencioso", () => {
    const servicePath = join(
      __dirname,
      "..",
      "..",
      "modules",
      "documents",
      "services",
      "document.service.ts"
    );
    const source = readFileSync(servicePath, "utf-8");

    const functionMatch = source.match(
      /export async function removeStorageObject\([\s\S]*?\n}/
    );
    assert.ok(functionMatch, "removeStorageObject() deve existir em document.service.ts");

    const functionBody = functionMatch[0];
    assert.match(
      functionBody,
      /if\s*\(\s*error\s*\)\s*throw\s+error/,
      "removeStorageObject() deve verificar `error` e lançar — mesmo padrão de softDeleteDocument()/getSignedDownloadUrl() no mesmo arquivo, nunca descartar o resultado de .remove() silenciosamente"
    );
  });
});
