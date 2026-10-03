import { queryFailure } from "@/lib/supabase/query-error";
import type { ExecutiveReportSummary } from "@/efos/application/report";
import { createClient } from "@/lib/supabase/server";

/**
 * Mission 195 — Founding Company Production Onboarding & First
 * Executive Value, Seção 35/36. Contagem simples de execuções já
 * persistidas de uma empresa (`public.executions`, Migration 006) —
 * o único sinal barato e canônico de "esta empresa já teve uma
 * análise financeira concluída alguma vez", usado por
 * `resolveActivationState()` (`modules/activation/`) para decidir se a
 * empresa já passou da fase de ativação/onboarding para o estado
 * maduro (Seção 39: "a company with existing analyses must NOT be
 * thrown back into onboarding"). Mesmo padrão de `count`/`head: true`
 * já usado por `countDocumentsByCompany`
 * (`modules/documents/services/document.service.ts`) — isolamento por
 * empresa/usuário garantido pelo mesmo RLS de `public.executions`
 * (`executions_select_own`, Migration 006), nenhum filtro manual
 * adicional. Nunca lê o conteúdo de nenhuma execução (`execution`/
 * `report` jsonb) — apenas quantas linhas existem.
 */
export async function countExecutionsByCompany(companyId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error, status } = await supabase
    .from("executions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  if (error) throw queryFailure("countExecutionsByCompany", { error, status });
  return count ?? 0;
}

/**
 * Mission 203 — Visão executiva. Última análise persistida de uma
 * empresa: instante e o `summary` do `ExecutiveReport` (contagens de
 * evidências, interpretações, recomendações e propostas). Lê SÓ esses
 * dois caminhos JSON (`report->summary`, `report->metadata`), nunca o
 * relatório inteiro. `summary` ausente (execução antiga, sem `report`)
 * volta `null` — a UI mostra "indisponível", nunca zero.
 */
export interface LatestAnalysisSummary {
  readonly generatedAt: string;
  readonly summary: ExecutiveReportSummary | null;
}

export async function getLatestAnalysisSummary(companyId: string): Promise<LatestAnalysisSummary | null> {
  const supabase = await createClient();

  const { data, error, status } = await supabase
    .from("executions")
    .select("created_at, summary:report->summary, generatedAt:report->metadata->>generatedAt")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw queryFailure("getLatestAnalysisSummary", { error, status });
  if (!data) return null;

  const row = data as unknown as { created_at: string; summary: unknown; generatedAt: unknown };
  return {
    generatedAt: typeof row.generatedAt === "string" ? row.generatedAt : row.created_at,
    summary: isExecutiveReportSummary(row.summary) ? row.summary : null,
  };
}

export function isExecutiveReportSummary(value: unknown): value is ExecutiveReportSummary {
  if (typeof value !== "object" || value === null) return false;
  const summary = value as Record<string, unknown>;
  return ["indicatorsCount", "evidenceCount", "contextCount", "reasoningCount", "recommendationCount", "decisionCount"].every(
    (key) => typeof summary[key] === "number"
  );
}
