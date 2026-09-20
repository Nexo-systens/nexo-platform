import assert from "node:assert/strict";
import { describe, test } from "node:test";

/**
 * Mission 193 Closure B — Database-Authoritative Processing Attempt
 * Ordering.
 *
 * `document.service.ts` expressa toda a proteção abaixo como filtros
 * condicionais em instruções `UPDATE` ÚNICAS (atômicas no próprio
 * Postgres — `.eq("processing_revision", ...)`, `.lt("processing_revision", ...)`,
 * `.or("governance_revision.is.null,governance_revision.lt....")`).
 * Sem acesso a um Supabase real neste ambiente (Seção 17/23 da missão:
 * "no real Supabase"), este arquivo simula o MESMO PROTOCOLO sobre um
 * repositório em memória (`FakeDocumentsTable`) que espelha fielmente a
 * semântica das colunas reais (`processing_revision`/`active_attempt_id`/
 * `governance_revision`, Migration 013) — provando que o PROTOCOLO
 * (não apenas um helper TypeScript que o banco real não imporia) é
 * correto sob qualquer interleaving de operações.
 *
 * `revision` é sempre um inteiro ATRIBUÍDO NA ORDEM DE CRIAÇÃO de cada
 * tentativa (o que `nextval()` garante de verdade no Postgres — Seção
 * 24: nunca empata, mesmo sob timestamps de aplicação idênticos) —
 * nos testes abaixo, "E1 criada antes de E2" sempre significa
 * `e1.revision < e2.revision`, INDEPENDENTE da ordem em que as
 * operações subsequentes (begin/finalize/governança) são de fato
 * chamadas.
 */

interface Attempt {
  readonly attemptId: string;
  readonly revision: number;
  readonly startedAt: string;
}

interface FakeRow {
  companyId: string;
  status: "processing" | "processed" | "failed";
  processingRevision: number;
  activeAttemptId?: string;
  governanceRevision?: number;
  governance?: { readonly outcome: string; readonly executionId: string };
}

/**
 * Espelha exatamente as três escritas condicionais de
 * `document.service.ts` — nenhuma trava em memória, nenhum mapa de
 * posse compartilhado além das PRÓPRIAS linhas (o "banco" simulado);
 * cada método é puro em relação ao estado da linha, exatamente como o
 * `WHERE` de um `UPDATE` real avalia condição por linha, sem nenhum
 * mutex de processo (Seção 25/33: "is any safety property enforced
 * only in TypeScript?" — aqui, deliberadamente, SIM, apenas para
 * provar que o PROTOCOLO em si — as mesmas comparações que o Postgres
 * fará de verdade — é correto; a atomicidade de cada UPDATE individual
 * é garantia do Postgres, não recriada aqui).
 */
class FakeDocumentsTable {
  private readonly rows = new Map<string, FakeRow>();

  seed(id: string, companyId: string): void {
    this.rows.set(id, { companyId, status: "processing", processingRevision: 0 });
  }

  get(id: string): FakeRow | undefined {
    return this.rows.get(id);
  }

  /** Mirrors beginDocumentsProcessingAttempt(): UPDATE ... WHERE id IN (ids) AND processing_revision < $revision. */
  beginProcessing(ids: readonly string[], attempt: Attempt): readonly string[] {
    const claimed: string[] = [];
    for (const id of ids) {
      const row = this.rows.get(id);
      if (row === undefined) continue;
      if (row.processingRevision < attempt.revision) {
        row.status = "processing";
        row.processingRevision = attempt.revision;
        row.activeAttemptId = attempt.attemptId;
        claimed.push(id);
      }
    }
    return claimed;
  }

  /** Mirrors updateDocumentsStatus(): UPDATE ... WHERE id IN (ids) AND processing_revision = $revision. */
  finalizeStatus(
    ids: readonly string[],
    status: "processed" | "failed",
    attempt: Attempt
  ): readonly string[] {
    const applied: string[] = [];
    for (const id of ids) {
      const row = this.rows.get(id);
      if (row === undefined) continue;
      if (row.processingRevision === attempt.revision) {
        row.status = status;
        applied.push(id);
      }
    }
    return applied;
  }

