import { Plus, Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { CompaniesFilters } from "@/modules/companies/components/CompaniesFilters";
import { CompaniesTable } from "@/modules/companies/components/CompaniesTable";
import { CompanyFormSheet } from "@/modules/companies/components/CompanyFormSheet";
import { listCompanies } from "@/modules/companies/services/company.service";
import { buildCompaniesHref } from "@/modules/companies/utils/search-params";
import { companyListFiltersSchema } from "@/modules/companies/validators/company.schemas";

export const metadata: Metadata = { title: "Empresas — NEXO" };

type RawSearchParams = Record<string, string | string[] | undefined>;

function toStringRecord(
  searchParams: RawSearchParams
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    result[key] = Array.isArray(value) ? value[0] : value;
  }
  return result;
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const rawParams = toStringRecord(await searchParams);
  const filters = companyListFiltersSchema.parse(rawParams);

  const { companies, total, page, pageSize } = await listCompanies(filters);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(filters.q) || filters.status !== "all";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Empresas"
        title="Empresas"
        description="As empresas acompanhadas pela sua conta. Abra uma empresa para ver a análise, o diagnóstico e as decisões."
        meta={
          <Link href="/companies/closed" className="underline-offset-4 hover:underline">
            Ver empresas encerradas
          </Link>
        }
      />

      <CompaniesFilters current={rawParams} status={filters.status} />

      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={
            hasFilters
              ? "Nenhum resultado encontrado"
              : "Nenhuma empresa cadastrada"
          }
          description={
            hasFilters
              ? "Ajuste a busca ou os filtros para encontrar o que procura."
              : "Cadastre sua primeira empresa para começar a organizar a inteligência financeira dela."
          }
          action={
            !hasFilters && (
              <CompanyFormSheet
                trigger={
                  <Button>
                    <Plus className="size-4" aria-hidden="true" />
                    Nova empresa
                  </Button>
                }
              />
            )
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
            <CompaniesTable
              companies={companies}
              filters={filters}
              current={rawParams}
            />
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Página {page} de {totalPages} · {total} empresa
                {total === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <Link
                        href={buildCompaniesHref(rawParams, {
                          page: String(page - 1),
                        })}
                      />
                    }
                  >
                    Anterior
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Anterior
                  </Button>
                )}
                {page < totalPages ? (
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <Link
                        href={buildCompaniesHref(rawParams, {
                          page: String(page + 1),
                        })}
                      />
                    }
                  >
                    Próxima
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Próxima
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
