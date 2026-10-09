import { isUuid } from "@/lib/identifiers";
import type { Decision } from "@/efos/domain";
import type { PersistedDecision } from "@/modules/decisions/services/decision-persistence.service";

/**
 * Mission 214 — Governed Decision Idempotency (D-137).
 *
 * A mesma intenção de confirmação nunca cria duas Decisions:
 *
 * - mesma chave + mesmo pedido canônico → a mesma Decision, como sucesso
 *   (`REPLAYED`);
 * - mesma chave + outro pedido → recusa (`KEY_REUSED_WITH_DIFFERENT_PAYLOAD`),
 *   nada gravado, nada substituído;
 * - chave diferente → nova intenção legítima, mesmo com conteúdo igual.
 *
 * A idempotência representa a SUBMISSÃO, nunca a semântica da decisão:
 * nada aqui deduplica por texto, empresa, período, recomendação, cenário ou
 * janela de tempo. A chave é uma reivindicação do cliente; sessão, empresa,
 * origem e conteúdo continuam validados pelas ações como antes.
 */

/** Nome do índice único da Migration 019 — contrato: só o 23505 DELE é reenvio. */
export const DECISION_IDEMPOTENCY_INDEX = "decisions_idempotency_key_unique";

export const INVALID_IDEMPOTENCY_KEY_MESSAGE = "Confirmação inválida. Recarregue a página e tente novamente.";
export const IDEMPOTENCY_KEY_REUSED_MESSAGE =
  "Esta confirmação já foi usada para registrar outra decisão. Recarregue a página para ver as decisões registradas.";
/** Exceção no navegador (resposta perdida, rede): reenviar é seguro. */
export const DECISION_SUBMISSION_RETRY_MESSAGE =
  "Não foi possível confirmar o registro. Tente novamente — uma decisão já registrada não será duplicada.";

/** A chave é um UUID textual (D-128); qualquer outra coisa recusa antes do banco. */
export function isIdempotencyKey(value: unknown): value is string {
  return isUuid(value);
}

/**
 * Só a violação do índice de idempotência vira reenvio — mesmo padrão de
 * `isTenantScopedCnpjViolation()` (D-126). Qualquer outro 23505 (por exemplo
 * a chave primária) continua sendo erro.
 */
export function isDecisionIdempotencyViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === "23505" && typeof message === "string" && message.includes(`"${DECISION_IDEMPOTENCY_INDEX}"`);
}

/** O que a confirmação grava junto da Decision. */
export interface DecisionSubmission {
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

/** Uma Decision já gravada com a chave procurada, com a impressão gravada. */
export interface ExistingDecisionSubmission {
  readonly decision: PersistedDecision;
  readonly requestFingerprint: string | null;
}

export type SaveHumanDecisionResult =
  | { readonly outcome: "CREATED"; readonly decision: PersistedDecision }
  | { readonly outcome: "REPLAYED"; readonly decision: PersistedDecision }
  | { readonly outcome: "KEY_REUSED_WITH_DIFFERENT_PAYLOAD" };

/** Mesma impressão: a Decision gravada é a resposta. Outra: recusa. */
export function matchDecisionSubmission(
  existing: ExistingDecisionSubmission,
  requestFingerprint: string
): Extract<SaveHumanDecisionResult, { outcome: "REPLAYED" | "KEY_REUSED_WITH_DIFFERENT_PAYLOAD" }> {
  return existing.requestFingerprint === requestFingerprint
    ? { outcome: "REPLAYED", decision: existing.decision }
    : { outcome: "KEY_REUSED_WITH_DIFFERENT_PAYLOAD" };
}

export type DecisionSubmissionResult<Failure> =
  | SaveHumanDecisionResult
  | { readonly outcome: "REJECTED"; readonly failure: Failure };

export interface DecisionSubmissionSteps<Failure> {
  readonly requestFingerprint: string;
  /** Busca pela chave na própria empresa e no próprio ator, sob RLS. Só lê. */
  readonly findExisting: () => Promise<ExistingDecisionSubmission | undefined>;
  /** Todas as validações de uma intenção NOVA e a composição. Nunca grava. */
  readonly validateAndCompose: () => Promise<
    { readonly ok: true; readonly decision: Decision } | { readonly ok: false; readonly failure: Failure }
  >;
  /** A única gravação (`saveHumanDecision`), que resolve a corrida pelo índice. */
  readonly save: (decision: Decision) => Promise<SaveHumanDecisionResult>;
  /**
   * Recusas que podem ter perdido a corrida para um pedido idêntico já
   * gravado (no cenário: verdade financeira mudou entre os dois). Depois
   * delas a chave é procurada mais uma vez — só leitura.
   */
  readonly recheckAfter?: (failure: Failure) => boolean;
}

/**
 * O fluxo único das duas ações que criam Decision, depois de sessão, formato
 * da chave e empresa (RLS, aberta) — que as ações checam antes:
 *
 * 1. Busca pela chave. Achou: a mesma impressão devolve a Decision gravada
 *    (`REPLAYED`) SEM revalidar o contexto — é o reenvio de um sucesso que já
 *    passou por todas as regras, mesmo que uma análise nova tenha chegado
 *    depois; outra impressão recusa. A busca é atalho, não garantia.
 * 2. Não achou: TODAS as validações de uma intenção nova (diagnóstico,
 *    revisão, recomendação; ou baseline, âncora desatualizada e recomputação).
 *    A idempotência nunca legitima um pedido inválido.
 * 3. Grava. A corrida é decidida pelo índice único: o perdedor relê pela
 *    chave e vira `REPLAYED` (mesma impressão) ou recusa (outra).
 */
export async function submitDecisionOnce<Failure>(steps: DecisionSubmissionSteps<Failure>): Promise<DecisionSubmissionResult<Failure>> {
  const existing = await steps.findExisting();
  if (existing) return matchDecisionSubmission(existing, steps.requestFingerprint);

  const composed = await steps.validateAndCompose();
  if (!composed.ok) {
    if (steps.recheckAfter?.(composed.failure)) {
      const settled = await steps.findExisting();
      if (settled) return matchDecisionSubmission(settled, steps.requestFingerprint);
    }
    return { outcome: "REJECTED", failure: composed.failure };
  }

  return steps.save(composed.decision);
}
