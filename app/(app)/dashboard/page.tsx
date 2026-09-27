import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { AttentionPanel } from "@/modules/dashboard/components/AttentionPanel";
import { CompanyOverviewCard } from "@/modules/dashboard/components/CompanyOverviewCard";
import { EfosChainPanel } from "@/modules/dashboard/components/EfosChainPanel";
import { getExecutiveOverview } from "@/modules/dashboard/services/executive-overview.service";

export const metadata: Metadata = { title: "Visão executiva — NEXO" };

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Mission 203 — Visão executiva. Responde, por empresa: em que estágio
 * está, o que a última análise produziu e qual é o próximo passo; e,
 * no conjunto, o que exige atenção. Só dados reais: nenhuma contagem
 * "em breve" nem zero no lugar de "não disponível".
 */
export default async function DashboardPage() {
  const overview = await getExecutiveOverview();
  const { portfolio } = overview;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Visão executiva"
        title="Suas empresas, do dado à decisão"
        description="Onde cada empresa está na cadeia EFOS, o que a última análise produziu e o que exige sua atenção agora."
        meta={
          <>
            <span className="num">{plural(portfolio.activeCount, "empresa ativa", "empresas ativas")}</span>
            <span aria-hidden="true">·</span>
            <span className="num">{plural(portfolio.archivedCount, "arquivada", "arquivadas")}</span>
            <span aria-hidden="true">·</span>
            <Link href="/companies/closed" className="num underline-offset-4 hover:underline">
              {plural(portfolio.closedCount, "encerrada", "encerradas")}
            </Link>
          </>
        }
        actions={
          <Button variant="outline" render={<Link href="/companies" />} nativeButton={false}>
            <Building2 aria-hidden="true" />
            Gerenciar empresas
          </Button>
        }
      />

      {overview.companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma empresa ativa"
          description="Cadastre a primeira empresa e envie seus demonstrativos para receber a primeira leitura executiva."
          action={
            <Button render={<Link href="/companies" />} nativeButton={false}>
              Cadastrar empresa
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section aria-labelledby="empresas-titulo" className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-3">
              <h2 id="empresas-titulo" className="type-section-title">
                Empresas
              </h2>
              {overview.hiddenActiveCount > 0 && (
                <Link href="/companies" className="type-meta underline-offset-4 hover:underline">
                  + {plural(overview.hiddenActiveCount, "empresa ativa", "empresas ativas")} — ver todas
                </Link>
              )}
            </div>
            <div className="flex flex-col gap-4">
              {overview.companies.map((company) => (
                <CompanyOverviewCard key={company.id} company={company} />
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-6">
            <AttentionPanel items={overview.attention} />
            <EfosChainPanel />
          </div>
        </div>
      )}
    </div>
  );
}
