import { createClient } from "@/lib/supabase/server";
import type { Decision } from "@/efos/domain";
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("diagnosis_reviews")
    .select("id")
    .eq("id", reviewId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      code: "REVIEW_NOT_FOUND_IN_COMPANY",
      message: "A revisão informada não existe ou não pertence a esta empresa.",
    };
  }
  return undefined;
}

export async function saveHumanDecision(decision: Decision): Promise<PersistedDecision> {
  if (!decision.humanActorId) {
    throw new Error("saveHumanDecision() exige Decision.humanActorId — nenhuma Decision sem autoria humana é persistida por este repositório.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decisions")
    .insert({
      id: decision.id,
      company_id: decision.companyId,
      diagnosis_id: decision.basedOnDiagnosisId ?? null,
      review_id: decision.basedOnReviewId ?? null,
      human_actor_id: decision.humanActorId,
      decision: decision as unknown as Database["public"]["Tables"]["decisions"]["Insert"]["decision"],
    })
    .select("*")
    .single();

  if (error) throw error;
  return toPersisted(data);
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