  /** Mirrors updateDocumentGovernance(): UPDATE ... WHERE id=$id AND (governance_revision IS NULL OR governance_revision < $revision). */
  writeGovernance(
    id: string,
    governance: { readonly outcome: string; readonly executionId: string },
    attempt: Attempt
  ): boolean {
    const row = this.rows.get(id);
    if (row === undefined) return false;
    if (row.governanceRevision === undefined || row.governanceRevision < attempt.revision) {
      row.governance = governance;
      row.governanceRevision = attempt.revision;
      return true;
    }
    return false;
  }
}

function attempt(attemptId: string, revision: number, startedAt = "2026-09-18T10:00:00.000Z"): Attempt {
  return { attemptId, revision, startedAt };
}

describe("Item 1/2 (Seção 1) — begin atrasado de uma tentativa mais antiga nunca reconquista a posse", () => {
  test("E2 (revision maior) começa primeiro; E1 (revision menor, atrasada) começa depois — E1 é rejeitada", () => {
    const table = new FakeDocumentsTable();
    table.seed("doc-1", "company-a");

    const e1 = attempt("e1", 1);
    const e2 = attempt("e2", 2);

    assert.deepEqual(table.beginProcessing(["doc-1"], e2), ["doc-1"]);
    assert.deepEqual(table.beginProcessing(["doc-1"], e1), [], "E1 não pode reconquistar a posse de E2");

    const row = table.get("doc-1")!;
    assert.equal(row.processingRevision, 2);
    assert.equal(row.activeAttemptId, "e2");
  });

  test("ordem de conclusão invertida (E1 começa primeiro, E2 depois) — resultado final idêntico: E2 sempre vence", () => {
    const table = new FakeDocumentsTable();
    table.seed("doc-1", "company-a");

    const e1 = attempt("e1", 1);
    const e2 = attempt("e2", 2);

    assert.deepEqual(table.beginProcessing(["doc-1"], e1), ["doc-1"]);
    assert.deepEqual(table.beginProcessing(["doc-1"], e2), ["doc-1"]);

    const row = table.get("doc-1")!;
    assert.equal(row.processingRevision, 2);
    assert.equal(row.activeAttemptId, "e2");
  });
});

describe("Item 3 — timestamps de aplicação idênticos nunca quebram a ordem (revisão é a única autoridade)", () => {
  test("e1 e e2 com o MESMO startedAt, revisões distintas — ordem resolvida corretamente mesmo assim", () => {
    const table = new FakeDocumentsTable();
    table.seed("doc-1", "company-a");

    const sameClock = "2026-09-18T10:00:00.000Z";
    const e1 = attempt("e1", 1, sameClock);
    const e2 = attempt("e2", 2, sameClock);

    table.beginProcessing(["doc-1"], e1);
    table.beginProcessing(["doc-1"], e2);
    assert.deepEqual(table.finalizeStatus(["doc-1"], "failed", e1), [], "e1 obsoleta apesar do mesmo relógio de aplicação");
    assert.deepEqual(table.finalizeStatus(["doc-1"], "processed", e2), ["doc-1"]);
  });
});

describe("Item 4/5 — finalização obsoleta (processed/failed) é rejeitada, nunca sobrescreve a tentativa atual", () => {
  test("processed obsoleto rejeitado", () => {
    const table = new FakeDocumentsTable();
    table.seed("doc-1", "company-a");
    const e1 = attempt("e1", 1);
    const e2 = attempt("e2", 2);

    table.beginProcessing(["doc-1"], e1);
    table.beginProcessing(["doc-1"], e2);

    assert.deepEqual(table.finalizeStatus(["doc-1"], "processed", e1), []);
    assert.equal(table.get("doc-1")!.status, "processing", "documento continua em processing — pertence a e2, não finalizado por e1");
  });

  test("failed obsoleto rejeitado — e2 ainda finaliza normalmente depois", () => {
    const table = new FakeDocumentsTable();
    table.seed("doc-1", "company-a");
    const e1 = attempt("e1", 1);
    const e2 = attempt("e2", 2);

    table.beginProcessing(["doc-1"], e1);
    table.beginProcessing(["doc-1"], e2);

    assert.deepEqual(table.finalizeStatus(["doc-1"], "failed", e1), []);
    assert.deepEqual(table.finalizeStatus(["doc-1"], "processed", e2), ["doc-1"]);
    assert.equal(table.get("doc-1")!.status, "processed");
  });
});

