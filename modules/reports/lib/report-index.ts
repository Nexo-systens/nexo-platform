import { compareHistoricalExecutionOrder, latestPeriodAmong, periodVersionAmong } from "@/efos/application/history";
import type { ExecutiveReportSummary } from "@/efos/application/report";
import { periodsEqual } from "@/efos/application/scenario-simulation";
import type { Period } from "@/efos/domain";
import { formatPeriodLabel, type PeriodLabel } from "@/modules/analysis/lib/period-label";

/**
 * Mission 208 — índice de relatórios executivos (`/reports`).
 *
 * Cada linha é uma execução persistida da empresa: o `ExecutiveReport`
 * dela é o relatório (D-038, imutável). O índice só lê metadados — período
 * canônico (`periodOf` dos indicadores da execução), instantes, o `summary`
 * do relatório e se existe leitura da Executive AI ligada à execução.
 * Nenhum relatório é criado, gerado ou alterado aqui. Função pura.
 */

export interface ReportEntrySource {
  readonly executionId: string;
  readonly companyId: string;
  /** `metadata.startedAt` — o mesmo `executedAt` do histórico canônico. */
  readonly executedAt: string;
  readonly generatedAt?: string;
  readonly period?: Period;
  readonly summary?: ExecutiveReportSummary;
  readonly hasReport: boolean;
}

export interface ReportIndexCompany {
  readonly id: string;
  readonly name: string;
  readonly status: string;
}

export interface ReportIndexRow {
  readonly executionId: string;
  readonly period?: Period;
  readonly periodLabel?: PeriodLabel;
  readonly executedAt: string;
  readonly generatedAt?: string;
  /** `latest`: versão mais recente do período; `earlier`: o período foi reanalisado depois. */
  readonly version: "latest" | "earlier" | "unpositioned";
  readonly versions: number;
  readonly isMostRecentPeriod: boolean;
  readonly hasAiReading: boolean;
  readonly hasReport: boolean;
  readonly summary?: ExecutiveReportSummary;
}

export interface ReportIndexGroup {
  readonly company: ReportIndexCompany;
  readonly rows: readonly ReportIndexRow[];
  readonly latestPeriodLabel?: PeriodLabel;
}

export interface ReportIndexInputs {
  readonly companies: readonly ReportIndexCompany[];
  readonly entries: readonly ReportEntrySource[];
  /** Execuções que têm leitura da Executive AI (`executive_diagnoses.execution_id`). */
  readonly diagnosisLinks: readonly { readonly executionId: string | null; readonly companyId: string }[];
}

function newestPeriodFirst(a: ReportEntrySource, b: ReportEntrySource): number {
  if (a.period && b.period) {
    const byStart = b.period.startDate.localeCompare(a.period.startDate);
    if (byStart !== 0) return byStart;
    const byEnd = b.period.endDate.localeCompare(a.period.endDate);
    if (byEnd !== 0) return byEnd;
  } else if (a.period || b.period) {
    return a.period ? -1 : 1;
  }
  // Mesmo período (ou nenhum): a versão mais recente primeiro, na ordem canônica.
  return compareHistoricalExecutionOrder(b, a);
}

export function buildReportIndex(inputs: ReportIndexInputs): readonly ReportIndexGroup[] {
  return inputs.companies.flatMap((company) => {
    const entries = inputs.entries
      .filter((entry) => entry.companyId === company.id)
      .sort(compareHistoricalExecutionOrder);
    if (entries.length === 0) return [];

    const withAi = new Set(
      inputs.diagnosisLinks
        .filter((link) => link.companyId === company.id && link.executionId)
        .map((link) => link.executionId as string)
    );
    // Mission 209 (D-134): versão e período mais recente pela autoridade temporal, sobre os metadados.
    const mostRecentPeriod = latestPeriodAmong(entries);

    const rows: ReportIndexRow[] = [...entries].sort(newestPeriodFirst).map((entry) => {
      if (!entry.period) {
        return {
          executionId: entry.executionId,
          executedAt: entry.executedAt,
          generatedAt: entry.generatedAt,
          version: "unpositioned",
          versions: 1,
          isMostRecentPeriod: false,
          hasAiReading: withAi.has(entry.executionId),
          hasReport: entry.hasReport,
          summary: entry.summary,
        };
      }
      const period = entry.period;
      const version = periodVersionAmong(entries, entry);
      return {
        executionId: entry.executionId,
        period,
        periodLabel: formatPeriodLabel(period),
        executedAt: entry.executedAt,
        generatedAt: entry.generatedAt,
        version: version.state === "earlier" ? "earlier" : "latest",
        versions: version.state === "unpositioned" ? 1 : version.versions,
        isMostRecentPeriod: mostRecentPeriod !== undefined && periodsEqual(period, mostRecentPeriod),
        hasAiReading: withAi.has(entry.executionId),
        hasReport: entry.hasReport,
        summary: entry.summary,
      };
    });

    return [{ company, rows, latestPeriodLabel: mostRecentPeriod ? formatPeriodLabel(mostRecentPeriod) : undefined }];
  });
}
