import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

/**
 * Mission 199P Closure A — Fresh-Database Migration Chain
 * Reconstruction.
 *
 * STATIC DEPENDENCY-GRAPH PROOF — não LIVE POSTGRES-IN-CI PROOF. Este
 * ambiente não tem Docker disponível (confirmado, `command -v docker`
 * vazio), e `supabase start` (stack local completo — Postgres+Auth+
 * Storage) nunca foi exercitado nem verificado nesta sessão. A prova
 * AO VIVO real de que a cadeia inteira aplica limpa contra um banco
 * genuinamente vazio é o próprio provisionamento do NEXO Pillot
 * (Mission 199P/Closure A, `docs/ENGINEERING_LOG.md`) — este arquivo
 * existe para detectar, permanentemente e sem infraestrutura nenhuma,
 * a MESMA CLASSE de defeito que bloqueou aquele provisionamento antes
 * que ela volte a acontecer.
 *
 * Técnica: reconstrói, a partir do texto puro de cada migration (na
 * ordem cronológica do nome do arquivo — a mesma ordem que
 * `supabase db push` usa), o conjunto de tabelas `public.*` criadas
 * até cada ponto da cadeia, e confere que toda tabela referenciada por
 * `ALTER TABLE`/`CREATE POLICY ... ON`/`CREATE TRIGGER ... ON` já foi
 * criada por uma migration ANTERIOR (ou pela mesma). Uma tabela
 * referenciada sem nunca ter sido criada por nenhuma migration
 * (exatamente o defeito real de `financial_metrics`, encontrado por
 * esta mesma técnica aplicada manualmente durante a Mission 199P
 * Closure A) faz este teste falhar.
 *
 * Não é "apenas um grep" — é uma reconstrução determinística do grafo
 * de dependências entre migrations, ordenada, cumulativa, e capaz de
 * distinguir "criada antes" de "nunca criada".
 */

const MIGRATIONS_DIR = join(__dirname, "..", "..", "supabase", "migrations");

function migrationFilesInOrder(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // nomes de arquivo começam com timestamp — ordem lexicográfica == ordem cronológica.
}

function readMigration(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), "utf-8");
}

/**
 * Tabelas criadas INCONDICIONALMENTE por este arquivo
 * (`create table public.<nome>`, fora de qualquer bloco `do $$ ...
 * end $$` condicional — mesma exclusão de `tablesReferencedBy()`,
 * abaixo. Uma tabela só criada condicionalmente não deveria ser
 * tratada como garantidamente disponível para migrations futuras
 * dependerem sem seu próprio guard).
 */
function tablesCreatedBy(sql: string): string[] {
  const unguarded = stripGuardedDoBlocks(sql);
  const matches = [...unguarded.matchAll(/create\s+table\s+public\.([a-z_][a-z0-9_]*)/gi)];
  return matches.map((m) => m[1].toLowerCase());
}

/**
 * Remove o CONTEÚDO de blocos `do $$ ... end $$;` (anônimos, sem tag
 * de dollar-quoting customizada) antes da varredura — um statement
 * DDL dentro de um `EXECUTE '...'` guardado por `IF EXISTS (...) THEN`
 * (o mesmo padrão introduzido por esta Closure para
 * `financial_metrics`) é, por construção, condicional — nunca falha
 * contra um banco vazio, então nunca deve ser tratado como a mesma
 * classe de dependência incondicional que este teste procura. A
 * segunda descrição deste arquivo (abaixo) verifica especificamente
 * que o guard em si existe e cobre o caso certo — as duas checagens
 * juntas cobrem tanto "nada incondicional" quanto "o condicional é
 * genuíno".
 */
function stripGuardedDoBlocks(sql: string): string {
  return sql.replace(/do\s+\$\$[\s\S]*?end\s+\$\$\s*;/gi, "");
}

/**
 * Tabelas `public.*` referenciadas por este arquivo via `ALTER TABLE`,
 * `CREATE POLICY ... ON`, ou `CREATE TRIGGER ... ON` — os três
 * comandos que exigem a tabela já existir. Exclui a própria tabela
 * sendo criada NESTE arquivo (uma migration pode legitimamente criar
 * uma tabela e, na sequência, alterá-la/criar policy nela) e qualquer
 * referência apenas dentro de um bloco `do $$ ... end $$` condicional.
 */