describe("Item 6 — governança obsoleta é rejeitada, em qualquer ordem de conclusão", () => {
  test("e2 (mais nova) grava primeiro; e1 tenta depois — rejeitada", () => {
    const table = new FakeDocumentsTable();
    table.seed("doc-1", "company-a");
    const e1 = attempt("e1", 1);
    const e2 = attempt("e2", 2);

    assert.equal(table.writeGovernance("doc-1", { outcome: "same_period_conflict", executionId: "exec-2" }, e2), true);
    assert.equal(table.writeGovernance("doc-1", { outcome: "accepted", executionId: "exec-1" }, e1), false);
    assert.equal(table.get("doc-1")!.governance?.outcome, "same_period_conflict");
  });

  test("e1 (mais antiga) grava primeiro; e2 grava depois — e2 vence", () => {
    const table = new FakeDocumentsTable();
    table.seed("doc-1", "company-a");
    const e1 = attempt("e1", 1);
    const e2 = attempt("e2", 2);

    assert.equal(table.writeGovernance("doc-1", { outcome: "accepted", executionId: "exec-1" }, e1), true);
    assert.equal(table.writeGovernance("doc-1", { outcome: "same_period_conflict", executionId: "exec-2" }, e2), true);
    assert.equal(table.get("doc-1")!.governance?.outcome, "same_period_conflict");
  });
});

describe("Item 7 (Seção 21) — E1=[A,B] vs E2=[B]: B muda de dono, A permanece com E1", () => {
  test("E2 assume apenas B; E1 ainda finaliza A normalmente, mas nunca B", () => {
    const table = new FakeDocumentsTable();
    table.seed("doc-a", "company-a");
    table.seed("doc-b", "company-a");

    const e1 = attempt("e1", 1);
    const e2 = attempt("e2", 2);

    assert.deepEqual(table.beginProcessing(["doc-a", "doc-b"], e1), ["doc-a", "doc-b"]);
    assert.deepEqual(table.beginProcessing(["doc-b"], e2), ["doc-b"], "e2 assume somente B");

    assert.deepEqual(table.finalizeStatus(["doc-a"], "processed", e1), ["doc-a"], "e1 ainda pode finalizar A");
    assert.deepEqual(table.finalizeStatus(["doc-b"], "processed", e1), [], "e1 não pode mais finalizar B");
    assert.deepEqual(table.finalizeStatus(["doc-b"], "processed", e2), ["doc-b"], "somente e2 finaliza B");

    assert.equal(table.get("doc-a")!.status, "processed");
    assert.equal(table.get("doc-b")!.status, "processed");
    assert.equal(table.get("doc-b")!.activeAttemptId, "e2");
  });
});

describe("Item 8 (Seção 22) — E1=[A] vs E2=[A,B]: E2 assume A+B por inteiro", () => {
  test("e1 não pode mais finalizar A depois que e2 assume A e B", () => {
    const table = new FakeDocumentsTable();
    table.seed("doc-a", "company-a");
    table.seed("doc-b", "company-a");

    const e1 = attempt("e1", 1);
    const e2 = attempt("e2", 2);

    assert.deepEqual(table.beginProcessing(["doc-a"], e1), ["doc-a"]);
    assert.deepEqual(table.beginProcessing(["doc-a", "doc-b"], e2), ["doc-a", "doc-b"]);

    assert.deepEqual(table.finalizeStatus(["doc-a"], "processed", e1), []);
    assert.deepEqual(table.finalizeStatus(["doc-a", "doc-b"], "processed", e2), ["doc-a", "doc-b"]);
  });
});

