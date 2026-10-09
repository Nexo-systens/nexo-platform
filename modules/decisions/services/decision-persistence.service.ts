import type { SupabaseClient } from "@supabase/supabase-js";

import { allUuids } from "@/lib/identifiers";
import { createClient } from "@/lib/supabase/server";
import type { Decision } from "@/efos/domain";
import {
  isDecisionIdempotencyViolation,
  isIdempotencyKey,
  matchDecisionSubmission,
  type DecisionSubmission,
  type ExistingDecisionSubmission,
  type SaveHumanDecisionResult,
} from "@/modules/decisions/lib/decisionIdempotency";
import { isDecisionRequestFingerprint } from "@/modules/decisions/lib/decisionRequestFingerprint";
import type { Database } from "@/types/database";

export type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];

export interface PersistedDecision {
  readonly id: string;
  readonly companyId: string;
  readonly diagnosisId: string | null;
  readonly reviewId: string | null;
  readonly humanActorId: string | null;
  readonly decision: Decision;
  readonly createdAt: string;
}

function toPersisted(row: DecisionRow): PersistedDecision {
  return {
    id: row.id,
    companyId: row.company_id,
    diagnosisId: row.diagnosis_id,
    reviewId: row.review_id,
    humanActorId: row.human_actor_id,
    decision: row.decision as unknown as Decision,
    createdAt: row.created_at,
  };
}

export interface DecisionAuthorizationError {
  readonly code: "REVIEW_NOT_FOUND_IN_COMPANY";
  readonly message: string;
}

const REVIEW_NOT_FOUND: DecisionAuthorizationError = {
  code: "REVIEW_NOT_FOUND_IN_COMPANY",
  message: "A revisão informada não existe ou não pertence a esta empresa.",
};

/**
 * Repositório canônico de `Decision` humana persistida (Mission 126,
 * D-066). Tabela única (`public.decisions`) capaz de representar tanto
 * uma `Decision` determinística (Decision Engine, `human_actor_id`
 * null) quanto uma `Decision` humana (D-064, `human_actor_id` not
 * null) — apenas Decisions humanas são de fato inseridas por esta
 * missão; o Decision Engine determinístico continua sem persistência
 * própria, inalterado (D-011).
 *
 * **Verificação de pertencimento (Etapa 8)**: quando `reviewId` é
 * informado, confirma que a revisão pertence à mesma `companyId` antes
 * de inserir — o RLS reforça a mesma checagem no banco.
 *
 * **Imutável após persistida** — nenhuma função de update aqui; "nunca
 * permitir alteração silenciosa de autoria" (Etapa 10).
 */
export async function verifyReviewBelongsToCompany(
  reviewId: string,
  companyId: string
): Promise<DecisionAuthorizationError | undefined> {
  // Mission 200 (D-128): id malformado nunca vai ao Postgres — mesmo
  // desfecho de um id inexistente ou de outra empresa.
  if (!allUuids(reviewId, companyId)) {
    return REVIEW_NOT_FOUND;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("diagnosis_reviews")
    .select("id")
    .eq("id", reviewId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return REVIEW_NOT_FOUND;
  }
  return undefined;
}

/**
 * Mission 214 (D-137) — a única gravação de Decision humana, agora
 * idempotente. Grava a Decision junto da chave de submissão e da impressão
 * canônica do pedido; quem decide uma corrida é o índice único
 * `decisions_idempotency_key_unique` (empresa + ator + chave), nunca uma
 * leitura anterior:
 *
 * - INSERT ok → `CREATED`;
 * - 23505 DESSE índice → relê pela chave: mesma impressão → `REPLAYED`
 *   (a Decision de quem venceu a corrida); outra → `KEY_REUSED_WITH_DIFFERENT_PAYLOAD`;
 * - qualquer outro erro (inclusive outro 23505) → lança, como antes.
 *
 * `supabase` é opcional: as ações usam a sessão do request
 * (`createClient()`); a prova local injeta a sessão de um usuário real do
 * Auth local. Sempre a sessão do usuário — nunca `service_role`.
 */
export async function saveHumanDecision(
  decision: Decision,
  submission: DecisionSubmission,
  supabase?: SupabaseClient<Database>
): Promise<SaveHumanDecisionResult> {
  if (!decision.humanActorId) {
    throw new Error("saveHumanDecision() exige Decision.humanActorId — nenhuma Decision sem autoria humana é persistida por este repositório.");
  }
  if (!isIdempotencyKey(submission.idempotencyKey) || !isDecisionRequestFingerprint(submission.requestFingerprint)) {
    throw new Error("saveHumanDecision() exige chave de submissão e impressão do pedido válidas (D-137).");
  }

  const client = supabase ?? (await createClient());

  const { data, error } = await client
    .from("decisions")
    .insert({
      id: decision.id,
      company_id: decision.companyId,
      diagnosis_id: decision.basedOnDiagnosisId ?? null,
      review_id: decision.basedOnReviewId ?? null,
      human_actor_id: decision.humanActorId,
      decision: decision as unknown as Database["public"]["Tables"]["decisions"]["Insert"]["decision"],
      idempotency_key: submission.idempotencyKey,
      request_fingerprint: submission.requestFingerprint,
    })
    .select("*")
    .single();

  if (!error) return { outcome: "CREATED", decision: toPersisted(data) };

  if (isDecisionIdempotencyViolation(error)) {
    const existing = await findDecisionBySubmission(decision.companyId, decision.humanActorId, submission.idempotencyKey, client);
    // Conflito sem linha visível na própria empresa/ator: falha fechada.
    if (!existing) throw error;
    return matchDecisionSubmission(existing, submission.requestFingerprint);
  }

  throw error;
}

/**
 * Mission 214 (D-137) — a Decision gravada com esta chave, na PRÓPRIA
 * empresa e pelo PRÓPRIO ator, sob RLS (`decisions_select_own`). Nunca
 * procura a chave fora desse escopo: a mesma chave em outra empresa ou de
 * outro ator é outra intenção e nunca é vista.
 */
export async function findDecisionBySubmission(
  companyId: string,
  humanActorId: string,
  idempotencyKey: string,
  supabase?: SupabaseClient<Database>
): Promise<ExistingDecisionSubmission | undefined> {
  if (!allUuids(companyId, humanActorId) || !isIdempotencyKey(idempotencyKey)) return undefined;

  const client = supabase ?? (await createClient());

  const { data, error } = await client
    .from("decisions")
    .select("*")
    .eq("company_id", companyId)
    .eq("human_actor_id", humanActorId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) throw error;
  return data ? { decision: toPersisted(data), requestFingerprint: data.request_fingerprint } : undefined;
}

export async function getDecisionById(id: string): Promise<PersistedDecision | undefined> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decisions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? toPersisted(data) : undefined;
}

export async function getDecisionsByCompany(
  companyId: string
): Promise<readonly PersistedDecision[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decisions")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toPersisted);
}
