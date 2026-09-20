import { ArrowDown, ArrowUp, ArrowUpDown, Eye } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArchiveCompanyButton } from "@/modules/companies/components/ArchiveCompanyButton";
import { CompanyFormSheet } from "@/modules/companies/components/CompanyFormSheet";
import { CompanyStatusBadge } from "@/modules/companies/components/CompanyStatusBadge";
import { DeleteCompanyButton } from "@/modules/companies/components/DeleteCompanyButton";
import { TAX_REGIME_LABELS } from "@/modules/companies/constants";
import type { Company } from "@/modules/companies/services/company.service";
import { formatCnpj } from "@/modules/companies/utils/cnpj";
import { buildCompaniesHref } from "@/modules/companies/utils/search-params";
import type { CompanyListFilters } from "@/modules/companies/validators/company.schemas";

interface SortableHeaderProps {
  label: string;
  column: CompanyListFilters["sort"];
  filters: CompanyListFilters;
  current: Record<string, string | undefined>;
}

function SortableHeader({
  label,
  column,
  filters,
  current,
}: SortableHeaderProps) {
  const isActive = filters.sort === column;
  const nextOrder = isActive && filters.order === "asc" ? "desc" : "asc";
  const Icon = !isActive
    ? ArrowUpDown
    : filters.order === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <Link
      href={buildCompaniesHref(current, {
        sort: column,
        order: nextOrder,
        page: undefined,
      })}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      <Icon className="size-3.5" aria-hidden="true" />
    </Link>
  );
}

export function CompaniesTable({
  companies,
  filters,
  current,
}: {
  companies: Company[];
  filters: CompanyListFilters;
  current: Record<string, string | undefined>;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <SortableHeader
              label="Razão social"
              column="razao_social"
              filters={filters}
              current={current}
            />
          </TableHead>
          <TableHead>
            <SortableHeader
              label="CNPJ"
              column="cnpj"
              filters={filters}
              current={current}
            />
          </TableHead>
          <TableHead>Regime</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>
            <SortableHeader
              label="Criada em"
              column="created_at"
              filters={filters}
              current={current}
            />
          </TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {companies.map((company) => (
          <TableRow key={company.id}>
            <TableCell>
              <Link
                href={`/companies/${company.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {company.razao_social}
              </Link>
              {company.nome_fantasia && (
                <p className="text-xs text-muted-foreground">
                  {company.nome_fantasia}
                </p>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatCnpj(company.cnpj)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {company.regime_tributario
                ? TAX_REGIME_LABELS[company.regime_tributario]
                : "—"}
            </TableCell>
            <TableCell>
              <CompanyStatusBadge status={company.status} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(company.created_at).toLocaleDateString("pt-BR")}
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  render={<Link href={`/companies/${company.id}`} />}
                  nativeButton={false}
                >
                  <Eye className="size-4" aria-hidden="true" />
                  <span className="sr-only">Ver empresa</span>
                </Button>
                <CompanyFormSheet
                  company={company}
                  trigger={
                    <Button variant="outline" size="sm">
                      Editar
                    </Button>
                  }
                />
                <ArchiveCompanyButton
                  companyId={company.id}
                  status={company.status}
                />
                <DeleteCompanyButton
                  companyId={company.id}
                  companyName={company.razao_social}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
