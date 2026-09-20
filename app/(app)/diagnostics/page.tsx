import type { Metadata } from "next";
import { Stethoscope } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { CompanyStatusBadge } from "@/modules/companies/components/CompanyStatusBadge";
import { listCompanies } from "@/modules/companies/services/company.service";
import { companyListFiltersSchema } from "@/modules/companies/validators/company.schemas";
import { formatCnpj } from "@/modules/companies/utils/cnpj";

export const metadata: Metadata = { title: "Central de Decisões — NEXO" };

type RawSearchParams = Record<string, string | string[] | undefined>;

function toStringRecord(searchParams: RawSearchParams): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    result[key] = Array.isArray(value) ? value[0] : value;
  }
  return result;
}

function buildDiagnosticsHref(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  Object.entries(merged).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `/diagnostics?${query}` : "/diagnostics";
}

/**
 * Mission 179 — Executive Decision Center (Seção 8 — escopo
 * empresa vs. portfólio). `/diagnostics` já é um item de navegação de
 * nível superior (`modules/workspace/config/navigation.ts`), sem
 * `companyId` no path e sem nenhum conceito de "empresa ativa" na
 * sessão — nunca aninhado sob `/companies/[id]`. Nenhum documento
 * canônico (`docs/03_PRODUCT/`) descreve um "portfólio" cross-company;
 * a leitura mais honesta é: esta página é o PONTO DE PARTIDA que ajuda
 * o usuário a escolher em qual empresa agir, nunca uma segunda cópia da
 * Central de Decisões em si.
 *
 * **Decisão deliberada: nenhum contador "N itens pendentes" por
 * empresa aqui.** `listCompanies()` (Mission 006, `modules/companies/`)
 * é paginado (10/página) para um diretório de empresas — computar a
 * fila real de decisão (`buildDecisionCenterQueue()`) para CADA empresa
 * de CADA página, só para exibir uma contagem nesta tela de triagem,
 * exigiria paginar por todas as páginas de empresas ou forçar um limite
 * artificial — exatamente o tipo de "fabricar agregação de portfólio"
 * que a Seção 8 desta missão proíbe quando a arquitetura atual não
 * suporta isso com segurança. A fila real, completa e correta, com
 * ação real, vive exclusivamente na página da empresa (`<DecisionCenter />`,
 * `/companies/{id}#diagnostico-executivo`) — esta página apenas leva o
 * usuário até lá, reaproveitando o mesmo `listCompanies()`/paginação já
 * usados por `/companies` (nenhuma consulta nova).
 */
export default async function DiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const rawParams = toStringRecord(await searchParams);
  const filters = companyListFiltersSchema.parse({ ...rawParams, status: rawParams.status ?? "active" });

  const { companies, total, page, pageSize } = await listCompanies(filters);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Central de Decisões</h1>
        <p className="text-sm text-muted-foreground">
          Escolha uma empresa para ver o que requer sua decisão agora, o que já foi decidido e o que
          aconteceu depois.
        </p>
      </div>

      {companies.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="Nenhuma empresa ativa"
          description="Cadastre ou reative uma empresa para começar a acompanhar diagnósticos e decisões executivas."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {companies.map((company) => (
              <div
                key={company.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{company.razao_social}</span>
                    <CompanyStatusBadge status={company.status} />
                  </div>
                  <span className="text-xs text-muted-foreground">{formatCnpj(company.cnpj)}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/companies/${company.id}#diagnostico-executivo`} />}
                  nativeButton={false}
                >
                  Ver Central de Decisões
                </Button>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Página {page} de {totalPages} · {total} empresa{total === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={buildDiagnosticsHref(rawParams, { page: String(page - 1) })} />}
                    nativeButton={false}
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
                    render={<Link href={buildDiagnosticsHref(rawParams, { page: String(page + 1) })} />}
                    nativeButton={false}
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
