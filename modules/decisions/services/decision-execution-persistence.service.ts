import { createClient } from "@/lib/supabase/server";
import type { DecisionExecutionEvent } from "@/efos/application/decision-execution/DecisionExecutionEvent";
import type { Outcome } from "@/efos/domain";
import type { Database } from "@/types/database";

export type DecisionExecutionEventRow = Database["public"]["Tables"]["decision_execution_events"]["Row"];
export type DecisionOutcomeRow = Database["public"]["Tables"]["decision_outcomes"]["Row"];

function toExecutionEvent(row: DecisionExecutionEventRow): DecisionExecutionEvent {
  return {
    id: row.id,
    decisionId: row.decision_id,
    companyId: row.company_id,
    status: row.status,
    actorId: row.actor_id,
    occurredAt: row.occurred_at,
    targetDate: row.target_date ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function toOutcome(row: DecisionOutcomeRow): Outcome {
  return {
    id: row.id,
    companyId: row.company_id,
    decisionId: row.decision_id,
    status: row.status,
    observedAt: row.observed_at,
    description: row.description,
    expectedResult: row.expected_result ?? undefined,
    recordedBy: row.recorded_by,
    provenance: { source: "human-outcome", confidence: { value: 100, level: "very_high" } },
    audit: { createdAt: row.created_at, updatedAt: row.created_at, version: 1 },
  };
}

/**
 * Repositórios canônicos de `DecisionExecutionEvent`/`Outcome`
 * (Mission 138). `actor_id`/`recorded_by` nunca são aceitos como
 * parâmetro vindo do client — sempre resolvidos server-side pela
 * Server Action (`getCurrentUser()`) antes de chamar `save*()`.
 *
 * **Verificação de pertencimento**: antes de inserir, confirma
 * explicitamente que `decisionId` pertence à `companyId` informada —
 * mesmo padrão de `verifyDiagnosisBelongsToCompany()`/
 * `verifyReviewBelongsToCompany()` (Mission 126/127). O RLS de
 * `public.decision_execution_events`/`public.decision_outcomes`
 * reforça a mesma checagem no banco (defesa em profundidade).
 *
 * **Imutável após persistido** — nenhuma função de update aqui; tanto
 * eventos de execução quanto Outcomes permitem cardinalidade N por
 * Decision (o mais recente é o autoritativo para "estado atual" —
 * `deriveDecisionExecutionState()` para eventos, `created_at desc[0]`
 * para Outcomes).
 */
export interface DecisionExecutionAuthorizationError {
  readonly code: "COMPANY_ACCESS_DENIED" | "DECISION_NOT_FOUND_IN_COMPANY";
  readonly message: string;
}

export async function verifyDecisionBelongsToCompany(
  decisionId: string,
  companyId: string
): Promise<DecisionExecutionAuthorizationError | undefined> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decisions")
    .select("id")
    .eq("id", decisionId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      code: "DECISION_NOT_FOUND_IN_COMPANY",
      message: "A decisão informada não existe ou não pertence a esta empresa.",
    };
  }
  return undefined;
}

export async function saveDecisionExecutionEvent(
  event: DecisionExecutionEvent
): Promise<DecisionExecutionEvent> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decision_execution_events")
    .insert({
      id: event.id,
      decision_id: event.decisionId,
      company_id: event.companyId,
      actor_id: event.actorId,
      status: event.status,
      occurred_at: event.occurredAt,
      target_date: event.targetDate ?? null,
      notes: event.notes ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return toExecutionEvent(data);
}

export async function getDecisionExecutionEventsByDecision(
  decisionId: string
): Promise<readonly DecisionExecutionEvent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decision_execution_events")
    .select("*")
    .eq("decision_id", decisionId)
    .order("occurred_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toExecutionEvent);
}

export async function saveOutcome(outcome: Outcome): Promise<Outcome> {
  if (!outcome.recordedBy) {
    throw new Error("saveOutcome() exige Outcome.recordedBy — nenhum Outcome sem autoria humana é persistido por este repositório.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decision_outcomes")
    .insert({
      id: outcome.id,
      decision_id: outcome.decisionId,
      company_id: outcome.companyId,
      recorded_by: outcome.recordedBy,
      status: outcome.status,
      observed_at: outcome.observedAt,
      description: outcome.description,
      expected_result: outcome.expectedResult ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return toOutcome(data);
}

export async function getOutcomesByDecision(decisionId: string): Promise<readonly Outcome[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decision_outcomes")
    .select("*")
    .eq("decision_id", decisionId)
    .order("observed_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toOutcome);
}