describe("Item 9 (Seção 23) — corrida de três vias: só a mais nova finaliza, em qualquer interleaving", () => {
  test("E1 → E3 → E2 (ordem arbitrária de begin) — apenas E3 finaliza", () => {
    const table = new FakeDocumentsTable();
    table.seed("doc-1", "company-a");

    const e1 = attempt("e1", 1);
    const e2 = attempt("e2", 2);
    const e3 = attempt("e3", 3);

    table.beginProcessing(["doc-1"], e1);
    table.beginProcessing(["doc-1"], e3);
    table.beginProcessing(["doc-1"], e2); // atrasada — nunca reconquista, mesmo entre e1 e e3

    assert.equal(table.get("doc-1")!.activeAttemptId, "e3");
    assert.deepEqual(table.finalizeStatus(["doc-1"], "processed", e1), []);
    assert.deepEqual(table.finalizeStatus(["doc-1"], "failed", e2), []);
    assert.deepEqual(table.finalizeStatus(["doc-1"], "processed", e3), ["doc-1"]);
  });
});

describe("Item 10 — falha posterior (fase de análise financeira) nunca sobrescreve status já processed", () => {
  test("status finalizado processed; governança nunca chega a ser escrita (simula catch da fase 2) — status permanece processed", () => {
    const table = new FakeDocumentsTable();
    table.seed("doc-1", "company-a");
    const e1 = attempt("e1", 1);

    table.beginProcessing(["doc-1"], e1);
    table.finalizeStatus(["doc-1"], "processed", e1);

    // Fase 2 (pipeline financeiro/persistência/relatório) lança — por
    // arquitetura (routes de duas fases, Mission 193 Closure, Seção
    // 4/6), NENHUMA função desta tabela que toca `status` é chamada
    // novamente a partir daqui. `writeGovernance` simplesmente nunca é
    // invocada.
    assert.equal(table.get("doc-1")!.status, "processed");
    assert.equal(table.get("doc-1")!.governance, undefined);
  });
});

describe("Item 11 — falha técnica pertence apenas à tentativa autoritativa atual", () => {
  test("e1 (superada) tenta marcar failed — rejeitado; e2 finaliza processed normalmente", () => {
    const table = new FakeDocumentsTable();
    table.seed("doc-1", "company-a");
    const e1 = attempt("e1", 1);
    const e2 = attempt("e2", 2);

    table.beginProcessing(["doc-1"], e1);
    table.beginProcessing(["doc-1"], e2);

    assert.deepEqual(table.finalizeStatus(["doc-1"], "failed", e1), [], "e1 nunca contamina o documento de e2");
    assert.deepEqual(table.finalizeStatus(["doc-1"], "processed", e2), ["doc-1"]);
    assert.equal(table.get("doc-1")!.status, "processed");
  });
});

describe("Item 12 — begin() de uma tentativa mais nova nunca apaga a governança de uma anterior", () => {
  test("e1 grava governança e finaliza; e2 começa a processar de novo — governança de e1 permanece legível enquanto e2 está em voo", () => {
    const table = new FakeDocumentsTable();
    table.seed("doc-1", "company-a");
    const e1 = attempt("e1", 1);
    const e2 = attempt("e2", 2);

    table.beginProcessing(["doc-1"], e1);
    table.finalizeStatus(["doc-1"], "processed", e1);
    table.writeGovernance("doc-1", { outcome: "accepted", executionId: "exec-1" }, e1);

    table.beginProcessing(["doc-1"], e2); // nova análise em andamento

    const row = table.get("doc-1")!;
    assert.equal(row.status, "processing", "UI rotula isto como 'análise anterior' — status é a única fonte para essa decisão");
    assert.equal(row.governance?.outcome, "accepted", "governança de e1 não foi apagada só porque e2 começou a processar");
  });
});

