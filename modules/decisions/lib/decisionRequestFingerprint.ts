import { createHash } from "node:crypto";

import { NonCanonicalValueError, canonicalJson } from "./decisionRequest";

/**
 * Mission 214 — Governed Decision Idempotency (D-137).
 *
 * Impressão canônica e VERSIONADA de um pedido de decisão, calculada só no
 * servidor e gravada em `decisions.request_fingerprint` junto da chave de
 * submissão:
 *
 *   "decision-request:v1:" + SHA-256( JSON canônico de
 *     { format, entrypoint, companyId, humanActorId, payload } )
 *
 * - `entrypoint`: qual ação recebeu o pedido — a mesma chave nunca serve a
 *   duas ações diferentes;
 * - `companyId`/`humanActorId`: empresa (já autorizada sob RLS) e ator da
 *   sessão — nunca do cliente;
 * - `payload`: o pedido canônico (`decisionRequest.ts`).
 *
 * O formato fica gravado na própria impressão (e o banco só aceita
 * `decision-request:v<n>:<64 hex>`): mudar a canonicalização exige uma nova
 * versão, nunca reinterpretar a v1 em silêncio.
 */

export const DECISION_REQUEST_FINGERPRINT_FORMAT = "decision-request:v1";

export type DecisionRequestEntrypoint = "human-decision" | "scenario-decision";

export interface DecisionRequestScope {
  readonly entrypoint: DecisionRequestEntrypoint;
  readonly companyId: string;
  readonly humanActorId: string;
}

const STORED_FINGERPRINT = /^decision-request:v[1-9][0-9]*:[0-9a-f]{64}$/;

/** Mesmo formato do check `decisions_request_fingerprint_format_check` (Migration 019). */
export function isDecisionRequestFingerprint(value: unknown): value is string {
  return typeof value === "string" && STORED_FINGERPRINT.test(value);
}

/**
 * Devolve a impressão, ou `undefined` quando o pedido tem algum valor fora do
 * JSON canônico (o chamador recusa o pedido como inválido). Nunca lança por
 * causa do conteúdo do pedido.
 */
export function deriveDecisionRequestFingerprint(scope: DecisionRequestScope, payload: unknown): string | undefined {
  let canonical: string;
  try {
    canonical = canonicalJson({
      format: DECISION_REQUEST_FINGERPRINT_FORMAT,
      entrypoint: scope.entrypoint,
      companyId: scope.companyId,
      humanActorId: scope.humanActorId,
      payload,
    });
  } catch (error) {
    if (error instanceof NonCanonicalValueError) return undefined;
    throw error;
  }
  return `${DECISION_REQUEST_FINGERPRINT_FORMAT}:${createHash("sha256").update(canonical).digest("hex")}`;
}
