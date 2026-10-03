import { BookOpenText, Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { companyWorkspaceHref } from "@/modules/companies/lib/workspace-views";
import { ReportIndex } from "@/modules/reports/components/ReportIndex";
import { counted } from "@/modules/reports/lib/report-language";
import { loadReportIndex } from "@/modules/reports/services/report.service";

export const metadata: Metadata = { title: "Relatórios — NEXO" };

type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Mission 208 — índice de relatórios executivos. Não há botão "gerar
 * relatório": cada análise concluída já gravou o relatório do seu período
 * (`ExecutiveReport`, D-038), imutável. Esta página só lista o que existe;
 * para um relatório novo, a empresa executa uma nova análise.
 * `?empresa=<id>` restringe a uma empresa (vindo do workspace dela).
 */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = await searchParams;
  const companyFilter = Array.isArray(params.empresa) ? params.empresa[0] : params.empresa;
  const { groups, companiesWithoutReports } = await loadReportIndex();
  const filtered = companyFilter ? groups.filter((group) => group.company.id === companyFilter) : groups;
  const reportsCount = filtered.reduce((total, group) => total + group.rows.length, 0);
  const pendingCompanies = companyFilter ? [] : companiesWithoutReports;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Relatórios"
        title="Relatórios executivos"
        description="Cada análise concluída gera o relatório do período analisado: o que o EFOS sabia naquele momento, com as decisões que nasceram dele. Depois de gerado, o relatório não muda — uma nova análise gera um novo."
        meta={
          filtered.length > 0 ? (
            <>
              <span className="num">{counted(reportsCount, "relatório", "relatórios", "nenhum relatório")}</span>
              <span aria-hidden="true">·</span>
              <span className="num">{counted(filtered.length, "empresa", "empresas", "nenhuma empresa")}</span>
            </>
          ) : undefined
        }
        actions={
          companyFilter && filtered.length > 0 ? (
            <Button variant="outline" render={<Link href="/reports" />} nativeButton={false}>
              Todos os relatórios
            </Button>
          ) : undefined
        }
      />

      {filtered.length > 0 ? (
        <ReportIndex groups={filtered} />
      ) : groups.length === 0 && companiesWithoutReports.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma empresa cadastrada"
          description="Relatórios nascem das análises de uma empresa. Cadastre a empresa, envie os demonstrativos e execute a análise."
          action={
            <Button variant="outline" render={<Link href="/companies" />} nativeButton={false}>
              Abrir empresas
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={BookOpenText}
          title={companyFilter ? "Nenhum relatório para esta empresa" : "Nenhum relatório ainda"}
          description="O relatório do período aparece aqui quando a análise da empresa é concluída: envie os demonstrativos e execute a análise no workspace dela."
          action={
            <Button
              variant="outline"
              render={<Link href={companyFilter ? companyWorkspaceHref(companyFilter, "documentos") : "/companies"} />}
              nativeButton={false}
            >
              {companyFilter ? "Abrir a empresa" : "Abrir empresas"}
            </Button>
          }
        />
      )}

      {pendingCompanies.length > 0 && filtered.length > 0 && (
        <section aria-labelledby="sem-relatorio" className="flex flex-col gap-2">
          <h2 id="sem-relatorio" className="type-eyebrow">
            Ainda sem análise
          </h2>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem]">
            {pendingCompanies.map((company) => (
              <li key={company.id}>
                <Link
                  href={companyWorkspaceHref(company.id, "documentos")}
                  className="text-foreground-secondary underline-offset-4 hover:text-primary hover:underline"
                >
                  {company.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