function tablesReferencedBy(sql: string): string[] {
  const unguarded = stripGuardedDoBlocks(sql);
  const alterMatches = [...unguarded.matchAll(/alter\s+table\s+public\.([a-z_][a-z0-9_]*)/gi)];
  const policyMatches = [...unguarded.matchAll(/create\s+policy\s+"[^"]*"\s+on\s+public\.([a-z_][a-z0-9_]*)/gi)];
  const triggerMatches = [...unguarded.matchAll(/create\s+trigger\s+[a-z_][a-z0-9_]*\s+(?:before|after)\s+\w+\s+on\s+public\.([a-z_][a-z0-9_]*)/gi)];

  const all = [...alterMatches, ...policyMatches, ...triggerMatches].map((m) => m[1].toLowerCase());
  return [...new Set(all)];
}

describe("Mission 199P Closure A — grafo de dependências da cadeia de migrations (fresh-database reproducibility)", () => {
  test("toda tabela public.* referenciada por ALTER/POLICY/TRIGGER foi criada por alguma migration anterior ou pela mesma — nunca uma dependência manual/externa", () => {
    const files = migrationFilesInOrder();
    assert.ok(files.length > 0, "deve haver ao menos uma migration para auditar");

    const createdSoFar = new Set<string>();
    const violations: string[] = [];

    for (const file of files) {
      const sql = readMigration(file);
      const referenced = tablesReferencedBy(sql);
      const createdHere = tablesCreatedBy(sql);

      // Uma referência é válida se a tabela já existe de uma migration
      // anterior OU se está sendo criada neste mesmo arquivo (ordem de
      // aparição dentro do arquivo não é verificada aqui — só a
      // granularidade de arquivo, suficiente para capturar o defeito
      // real já encontrado).
      const availableNow = new Set([...createdSoFar, ...createdHere]);

      for (const table of referenced) {
        if (!availableNow.has(table)) {
          violations.push(
            `${file}: referencia public.${table} (via ALTER/POLICY/TRIGGER) mas nenhuma migration até este ponto da cadeia a criou`
          );
        }
      }

      for (const table of createdHere) {
        createdSoFar.add(table);
      }
    }

    assert.deepEqual(
      violations,
      [],
      `Dependência manual/externa encontrada — uma migration assume uma tabela que nenhuma migration cria (mesma classe de defeito que bloqueou o provisionamento do NEXO Pillot, Mission 199P):\n${violations.join("\n")}`
    );
  });

  test("Migration 005 não referencia mais public.financial_metrics fora de um bloco condicional (regressão específica desta Closure)", () => {
    const migration005 = readMigration("20260721141609_security_advisor_cleanup.sql");

    // A tabela pode continuar sendo MENCIONADA (comentários, texto do
    // guard) — o que não pode mais existir é um `alter table`/`create
    // policy`/`create trigger` INCONDICIONAL sobre ela fora de um `do
    // $$ ... if exists (...) then ... end if; end $$;`.
    assert.match(
      migration005,
      /do\s+\$\$[\s\S]*financial_metrics[\s\S]*end\s+\$\$/i,
      "os statements dependentes de financial_metrics devem estar dentro de um bloco DO condicional"
    );

    const unconditionalPattern =
      /^(alter table public\.financial_metrics|create policy "financial_metrics_|create trigger set_financial_metrics_)/im;
    assert.ok(
      !unconditionalPattern.test(migration005),
      "nenhum statement dependente de financial_metrics pode existir fora do bloco condicional (início de linha, nunca dentro de uma string EXECUTE indentada)"
    );
  });

  test("public.financial_metrics permanece deliberadamente nunca criada por nenhuma migration (LEGACY_DEAD, nunca recriar schema morto)", () => {
    const files = migrationFilesInOrder();
    const allCreatedTables = files.flatMap((f) => tablesCreatedBy(readMigration(f)));

    assert.ok(
      !allCreatedTables.includes("financial_metrics"),
      "financial_metrics classificada LEGACY_DEAD (Mission 199P Closure A) — nenhuma migration deve voltar a criá-la sem uma nova decisão arquitetural explícita"
    );
  });
});
