import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { KindMarker } from "@/components/shared/KindMarker";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { AttentionPanel } from "@/modules/dashboard/components/AttentionPanel";
import { EfosChainPanel } from "@/modules/dashboard/components/EfosChainPanel";
import { PortfolioMovementTable, PortfolioPriorities } from "@/modules/dashboard/components/PortfolioCommand";
import { getExecutiveCommand } from "@/modules/dashboard/services/executive-overview.service";

export const metadata: Metadata = { title: "Visão executiva — NEXO" };

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Mission 204 — Visão executiva como superfície de comando. Responde,
 * nesta ordem: qual é a situação do portfólio (frase montada só de
 * contagens do EFOS), o que exige prioridade (evidências mais graves
 * emitidas pelos Engines), como cada empresa se moveu desde a análise
 * anterior (margem líquida e liquidez corrente com variação, tendência,
 * decisões pendentes, próximo passo) e o que exige atenção operacional.
 * Nenhum insight fabricado; ausência de análise continua explícita.
 *
 * Mission 203 — base: estágio de cada empresa, "0 ≠ indisponível".
 */
export default async function DashboardPage() {
  const { overview, command } = await getExecutiveCommand();
  const { portfolio } = overview;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Visão executiva"
        title="Suas empresas, do dado à decisão"
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
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
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
          <EfosChainPanel />
        </div>
      ) : (
        <>
          <section aria-labelledby="portfolio-titulo" className="flex flex-col gap-2">
            <p className="type-eyebrow">Situação do portfólio</p>
            <h2
              id="portfolio-titulo"
              className="max-w-4xl text-[1.375rem] leading-snug font-semibold tracking-tight text-balance text-foreground"
            >
              {command.headline}
            </h2>
          </section>

          <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex min-w-0 flex-col gap-10">
              <section aria-labelledby="prioridades-titulo" className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <KindMarker kind="evidence" />
                  <h2 id="prioridades-titulo" className="type-section-title">
                    Prioridades
                  </h2>
                  <p className="type-meta">Os sinais mais graves das últimas análises, em todas as empresas.</p>
                </div>
                <PortfolioPriorities priorities={command.priorities} />
              </section>
            </div>

            <AttentionPanel items={overview.attention} />
          </div>

          <section aria-labelledby="movimento-titulo" className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="type-eyebrow">Movimento</p>
                <h2 id="movimento-titulo" className="type-section-title">
                  Como cada empresa se moveu
                </h2>
              </div>
              {overview.hiddenActiveCount > 0 && (
                <Link href="/companies" className="type-meta underline-offset-4 hover:underline">
                  + {plural(overview.hiddenActiveCount, "empresa ativa", "empresas ativas")} — ver todas
                </Link>
              )}
            </div>
            <PortfolioMovementTable rows={command.rows} />
          </section>
        </>
      )}
    </div>
  );
}