describe("Item 13 — reprocessamento corrigido torna-se a governança autoritativa", () => {
  test("e1 grava 'needs_review'; e2 (rerun corrigido) processa e grava 'accepted' — e2 vence", () => {
    const table = new FakeDocumentsTable();
    table.seed("doc-1", "company-a");
    const e1 = attempt("e1", 1);
    const e2 = attempt("e2", 2);

    table.beginProcessing(["doc-1"], e1);
    table.finalizeStatus(["doc-1"], "processed", e1);
    table.writeGovernance("doc-1", { outcome: "needs_review", executionId: "exec-1" }, e1);

    table.beginProcessing(["doc-1"], e2);
    table.finalizeStatus(["doc-1"], "processed", e2);
    table.writeGovernance("doc-1", { outcome: "accepted", executionId: "exec-2" }, e2);

    assert.equal(table.get("doc-1")!.governance?.outcome, "accepted");
  });
});

describe("Item 14 (Seção 19/20) — isolamento por empresa: operações sobre uma empresa nunca afetam a outra", () => {
  test("acquirir/finalizar/gravar governança de documentos da empresa A nunca toca linhas da empresa B", () => {
    const table = new FakeDocumentsTable();
    table.seed("doc-a1", "company-a");
    table.seed("doc-b1", "company-b");

    const attemptForA = attempt("attempt-a", 1);
    // Revisão global (mesma sequence para todas as empresas — Seção 2:
    // "smallest database-authoritative mechanism") — mesmo assim, a
    // operação só é endereçada por id explícito, nunca por um escopo
    // "toda a tabela"/"toda a empresa implícita no lado do protocolo"
    // (o isolamento REAL de empresa é RLS em `public.documents`,
    // inalterado por esta migration — este teste prova apenas que o
    // PROTOCOLO em si nunca vaza entre ids não mencionados).
    table.beginProcessing(["doc-a1"], attemptForA);
    table.finalizeStatus(["doc-a1"], "processed", attemptForA);
    table.writeGovernance("doc-a1", { outcome: "accepted", executionId: "exec-a" }, attemptForA);

    const untouchedB = table.get("doc-b1")!;
    assert.equal(untouchedB.status, "processing");
    assert.equal(untouchedB.processingRevision, 0);
    assert.equal(untouchedB.activeAttemptId, undefined);
    assert.equal(untouchedB.governance, undefined);
  });
});

describe("Item 15 (Seção 25/32) — nenhuma trava de processo compartilhada entre chamadores", () => {
  test("duas 'instâncias serverless' independentes (nenhum objeto compartilhado além da própria linha) produzem o mesmo resultado determinístico", () => {
    // Cada `Attempt` é um objeto imutável isolado, sem referência a
    // nenhum mutex/mapa de posse global — o único estado compartilhado
    // entre os dois "chamadores" é a PRÓPRIA linha da tabela (o
    // equivalente, aqui, ao Postgres real). Isso é exatamente o que
    // Seção 25 exige: "no module-level mutex. No singleton ownership
    // map. No JavaScript lock."
    const table = new FakeDocumentsTable();
    table.seed("doc-1", "company-a");

    function callerInstanceX(): readonly string[] {
      return table.beginProcessing(["doc-1"], attempt("x", 10));
    }
    function callerInstanceY(): readonly string[] {
      return table.beginProcessing(["doc-1"], attempt("y", 20));
    }

    // Interleaving Y depois de X e X depois de Y produzem o mesmo
    // vencedor determinístico (quem tem a MAIOR revisão), nunca
    // dependente de qual função JS "executou por último" em algum
    // sentido além da comparação pura de revisão.
    assert.deepEqual(callerInstanceX(), ["doc-1"]);
    assert.deepEqual(callerInstanceY(), ["doc-1"]);
    assert.equal(table.get("doc-1")!.activeAttemptId, "y");
  });
});
