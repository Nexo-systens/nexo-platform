import { createClient } from "@/lib/supabase/server";
import type { Knowledge } from "@/efos/domain";
import type { Database } from "@/types/database";

export type KnowledgeRow = Database["public"]["Tables"]["knowledge_records"]["Row"];

function toKnowledge(row: KnowledgeRow): Knowledge {
  return row.record as unknown as Knowledge;
}

/**
 * Repositório canônico de `Knowledge` formado (Mission 141, D-073).
 * `formed_by` nunca é aceito como parâmetro vindo do client — sempre
 * resolvido server-side pela Server Action (`getCurrentUser()`) antes
 * de chamar `saveKnowledge()`.
 *
 * **Imutável após persistido** — nenhuma função de update aqui (mesma
 * disciplina de `saveLearningRecord()`/`saveFinancialOutcomeObservation()`,
 * Missions 139/140).
 *
 * **Idempotência (Etapa 10 da missão)**: `knowledge.id` já chega
 * deterministicamente derivado (`deriveKnowledgeId()`,
 * `efos/application/knowledge-formation/`) — reexecutar a formação com
 * o mesmo conjunto de `LearningRecord`s produz o mesmo `id`. Uma
 * colisão de `insert` (erro Postgres `23505`, unique violation na
 * chave primária) é tratada explicitamente aqui como "já existe":
 * a linha já persistida é relida e devolvida, nunca duplicada e nunca
 * tratada como um erro real.
 */
export async function saveKnowledge(knowledge: Knowledge, formedBy: string): Promise<Knowledge> {
  if (!knowledge.derivedFromLearningRecordIds || knowledge.derivedFromLearningRecordIds.length === 0) {
    throw new Error("saveKnowledge() exige Knowledge.derivedFromLearningRecordIds não vazio — nenhum Knowledge sem origem rastreável é persistido por este repositório.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("knowledge_records")
    .insert({
      id: knowledge.id,
      company_id: knowledge.companyId,
      formed_by: formedBy,
      category: knowledge.category,
      derived_from_learning_record_ids: [...knowledge.derivedFromLearningRecordIds],
      derived_from_outcome_ids: [...knowledge.derivedFromOutcomeIds],
      record: knowledge as unknown as Database["public"]["Tables"]["knowledge_records"]["Insert"]["record"],
      formed_at: knowledge.audit.createdAt,
    })
    .select("*")
    .single();

  if (!error) return toKnowledge(data);

  if (error.code === "23505") {
    const { data: existing, error: readError } = await supabase
      .from("knowledge_records")
      .select("*")
      .eq("id", knowledge.id)
      .single();
    if (readError) throw readError;
    return toKnowledge(existing);
  }

  throw error;
}

export async function getKnowledgeByCompany(companyId: string): Promise<readonly Knowledge[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("knowledge_records")
    .select("*")
    .eq("company_id", companyId)
    .order("formed_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toKnowledge);
}
