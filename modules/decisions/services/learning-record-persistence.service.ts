import { createClient } from "@/lib/supabase/server";
import type { LearningRecord } from "@/efos/domain";
import type { Database } from "@/types/database";

export type LearningRecordRow = Database["public"]["Tables"]["learning_records"]["Row"];

function toLearningRecord(row: LearningRecordRow): LearningRecord {
  return row.record as unknown as LearningRecord;
}

/**
 * Repositório canônico de `LearningRecord`s derivados (Mission 140,
 * D-072). `derived_by` nunca é aceito como parâmetro vindo do client —
 * sempre resolvido server-side pela Server Action (`getCurrentUser()`)
 * antes de chamar `saveLearningRecord()`.
 *
 * **Imutável após persistido** — nenhuma função de update aqui (mesma
 * disciplina de `saveOutcome()`/`saveFinancialOutcomeObservation()`,
 * Missions 138/139): um aprendizado persistido nunca é recalculado
 * silenciosamente.
 */
export async function saveLearningRecord(
  record: LearningRecord,
  derivedBy: string
): Promise<LearningRecord> {
  if (!record.evidenceClassification) {
    throw new Error("saveLearningRecord() exige LearningRecord.evidenceClassification — nenhum registro sem classificação de evidência é persistido por este repositório.");
  }
  if (record.decisions.length === 0) {
    throw new Error("saveLearningRecord() exige LearningRecord.decisions não vazio — nenhum registro sem Decision de origem é persistido.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("learning_records")
    .insert({
      id: record.id,
      company_id: record.companyId,
      primary_decision_id: record.decisions[0],
      derived_by: derivedBy,
      evidence_classification: record.evidenceClassification,
      record: record as unknown as Database["public"]["Tables"]["learning_records"]["Insert"]["record"],
      derived_at: record.audit.createdAt,
    })
    .select("*")
    .single();

  if (error) throw error;
  return toLearningRecord(data);
}

export async function getLearningRecordsByDecision(
  decisionId: string
): Promise<readonly LearningRecord[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("learning_records")
    .select("*")
    .eq("primary_decision_id", decisionId)
    .order("derived_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toLearningRecord);
}

/**
 * Mission 141 — Knowledge Formation & Cross-Decision Learning.
 * Diferente de `getLearningRecordsByDecision()`: aqui a busca é por
 * `companyId`, não por uma única `Decision` — a formação de
 * `Knowledge` precisa enxergar TODOS os `LearningRecord`s reais da
 * empresa, de todas as `Decision`s independentes, para poder agrupar
 * por `evidenceClassification` (`deriveKnowledgeCandidates()`,
 * `efos/application/knowledge-formation/`).
 */
export async function getLearningRecordsByCompany(
  companyId: string
): Promise<readonly LearningRecord[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("learning_records")
    .select("*")
    .eq("company_id", companyId)
    .order("derived_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toLearningRecord);
}
