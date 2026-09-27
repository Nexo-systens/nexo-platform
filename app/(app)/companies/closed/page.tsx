import { Archive } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { ClosedCompanyPurgePanel } from "@/modules/companies/components/ClosedCompanyPurgePanel";
import { listClosedCompanies } from "@/modules/companies/services/company.service";
import { formatCnpj } from "@/modules/companies/utils/cnpj";

export const metadata: Metadata = { title: "Empresas encerradas — NEXO" };

/**
 * Mission 202 (D-130) — empresas encerradas do usuário e a exclusão
 * definitiva de cada uma. Encerrar (em Empresas) só oculta a empresa e
 * impede novos dados; a exclusão definitiva, aqui, apaga os arquivos e
 * os dados persistidos — sem apagar a conta.
 */
export default async function ClosedCompaniesPage() {
  const companies = await listClosedCompanies();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Empresas encerradas</h1>
        <p className="text-sm text-muted-foreground">
          Empresas encerradas não recebem novos dados e não aparecem nas listagens. A exclusão definitiva
          remove os arquivos e todos os dados da empresa; sua conta não é afetada.{" "}
          <Link href="/companies" className="underline underline-offset-4 hover:text-foreground">
            Voltar para Empresas
          </Link>
        </p>
      </div>

      {companies.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Nenhuma empresa encerrada"
          description="Quando uma empresa for encerrada, ela aparecerá aqui para exclusão definitiva."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {companies.map((company) => (
            <ClosedCompanyPurgePanel
              key={company.id}
              companyId={company.id}
              companyName={company.razao_social}
              cnpj={formatCnpj(company.cnpj)}
              closedAt={company.deleted_at}
            />
          ))}
        </div>
      )}
    </div>
  );
}
