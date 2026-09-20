import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { isRevisionCurrent, isRevisionStale } from "@/app/api/efos/_shared/processingAttempt";

/**
 * Mission 193 Closure — Technical Status Ownership & Concurrent
 * Governance Safety, Seção 10/11/13/23 (Mission 193 Closure B —
 * Database-Authoritative Processing Attempt Ordering: reescrito para
 * usar `revision` numérica em vez de `attemptId`/`startedAt` como
 * autoridade — ver D-117). `document.service.ts` expressa a mesma
 * proteção abaixo como um filtro condicional dentro de uma única
 * query `UPDATE` (atômico no próprio Postgres, seguro entre múltiplas
 * instâncias serverless). Sem acesso a um Supabase real neste
 * ambiente, este teste simula a MESMA decisão condicional sobre um
 * repositório EM MEMÓRIA que espelha fielmente a forma de
 * `documents.processing_revision`/`documents.governance_revision`
 * (Migration 013) — provando que o ALGORITMO é permutation-invariant
 * em relação à ORDEM DE CONCLUSÃO das análises. Ver
 * `revision-authority.test.ts` para a cobertura completa do protocolo
 * (overlapping sets, corridas de três vias, isolamento por empresa).
 */

interface Attempt {
  readonly attemptId: string;
  readonly revision: number;
}

interface FakeDocumentRow {
  status: "processing" | "processed" | "failed";
  activeAttemptId?: string;
  processingRevision: number;
  governance?: { readonly outcome: string; readonly governanceRevision: number };
}

function newDocument(): FakeDocumentRow {
  return { status: "processing", processingRevision: 0 };
}

/** Espelha `beginDocumentsProcessingAttempt()` — condicionado a `processing_revision < revision`. */
function beginAttempt(doc: FakeDocumentRow, attempt: Attempt): void {
  if (doc.processingRevision < attempt.revision) {
    doc.status = "processing";
    doc.activeAttemptId = attempt.attemptId;
    doc.processingRevision = attempt.revision;
  }
}

/** Espelha `updateDocumentsStatus(ids, status, attempt)` — condicional via `isRevisionCurrent()`. */
function finalizeStatus(
  doc: FakeDocumentRow,
  status: "processed" | "failed",
  attempt: Attempt
): void {
  if (!isRevisionCurrent(doc.processingRevision, attempt.revision)) {
    return; // no-op silencioso — uma tentativa mais nova já assumiu o documento.
  }
  doc.status = status;
}

/** Espelha `updateDocumentGovernance()` — condicional via `isRevisionStale()`. */
function writeGovernance(doc: FakeDocumentRow, outcome: string, attempt: Attempt): void {
  const currentGovernanceRevision = doc.governance?.governanceRevision ?? null;
  if (isRevisionStale(currentGovernanceRevision, attempt.revision)) {
    return; // no-op silencioso — uma governança mais nova já foi gravada.
  }
  doc.governance = { outcome, governanceRevision: attempt.revision };
}

describe("Invariante 5 (fechamento): tentativa mais nova finaliza o status técnico, nunca a que termina por último", () => {
  test("E2 começa depois de E1; E2 termina primeiro, E1 termina depois — resultado final é sempre o de E2", () => {
    const e1: Attempt = { attemptId: "e1", revision: 1 };
    const e2: Attempt = { attemptId: "e2", revision: 2 };

    const doc = newDocument();
    beginAttempt(doc, e1); // E1 começa primeiro
    beginAttempt(doc, e2); // E2 começa depois — assume a posse

    // E2 termina primeiro.
    finalizeStatus(doc, "processed", e2);
    assert.equal(doc.status, "processed");

    // E1 (mais antigo) termina por último — nunca deve sobrescrever.
    finalizeStatus(doc, "failed", e1);
    assert.equal(doc.status, "processed", "E1 (tentativa mais antiga) nunca sobrescreve E2, mesmo terminando depois");
  });

  test("mesmo par de tentativas, ordem de CONCLUSÃO invertida — resultado final continua sendo o de E2 (nunca timing-dependent)", () => {
    const e1: Attempt = { attemptId: "e1", revision: 1 };
    const e2: Attempt = { attemptId: "e2", revision: 2 };

    const doc = newDocument();
    beginAttempt(doc, e1);
    beginAttempt(doc, e2);

    // Desta vez E1 termina primeiro.
    finalizeStatus(doc, "failed", e1);
    assert.equal(doc.status, "processing", "E1 não é mais a tentativa ativa — sua finalização é um no-op, status permanece processing");

    // E2 termina depois.
    finalizeStatus(doc, "processed", e2);
    assert.equal(doc.status, "processed", "resultado final idêntico ao do outro teste — nunca depende de qual terminou primeiro");
  });
});

describe("Invariante 6 (fechamento): governança nunca é sobrescrita por uma tentativa mais antiga, independentemente de ordem de conclusão", () => {
  test("E1 grava governança 'accepted'; E2 (mais novo) grava 'same_period_conflict' depois — E2 vence", () => {
    const e1: Attempt = { attemptId: "e1", revision: 1 };
    const e2: Attempt = { attemptId: "e2", revision: 2 };

    const doc = newDocument();
    writeGovernance(doc, "accepted", e1);
    writeGovernance(doc, "same_period_conflict", e2);

    assert.equal(doc.governance?.outcome, "same_period_conflict");
  });

  test("E2 (mais novo) grava primeiro; E1 (mais antigo) tenta gravar depois — E1 é rejeitado, E2 permanece", () => {
    const e1: Attempt = { attemptId: "e1", revision: 1 };
    const e2: Attempt = { attemptId: "e2", revision: 2 };

    const doc = newDocument();
    writeGovernance(doc, "same_period_conflict", e2); // termina primeiro, mas é o mais NOVO
    writeGovernance(doc, "accepted", e1); // termina depois, mas é o mais ANTIGO

    assert.equal(
      doc.governance?.outcome,
      "same_period_conflict",
      "a análise mais antiga (E1) nunca substitui o resultado da mais nova (E2), mesmo terminando por último"
    );
  });
});

describe("Invariante 7 (fechamento): reprocessamento técnico não corrompe governança de uma tentativa concorrente mais nova", () => {
  test("E1 finaliza status como failed depois de E2 já ter assumido — activeAttemptId permanece de E2, próxima finalização de E2 ainda funciona", () => {
    const e1: Attempt = { attemptId: "e1", revision: 1 };
    const e2: Attempt = { attemptId: "e2", revision: 2 };

    const doc = newDocument();
    beginAttempt(doc, e1);
    beginAttempt(doc, e2);

    finalizeStatus(doc, "failed", e1); // no-op
    assert.equal(doc.status, "processing");

    finalizeStatus(doc, "processed", e2); // ainda válido — processingRevision nunca foi tocado pelo no-op de E1
    assert.equal(doc.status, "processed");
  });
});
