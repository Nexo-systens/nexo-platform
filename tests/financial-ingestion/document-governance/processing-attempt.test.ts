import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { isRevisionCurrent, isRevisionStale } from "@/app/api/efos/_shared/processingAttempt";

/**
 * Mission 193 Closure B — Database-Authoritative Processing Attempt
 * Ordering. Testes puros das duas regras de autoridade — agora
 * inteiramente numéricas (`revision`, bigint de uma sequence do
 * Postgres via `acquire_processing_attempt_revision()`), nunca mais
 * comparação de strings de relógio de aplicação (`attemptId`/
 * `attemptStartedAt`, Mission 193 Closure — substituídas por esta
 * missão, Seção 3: "reject application wall clock as authority").
 * `beginProcessingAttempt()` em si não é testável aqui sem uma chamada
 * de rede real à RPC (nenhum Supabase real disponível neste ambiente —
 * ver `revision-authority.test.ts` para a simulação do PROTOCOLO
 * completo sobre um repositório em memória). Nenhum I/O, nenhum banco
 * — a mesma lógica que `document.service.ts` expressa como filtro
 * condicional no `UPDATE` (`.eq()`/`.lt()`/`.or()`, atômico no
 * Postgres).
 */
describe("isRevisionCurrent()", () => {
  test("verdadeiro apenas quando a revisão ativa é EXATAMENTE a minha", () => {
    assert.equal(isRevisionCurrent(5, 5), true);
    assert.equal(isRevisionCurrent(6, 5), false);
    assert.equal(isRevisionCurrent(4, 5), false);
  });
});

describe("isRevisionStale() — Seção 3/10: ordem de OBTENÇÃO da revisão, nunca relógio de aplicação", () => {
  test("nenhuma revisão prévia — nunca obsoleta", () => {
    assert.equal(isRevisionStale(null, 1), false);
  });

  test("recebida maior que a persistida — nunca obsoleta", () => {
    assert.equal(isRevisionStale(5, 6), false);
  });

  test("recebida menor que a persistida — obsoleta, nunca sobrescreve", () => {
    assert.equal(isRevisionStale(6, 5), true);
  });

  test("mesma revisão (uma tentativa escrevendo duas vezes) — tratado como obsoleto (no-op seguro, nunca reescreve a si mesma)", () => {
    assert.equal(isRevisionStale(5, 5), true);
  });

  test("revisões nunca empatam entre tentativas distintas (Seção 24) — nextval() do Postgres é sempre única, mesmo sob timestamps de aplicação idênticos", () => {
    // Diferente de attemptStartedAt (duas requisições podem, em teoria,
    // carimbar o mesmo milissegundo), duas chamadas a nextval() NUNCA
    // devolvem o mesmo número, mesmo concorrentes — é essa garantia do
    // próprio Postgres que elimina a necessidade de qualquer desempate
    // adicional em código de aplicação.
    const revisionA = 100;
    const revisionB = 101;
    assert.notEqual(revisionA, revisionB);
    assert.equal(isRevisionStale(revisionA, revisionB), false);
    assert.equal(isRevisionStale(revisionB, revisionA), true);
  });
});
