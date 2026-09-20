import { createClient } from "@/lib/supabase/server";
import type { KnowledgeEvaluationResult } from "@/efos/application/knowledge-evaluation";
import type { TimestampedKnowledgeEvaluation } from "@/efos/application/knowledge-lifecycle";
import type { Database } from "@/types/database";

export type KnowledgeEvaluationRow = Database["public"]["Tables"]["knowledge_evaluations"]["Row"];

/**
 * Mission 146 — Knowledge Lifecycle & Historical Intelligence Maturity.
 * Estende `TimestampedKnowledgeEvaluation` (Application Layer,
 * `efos/application/knowledge-lifecycle/KnowledgeState.ts`) com o
 * único campo genuinamente de infraestrutura — `asOf` (o corte
 * temporal usado NAQUELA chamada de `evaluateKnowledgeAgainstLearning()`,
 * irrelevante para `deriveKnowledgeState()`, útil só para auditoria de
 * como a avaliação foi produzida). `id`/`evaluatedAt` já vêm do tipo
 * base — nunca duplicados aqui.
 */
export interface PersistedKnowledgeEvaluation extends TimestampedKnowledgeEvaluation {
  readonly asOf?: string;
}

function toPersistedKnowledgeEvaluation(row: KnowledgeEvaluationRow): PersistedKnowledgeEvaluation {
  return {
    ...(row.record as unknown as KnowledgeEvaluationResult),
    id: row.id,
    evaluatedAt: row.evaluated_at,
    asOf: row.as_of ?? undefined,
  };
}

/**
 * Repositório canônico de `KnowledgeEvaluationResult` persistido
 * (Mission 145, D-077). `evaluated_by` nunca é aceito como parâmetro
 * vindo do client — sempre resolvido server-side pela Server Action
 * (`getCurrentUser()`) antes de chamar `saveKnowledgeEvaluation()`.
 *
 * **Imutável após persistido** — nenhuma função de update aqui (mesma
 * disciplina de `saveKnowledge()`/`saveLearningRecord()`).
 * **Nunca deduplicado** — diferente de `saveKnowledge()` (D-073, `id`
 * determinístico + tratamento de colisão `23505`), cada avaliação é
 * um evento histórico distinto (mesmo padrão de
 * `saveFinancialOutcomeObservation()`, D-071, Opção B) — reavaliar o
 * mesmo `Knowledge` mais tarde é sempre uma observação legítima nova,
 * nunca uma duplicata a ser reconhecida/descartada.
 */
export async function saveKnowledgeEvaluation(
  result: KnowledgeEvaluationResult,
  companyId: string,
  evaluatedBy: string,
  evaluatedAt: string,
  asOf?: string
): Promise<PersistedKnowledgeEvaluation> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("knowledge_evaluations")
    .insert({
      company_id: companyId,
      knowledge_id: result.knowledgeId,
      evaluated_by: evaluatedBy,
      outcome: result.outcome,
      supporting_learning_record_ids: result.supporting.map((r) => r.id),
      contradicting_learning_record_ids: result.contradicting.map((r) => r.id),
      insufficient_learning_record_ids: result.insufficient.map((r) => r.id),
      record: result as unknown as Database["public"]["Tables"]["knowledge_evaluations"]["Insert"]["record"],
      as_of: asOf ?? null,
      evaluated_at: evaluatedAt,
    })
    .select("*")
    .single();

  if (error) throw error;
  return toPersistedKnowledgeEvaluation(data);
}

export async function getKnowledgeEvaluationsByCompany(
  companyId: string
): Promise<readonly PersistedKnowledgeEvaluation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("knowledge_evaluations")
    .select("*")
    .eq("company_id", companyId)
    .order("evaluated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toPersistedKnowledgeEvaluation);
}

/**
 * Mission 146 — todas as avaliações reais de UM `Knowledge` específico
 * (não escopado por `companyId` apenas — por `knowledgeId` exato),
 * ordenadas por `evaluated_at desc`. Insumo direto de
 * `deriveKnowledgeState()` (`efos/application/knowledge-lifecycle/`).
 */
export async function getKnowledgeEvaluationsByKnowledge(
  knowledgeId: string
): Promise<readonly PersistedKnowledgeEvaluation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("knowledge_evaluations")
    .select("*")
    .eq("knowledge_id", knowledgeId)
    .order("evaluated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toPersistedKnowledgeEvaluation);
}

/**
 * A avaliação mais recente de cada `Knowledge` (por `knowledge_id`),
 * de uma empresa — conveniência de leitura para a UI (Mission 145,
 * Etapa 11: "exibir a evolução do Knowledge no contexto executivo
 * correto"). Nunca recalcula nada — apenas escolhe, por
 * `evaluated_at desc` (já a ordenação de `getKnowledgeEvaluationsByCompany()`),
 * a primeira ocorrência de cada `knowledgeId`.
 */
export async function getLatestKnowledgeEvaluationsByCompany(
  companyId: string
): Promise<ReadonlyMap<string, PersistedKnowledgeEvaluation>> {
  const all = await getKnowledgeEvaluationsByCompany(companyId);
  const latest = new Map<string, PersistedKnowledgeEvaluation>();
  for (const evaluation of all) {
    if (!latest.has(evaluation.knowledgeId)) {
      latest.set(evaluation.knowledgeId, evaluation);
    }
  }
  return latest;
}

/**
 * Mission 146 — todas as avaliações de uma empresa, agrupadas por
 * `knowledgeId` — conveniência para `KnowledgeSection.tsx` computar
 * `deriveKnowledgeState()` de CADA `Knowledge` sem N chamadas
 * separadas ao banco (1 única query, agrupamento em memória).
 */
export async function getKnowledgeEvaluationsGroupedByKnowledge(
  companyId: string
): Promise<ReadonlyMap<string, readonly PersistedKnowledgeEvaluation[]>> {
  const all = await getKnowledgeEvaluationsByCompany(companyId);
  const grouped = new Map<string, PersistedKnowledgeEvaluation[]>();
  for (const evaluation of all) {
    const existing = grouped.get(evaluation.knowledgeId);
    if (existing) {
      existing.push(evaluation);
    } else {
      grouped.set(evaluation.knowledgeId, [evaluation]);
    }
  }
  return grouped;
}
