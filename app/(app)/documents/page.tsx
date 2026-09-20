import { Building2, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { DocumentsCompanySelect } from "@/modules/documents/components/DocumentsCompanySelect";
import { DocumentsSection } from "@/modules/documents/components/DocumentsSection";
import { getCompanyById, listCompanies } from "@/modules/companies/services/company.service";

export const metadata: Metadata = { title: "Documentos — NEXO" };

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

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const rawSearchParams = toStringRecord(await searchParams);
  const companyId = rawSearchParams.companyId;

  // Selecao de empresa e uma etapa do fluxo de Documentos (Mission 091),
  // nao um filtro/paginacao formal — 10 primeiras empresas ativas e
  // suficiente para o seletor sem duplicar a logica paginada de
  // listCompanies() (modules/companies). Empresa cadastrada em maior
  // volume que isso e um gap documentado, nao uma regra nova.
  const { companies } = await listCompanies({
    status: "active",
    sort: "razao_social",
    order: "asc",
    page: 1,
  });

  const company = companyId ? await getCompanyById(companyId) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Documentos</h1>
        <p className="text-sm text-muted-foreground">
          Envie e organize os documentos financeiros das suas empresas.
        </p>
      </div>

      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma empresa cadastrada"
          description="Cadastre uma empresa antes de enviar documentos financeiros."
          action={
            <Button render={<Link href="/companies" />} nativeButton={false}>
              Ir para Empresas
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Empresa
            </span>
            <DocumentsCompanySelect companies={companies} companyId={companyId} />
          </div>

          {!companyId ? (
            <EmptyState
              icon={FileText}
              title="Selecione uma empresa"
              description="Escolha uma empresa acima para ver e enviar os documentos financeiros dela."
            />
          ) : !company ? (
            <EmptyState
              icon={Building2}
              title="Empresa não encontrada"
              description="Esta empresa não existe ou você não tem acesso a ela."
            />
          ) : (
            <DocumentsSection
              companyId={company.id}
              basePath="/documents"
              rawSearchParams={rawSearchParams}
            />
          )}
        </>
      )}
    </div>
  );
}
