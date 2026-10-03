import Link from "next/link";

import { CompanyStatusBadge } from "@/modules/companies/components/CompanyStatusBadge";
import { companyWorkspaceHref } from "@/modules/companies/lib/workspace-views";
import { formatDateTime } from "@/modules/dashboard/lib/format";
import type { CompanyStatus } from "@/types/database";

import { capitalize, counted } from "../lib/report-language";
import type { ReportIndexGroup, ReportIndexRow } from "../lib/report-index";

/**
 * Mission 208 — lista de relatórios por empresa. Uma linha por análise: o
 * período é o título (análises são nomeadas pelo período, Mission 204), a
 * data de geração é detalhe. Texto, não selos: "mais recente", "versão
 * anterior", "com leitura da Executive AI".
 */

function rowSummary(row: ReportIndexRow): string | undefined {
  if (!row.summary) return undefined;
  return [
    counted(row.summary.evidenceCount, "evidência", "evidências", "nenhuma evidência"),
    counted(row.summary.recommendationCount, "recomendação", "recomendações", "nenhuma recomendação"),
  ].join(" · ");
}

function ReportRow({ row }: { row: ReportIndexRow }) {
  const title = row.periodLabel ? capitalize(row.periodLabel.long) : "Período não determinado";
  const details = [
    row.version === "earlier" ? "Versão anterior — o período foi analisado de novo" : undefined,
    row.version === "latest" && row.versions > 1 ? `Versão mais recente de ${row.versions} análises do período` : undefined,
    rowSummary(row),
    row.hasAiReading ? "com leitura da Executive AI" : undefined,
  ].filter(Boolean);

  return (
    <li className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {row.hasReport ? (
            <Link
              href={`/reports/${row.executionId}`}
              className="text-[1.0625rem] font-medium tracking-tight text-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              {title}
            </Link>
          ) : (
            <span className="text-[1.0625rem] font-medium tracking-tight text-muted-foreground">{title}</span>
          )}
          {row.isMostRecentPeriod && row.version === "latest" && (
            <span className="type-eyebrow text-primary">Período mais recente</span>
          )}
        </p>
        {details.length > 0 && <p className="type-meta text-pretty">{details.join(" · ")}</p>}
        {!row.hasReport && <p className="type-meta">Esta análise não tem relatório registrado.</p>}
      </div>
      <p className="type-meta num whitespace-nowrap">
        {row.generatedAt ? `Gerado em ${formatDateTime(row.generatedAt)}` : `Analisado em ${formatDateTime(row.executedAt)}`}
      </p>
    </li>
  );
}

export function ReportIndex({ groups }: { groups: readonly ReportIndexGroup[] }) {
  return (
    <div className="flex flex-col gap-12">
      {groups.map((group) => (
        <section key={group.company.id} aria-labelledby={`empresa-${group.company.id}`} className="flex flex-col gap-3">
          <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-border-strong pb-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id={`empresa-${group.company.id}`} className="type-section-title text-balance">
                {group.company.name}
              </h2>
              <p className="type-meta flex flex-wrap items-center gap-x-3 gap-y-1">
                {group.company.status !== "active" && <CompanyStatusBadge status={group.company.status as CompanyStatus} />}
                <span className="num">{counted(group.rows.length, "relatório", "relatórios", "nenhum relatório")}</span>
                {group.latestPeriodLabel && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Período mais recente: {group.latestPeriodLabel.long}</span>
                  </>
                )}
              </p>
            </div>
            <Link
              href={companyWorkspaceHref(group.company.id, "analise")}
              className="text-[0.8125rem] text-foreground-secondary underline-offset-4 hover:text-primary hover:underline"
            >
              Abrir a análise da empresa
            </Link>
          </header>
          <ol className="flex flex-col divide-y divide-border">
            {group.rows.map((row) => (
              <ReportRow key={row.executionId} row={row} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
