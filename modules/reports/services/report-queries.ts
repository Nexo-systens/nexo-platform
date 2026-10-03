import type { SupabaseClient } from "@supabase/supabase-js";

import type { IndicatorsAggregate } from "@/efos/domain";
import { periodOf } from "@/efos/engines/evidence";
import { isUuid } from "@/lib/identifiers";
import { queryFailure } from "@/lib/supabase/query-error";
import { isExecutiveReportSummary } from "@/modules/analysis/services/analysis.service";
import type { Database } from "@/types/database";

import type { ReportEntrySource, ReportIndexCompany } from "../lib/report-index";

/**
 * Mission 208 — leituras do relatório executivo. Recebem o cliente da
 * SESSÃO (nunca `service_role`): o isolamento por empresa é o RLS de
 * `executions`/`executive_diagnoses`/`companies` (D-043), sem filtro
 * manual que pudesse substituí-lo. O cliente é injetado para que a prova
 * local de fronteira entre empresas (`tests/reports-local/`) exercite
 * exatamente estas consultas.
 */
export type ReportClient = SupabaseClient<Database>;

/**
 * Metadados de todas as execuções visíveis à sessão — nunca o relatório
 * inteiro: instante, período canônico (`periodOf` dos indicadores, o mesmo
 * campo que o histórico usa), `summary` e `generatedAt` do relatório.
 */
export async function listReportEntries(client: ReportClient): Promise<ReportEntrySource[]> {
  const { data, error, status } = await client
    .from("executions")
    .select(
      "execution_id, company_id, executedAt:metadata->>startedAt, indicators:execution->indicators, generatedAt:report->metadata->>generatedAt, summary:report->summary"
    );
  if (error) throw queryFailure("listReportEntries", { error, status });

  const rows = (data ?? []) as unknown as {
    execution_id: string;
    company_id: string;
    executedAt: unknown;
    indicators: unknown;
    generatedAt: unknown;
    summary: unknown;
  }[];

  return rows.flatMap((row) => {
    if (typeof row.executedAt !== "string") return [];
    const indicators = row.indicators as IndicatorsAggregate | null;
    const period = indicators && Array.isArray(indicators.indicators) ? periodOf(indicators) : undefined;
    return [
      {
        executionId: row.execution_id,
        companyId: row.company_id,
        executedAt: row.executedAt,
        generatedAt: typeof row.generatedAt === "string" ? row.generatedAt : undefined,
        period,
        summary: isExecutiveReportSummary(row.summary) ? row.summary : undefined,
        hasReport: typeof row.generatedAt === "string",
      },
    ];
  });
}

/** Empresas visíveis à sessão e não encerradas — as que podem ter relatórios abertos. */
export async function listReportCompanies(client: ReportClient): Promise<ReportIndexCompany[]> {
  const { data, error, status } = await client
    .from("companies")
    .select("id, razao_social, status")
    .is("deleted_at", null)
    .order("razao_social", { ascending: true });
  if (error) throw queryFailure("listReportCompanies", { error, status });
  return (data ?? []).map((company) => ({ id: company.id, name: company.razao_social, status: company.status }));
}

/** Quais execuções têm leitura da Executive AI — sem ler o diagnóstico. */
export async function listDiagnosisLinks(
  client: ReportClient
): Promise<{ readonly executionId: string | null; readonly companyId: string }[]> {
  const { data, error, status } = await client.from("executive_diagnoses").select("execution_id, company_id");
  if (error) throw queryFailure("listDiagnosisLinks", { error, status });
  return (data ?? []).map((row) => ({ executionId: row.execution_id, companyId: row.company_id }));
}

/**
 * Empresa dona de um relatório, sob RLS. `null` para id malformado (D-128:
 * nunca chega ao Postgres), inexistente ou de outra empresa — os três casos
 * são indistinguíveis para quem pergunta.
 */
export async function resolveReportCompanyId(client: ReportClient, executionId: string): Promise<string | null> {
  if (!isUuid(executionId)) return null;
  const { data, error, status } = await client
    .from("executions")
    .select("company_id")
    .eq("execution_id", executionId)
    .maybeSingle();
  if (error) throw queryFailure("resolveReportCompanyId", { error, status });
  return data?.company_id ?? null;
}
