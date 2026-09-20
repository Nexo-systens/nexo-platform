import { createClient } from "@/lib/supabase/server";
import type { DiagnosisReview } from "@/efos/application/diagnosis-review/DiagnosisReview";
import type { Database } from "@/types/database";

export type DiagnosisReviewRow = Database["public"]["Tables"]["diagnosis_reviews"]["Row"];

export interface PersistedDiagnosisReview {
  readonly id: string;
  readonly diagnosisId: string;
  readonly companyId: string;
  readonly reviewerUserId: string;
  readonly review: DiagnosisReview;
  readonly createdAt: string;
}

function toPersisted(row: DiagnosisReviewRow): PersistedDiagnosisReview {
  return {
    id: row.id,
    diagnosisId: row.diagnosis_id,
    companyId: row.company_id,
    reviewerUserId: row.reviewer_user_id,
    review: row.review as unknown as DiagnosisReview,
    createdAt: row.created_at,
  };
}

/**
 * Repositório canônico de `DiagnosisReview` (Mission 126, D-066).
 * `reviewer_user_id` nunca é aceito como parâmetro vindo do client —
 * `saveDiagnosisReview()` exige o id já resolvido server-side (D-065,
 * `getCurrentUser()`, chamado pela Server Action antes desta função).
 *
 * **Verificação de pertencimento (Etapa 8 da missão)**: antes de
 * inserir, confirma explicitamente que o `diagnosisId` informado
 * pertence à `companyId` informada — nunca confia que os dois ids,
 * sozinhos, sejam consistentes só porque vieram juntos numa mesma
 * chamada. O RLS de `public.diagnosis_reviews` reforça a mesma
 * checagem no banco (defesa em profundidade), mas esta função nunca
 * depende só do RLS para produzir uma mensagem de erro clara.
 *
 * **Imutável após persistido** — nenhuma função de update aqui;
 * múltiplas revisões por diagnóstico são permitidas (cardinalidade N),
 * a mais recente (`createdAt`) é a autoritativa para qualquer
 * consumidor — nenhuma revisão anterior é fisicamente alterada.
 */
export interface DiagnosisReviewAuthorizationError {
  readonly code: "COMPANY_ACCESS_DENIED" | "DIAGNOSIS_NOT_FOUND_IN_COMPANY";
  readonly message: string;
}

export async function verifyDiagnosisBelongsToCompany(
  diagnosisId: string,
  companyId: string
): Promise<DiagnosisReviewAuthorizationError | undefined> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("executive_diagnoses")
    .select("id")
    .eq("id", diagnosisId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      code: "DIAGNOSIS_NOT_FOUND_IN_COMPANY",
      message: "O diagnóstico informado não existe ou não pertence a esta empresa.",
    };
  }
  return undefined;
}

export async function saveDiagnosisReview(
  review: DiagnosisReview,
  companyId: string,
  reviewerUserId: string
): Promise<PersistedDiagnosisReview> {
  if (review.status === "PENDING") {
    throw new Error('DiagnosisReview com status "PENDING" nunca é persistido — representa ausência de revisão (D-063).');
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("diagnosis_reviews")
    .insert({
      id: review.id,
      diagnosis_id: review.diagnosisId,
      company_id: companyId,
      reviewer_user_id: reviewerUserId,
      status: review.status,
      review: review as unknown as Database["public"]["Tables"]["diagnosis_reviews"]["Insert"]["review"],
    })
    .select("*")
    .single();

  if (error) throw error;
  return toPersisted(data);
}

export async function getDiagnosisReviewById(
  id: string
): Promise<PersistedDiagnosisReview | undefined> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("diagnosis_reviews")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? toPersisted(data) : undefined;
}

export async function getDiagnosisReviewsByDiagnosis(
  diagnosisId: string
): Promise<readonly PersistedDiagnosisReview[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("diagnosis_reviews")
    .select("*")
    .eq("diagnosis_id", diagnosisId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toPersisted);
}
