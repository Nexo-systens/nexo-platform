import { createClient } from "@/lib/supabase/server";
import type { FinancialOutcomeObservation } from "@/efos/application/financial-observation";
import type { Database } from "@/types/database";

export type FinancialObservationRow = Database["public"]["Tables"]["financial_observations"]["Row"];

function toObservation(row: FinancialObservationRow): FinancialOutcomeObservation {
  return {
    id: row.id,
    decisionId: row.decision_id,
    companyId: row.company_id,
    humanOutcomeId: row.human_outcome_id ?? undefined,
    computedBy: row.computed_by,
    computedAt: row.computed_at,
    classification: row.classification,
    window: {
      decisionId: row.decision_id,
      baselineExecutionId: row.baseline_execution_id,
      baselineExecutedAt: row.baseline_executed_at,
      observationExecutionId: row.observation_execution_id,
      observationExecutedAt: row.observation_executed_at,
    },
    metrics: row.metrics as unknown as FinancialOutcomeObservation["metrics"],
  };
}

/**
 * Repositório canônico de `FinancialOutcomeObservation` (Mission 139,
 * D-071). `computed_by` nunca é aceito como parâmetro vindo do client
 * — sempre resolvido server-side pela Server Action (`getCurrentUser()`)
 * antes de chamar `saveFinancialOutcomeObservation()`.
 *
 * **Nota sobre `toObservation()`**: `decisionCreatedAt`/
 * `executionCompletedAt` (campos de `ObservationWindow` usados apenas
 * para VALIDAÇÃO no momento da construção, Etapa 5.F) não têm coluna
 * própria na tabela — persistir apenas o que é necessário para
 * reconstituir a observação para exibição (`baselineExecutionId`/
 * `baselineExecutedAt`/`observationExecutionId`/`observationExecutedAt`/
 * `metrics`/`classification`), nunca duplicar dado que já existe em
 * `decisions.created_at`/no histórico de `decision_execution_events`
 * — quem precisar desses dois campos específicos (nenhum consumidor
 * atual precisa) pode relê-los das tabelas de origem pelo
 * `decisionId` já presente.
 *
 * **Imutável após persistida** — nenhuma função de update aqui
 * (Etapa 16 da missão: uma observação congela a Financial Truth
 * comparada no momento do cálculo, nunca recalculada silenciosamente).
 */
export async function saveFinancialOutcomeObservation(
  observation: FinancialOutcomeObservation
): Promise<FinancialOutcomeObservation> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("financial_observations")
    .insert({
      id: observation.id,
      decision_id: observation.decisionId,
      company_id: observation.companyId,
      human_outcome_id: observation.humanOutcomeId ?? null,
      computed_by: observation.computedBy,
      classification: observation.classification,
      baseline_execution_id: observation.window.baselineExecutionId,
      baseline_executed_at: observation.window.baselineExecutedAt,
      observation_execution_id: observation.window.observationExecutionId,
      observation_executed_at: observation.window.observationExecutedAt,
      metrics: observation.metrics as unknown as Database["public"]["Tables"]["financial_observations"]["Insert"]["metrics"],
      computed_at: observation.computedAt,
    })
    .select("*")
    .single();

  if (error) throw error;
  return toObservation(data);
}

export async function getFinancialObservationsByDecision(
  decisionId: string
): Promise<readonly FinancialOutcomeObservation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("financial_observations")
    .select("*")
    .eq("decision_id", decisionId)
    .order("computed_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toObservation);
}
