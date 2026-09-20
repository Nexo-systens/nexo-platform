import { ArrowLeft, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlaceholderCard } from "@/components/shared/PlaceholderCard";
import { Button } from "@/components/ui/button";
import { AnalysisAndHistorySection } from "@/modules/analysis/components/AnalysisAndHistorySection";
import { ArchiveCompanyButton } from "@/modules/companies/components/ArchiveCompanyButton";
import { CompanyFormSheet } from "@/modules/companies/components/CompanyFormSheet";
import { CompanyStatusBadge } from "@/modules/companies/components/CompanyStatusBadge";
import { DeleteCompanyButton } from "@/modules/companies/components/DeleteCompanyButton";
import {
  COMPANY_SIZE_LABELS,
  TAX_REGIME_LABELS,
} from "@/modules/companies/constants";
import { getCompanyById } from "@/modules/companies/services/company.service";
import { formatCnpj } from "@/modules/companies/utils/cnpj";
import { DocumentsSection } from "@/modules/documents/components/DocumentsSection";
import {
  countDocumentsByCompany,
  listAnalyzableDocumentsByCompany,
} from "@/modules/documents/services/document.service";
import { ExecutiveDiagnosisSection } from "@/modules/decisions/components/ExecutiveDiagnosisSection";
import { getExecutiveDiagnosesByCompany } from "@/modules/decisions/services/executive-diagnosis-persistence.service";
import { CompanyTimeline } from "@/modules/timeline/components/CompanyTimeline";
import { ScenarioLab } from "@/modules/scenarios/components/ScenarioLab";
import { ExecutiveChatSection } from "@/modules/executive-chat/components/ExecutiveChatSection";
import { countExecutionsByCompany } from "@/modules/analysis/services/analysis.service";
import { ActivationGuidanceCard } from "@/modules/activation/components/ActivationGuidanceCard";
import { hasReachedFirstAnalysis, resolveActivationState } from "@/modules/activation/resolveActivationState";

type Params = Promise<{ id: string }>;
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

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const company = await getCompanyById(id);
  return {
    title: company ? `${company.razao_social} — NEXO` : "Empresa — NEXO",
  };
}

export default async function CompanyProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<RawSearchParams>;
}) {
  const { id } = await params;
  const company = await getCompanyById(id);

  if (!company) {
    notFound();
  }

  const rawSearchParams = toStringRecord(await searchParams);
  const [documentsCount, analyzableDocuments, executionsCount, diagnoses] = await Promise.all([
    countDocumentsByCompany(company.id),
    listAnalyzableDocumentsByCompany(company.id),
    countExecutionsByCompany(company.id),
    getExecutiveDiagnosesByCompany(company.id),
  ]);

  // Mission 195 — Founding Company Production Onboarding & First
  // Executive Value. Estado de ativação PURO (`resolveActivationState()`,
  // `modules/activation/`) — nunca uma segunda fonte de verdade sobre
  // "onboarding" persistida (Seção 35: derivado inteiramente de
  // contagens canônicas já existentes). Orienta tanto o texto de
  // `ActivationGuidanceCard` quanto quais seções secundárias (Scenario
  // Lab/Executive Chat/trajetória histórica, Seção 28) já fazem
  // sentido aparecer.
  const activation = resolveActivationState({
    documentsCount,
    analyzableDocumentsCount: analyzableDocuments.length,
    executionsCount,
    diagnosesCount: diagnoses.length,
  });
  const showSecondaryCapabilities = hasReachedFirstAnalysis(activation.state);

  const fields: { label: string; value: string }[] = [
    { label: "Razão social", value: company.razao_social },
    { label: "Nome fantasia", value: company.nome_fantasia ?? "—" },
    { label: "CNPJ", value: formatCnpj(company.cnpj) },
    {
      label: "Regime tributário",
      value: company.regime_tributario
        ? TAX_REGIME_LABELS[company.regime_tributario]
        : "—",
    },
    { label: "CNAE", value: company.cnae ?? "—" },
    { label: "Segmento", value: company.segmento ?? "—" },
    {
      label: "Porte",
      value: company.porte ? COMPANY_SIZE_LABELS[company.porte] : "—",
    },
    {
      label: "Data de abertura",
      value: company.data_abertura
        ? new Date(company.data_abertura).toLocaleDateString("pt-BR")
        : "—",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/companies" />}
          nativeButton={false}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Empresas
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">
                {company.razao_social}
              </h1>
              <CompanyStatusBadge status={company.status} />
            </div>
            {company.nome_fantasia && (
              <p className="text-sm text-muted-foreground">
                {company.nome_fantasia}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <CompanyFormSheet
              company={company}
              trigger={<Button variant="outline">Editar</Button>}
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
        </div>
      </div>

      <div className="rounded-xl border border-border">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map((field) => (
            <div key={field.label} className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {field.label}
              </span>
              <span className="text-sm text-foreground">{field.value}</span>
            </div>
          ))}
        </div>
        {company.observacoes && (
          <div className="border-t border-border p-4">
            <span className="text-xs text-muted-foreground">
              Observações
            </span>
            <p className="mt-1 text-sm text-foreground">
              {company.observacoes}
            </p>
          </div>
        )}
      </div>

      <ActivationGuidanceCard state={activation.state} description={activation.description} />

      <AnalysisAndHistorySection
        companyId={company.id}
        hasDocuments={documentsCount > 0}
      />

      <DocumentsSection
        companyId={company.id}
        basePath={`/companies/${company.id}`}
        rawSearchParams={rawSearchParams}
      />

      <ExecutiveDiagnosisSection companyId={company.id} />

      {/*
        Mission 195, Seção 1/28: capacidades secundárias (trajetória
        histórica, Scenario Lab, Executive Chat) só ficam visíveis
        depois que a empresa alcança sua primeira análise real — antes
        disso, nenhuma delas tem verdade financeira alguma para operar
        sobre, e mostrá-las incondicionalmente forçava toda empresa nova
        a entender capacidades avançadas antes de obter o primeiro
        valor executivo (Seção 1: "Do not force the user through every
        NEXO capability").
      */}
      {showSecondaryCapabilities && (
        <>
          <CompanyTimeline companyId={company.id} />
          <ScenarioLab companyId={company.id} />
          <ExecutiveChatSection companyId={company.id} />
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PlaceholderCard
          icon={ClipboardList}
          title="Relatórios"
          description="Relatórios consolidados desta empresa poderão ser gerados e consultados aqui."
        />
      </div>
    </div>
  );
}
