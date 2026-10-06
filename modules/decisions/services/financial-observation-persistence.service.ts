import { createClient } from "@/lib/supabase/server";
import { keepPosteriorObservations, type FinancialOutcomeObservation } from "@/efos/application/financial-observation";
import type { PeriodPositionedExecution } from "@/efos/application/history";
import type { IndicatorsAggregate } from "@/efos/domain";
import { periodOf } from "@/efos/engines/evidence";
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

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Mission 211 (D-136) — período de cada execução citada pelas observações,
 * sob RLS (só execuções que o usuário pode ler), pelo mesmo `periodOf` dos
 * indicadores que a autoridade temporal usa. Leve: só o agregado de
 * indicadores, nunca o snapshot inteiro.
 */
async function positionExecutions(supabase: Client, executionIds: readonly string[]): Promise<PeriodPositionedExecution[]> {
  if (executionIds.length === 0) return [];
  const { data, error } = await supabase
    .from("executions")
    .select("execution_id, company_id, executedAt:metadata->>startedAt, indicators:execution->indicators")
    .in("execution_id", [...executionIds]);
  if (error) throw error;

  const rows = (data ?? []) as unknown as { execution_id: string; company_id: string; executedAt: unknown; indicators: unknown }[];
  return rows.map((row) => {
    const indicators = row.indicators as IndicatorsAggregate | null;
    return {
      executionId: row.execution_id,
      companyId: row.company_id,
      executedAt: typeof row.executedAt === "string" ? row.executedAt : "",
      period: indicators && Array.isArray(indicators.indicators) ? periodOf(indicators) : undefined,
    };
  });
}

/**
 * A ÚNICA porta de leitura de observações financeiras (Central de Decisões,
 * Esperado × Observado, reconciliação, aprendizado, relatório). Mission 211
 * (D-136): devolve só observações de período estritamente posterior à base
 * da decisão, com os dois períodos preenchidos a partir das execuções — uma
 * reanálise do mesmo período, um período anterior ou sobreposto nunca chega
 * a nenhuma superfície como resultado, mesmo que um registro antigo exista.
 */
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
  const observations = (data ?? []).map(toObservation);
  const executionIds = [...new Set(observations.flatMap((observation) => [observation.window.baselineExecutionId, observation.window.observationExecutionId]))];
  return keepPosteriorObservations(observations, await positionExecutions(supabase, executionIds));
}
