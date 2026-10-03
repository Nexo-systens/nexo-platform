import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { SectionShell } from "@/components/shared/SectionShell";
import { Button } from "@/components/ui/button";
import { AnalysisAndHistorySection } from "@/modules/analysis/components/AnalysisAndHistorySection";
import { ArchiveCompanyButton } from "@/modules/companies/components/ArchiveCompanyButton";
import { CompanyFormSheet } from "@/modules/companies/components/CompanyFormSheet";
import { CompanyOverview } from "@/modules/companies/components/CompanyOverview";
import { CompanyWorkspaceNav, type WorkspaceNavItem } from "@/modules/companies/components/CompanyWorkspaceNav";
import { availableWorkspaceViews, resolveWorkspaceView } from "@/modules/companies/lib/workspace-views";
import { buildExecutiveSituation } from "@/modules/analysis/lib/executive-situation";
import { getExecutiveHistory } from "@/modules/analysis/services/executive-history.service";
import { KnowledgeSection } from "@/modules/decisions/components/KnowledgeSection";
import { getDecisionCenterSummary } from "@/modules/decisions/services/decision-center.service";
import { CompanyStatusBadge } from "@/modules/companies/components/CompanyStatusBadge";
import { DeleteCompanyButton } from "@/modules/companies/components/DeleteCompanyButton";
import {
  COMPANY_SIZE_LABELS,
  TAX_REGIME_LABELS,
} from "@/modules/companies/constants";
import { getCompanyById } from "@/modules/companies/services/company.service";
import { formatCnpj } from "@/modules/companies/utils/cnpj";
import { formatDateTime } from "@/modules/dashboard/lib/format";
import { DocumentsSection } from "@/modules/documents/components/DocumentsSection";
import {
  countDocumentsByCompany,
  listAnalyzableDocumentsByCompany,
} from "@/modules/documents/services/document.service";
import { ExecutiveDiagnosisSection } from "@/modules/decisions/components/ExecutiveDiagnosisSection";
import { getExecutiveDiagnosesByCompany } from "@/modules/decisions/services/executive-diagnosis-persistence.service";
import { ScenarioLab } from "@/modules/scenarios/components/ScenarioLab";
import { ExecutiveChatSection } from "@/modules/executive-chat/components/ExecutiveChatSection";
import {
  countExecutionsByCompany,
  getLatestAnalysisSummary,
} from "@/modules/analysis/services/analysis.service";
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

/**
 * Mission 204 — workspace em VISÕES (`?secao=`, ver
 * modules/companies/lib/workspace-views.ts): cabeçalho, ações e navegação
 * comuns; só a visão ativa é renderizada. A visão padrão, depois da
 * primeira análise, é a Visão geral (situação, sinais, decisões,
 * atividade). Antes dela, Documentos.
 *
 * Mission 203 — workspace executivo da empresa. Cabeçalho com o que
 * importa (situação, última análise, documentos), navegação por seção e
 * ordem progressiva: antes da primeira análise, o caminho começa pelos
 * documentos; depois dela, pela análise e pelas decisões. Dados
 * cadastrais ficam no fim — a empresa não é um registro de cadastro.
 */
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
  const [documentsCount, analyzableDocuments, executionsCount, diagnoses, latestAnalysis] = await Promise.all([
    countDocumentsByCompany(company.id),
    listAnalyzableDocumentsByCompany(company.id),
    countExecutionsByCompany(company.id),
    getExecutiveDiagnosesByCompany(company.id),
    getLatestAnalysisSummary(company.id),
  ]);

  // Mission 195 — estado de ativação PURO (`resolveActivationState()`),
  // derivado das contagens canônicas: orienta o texto de orientação e
  // quais capacidades secundárias já fazem sentido aparecer.
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
      value: company.regime_tributario ? TAX_REGIME_LABELS[company.regime_tributario] : "—",
    },
    { label: "CNAE", value: company.cnae ?? "—" },
    { label: "Segmento", value: company.segmento ?? "—" },
    { label: "Porte", value: company.porte ? COMPANY_SIZE_LABELS[company.porte] : "—" },
    {
      label: "Data de abertura",
      value: company.data_abertura ? new Date(company.data_abertura).toLocaleDateString("pt-BR") : "—",
    },
  ];

  const view = resolveWorkspaceView(rawSearchParams.secao, showSecondaryCapabilities);
  const [situationHistory, decisionSummary] = await Promise.all([
    view === "visao-geral" ? getExecutiveHistory(company.id) : Promise.resolve([]),
    showSecondaryCapabilities ? getDecisionCenterSummary(company.id) : Promise.resolve(null),
  ]);
  const navItems: WorkspaceNavItem[] = availableWorkspaceViews(showSecondaryCapabilities).map((item) =>
    item.id === "decisoes" && decisionSummary && decisionSummary.pending > 0
      ? {
          ...item,
          count: decisionSummary.pending,
          countLabel: `${decisionSummary.pending} ${decisionSummary.pending === 1 ? "item aguarda" : "itens aguardam"} decisão`,
        }
      : item
  );

  const documentsSection = (
    <SectionShell
      id="documentos"
      eyebrow="Dados"
      title="Documentos"
      description="Demonstrativos enviados pela empresa. Só PDF e CSV entram na análise financeira; os demais ficam guardados."
    >
      <DocumentsSection
        companyId={company.id}
        basePath={`/companies/${company.id}`}
        rawSearchParams={rawSearchParams}
      />
    </SectionShell>
  );

  const analysisSection = (
    <SectionShell
      id="analise"
      eyebrow="Análise"
      title="Análise financeira"
      description="O que os documentos mostram — indicadores, demonstrações e evidências — e o que o EFOS infere a partir deles, separados."
    >
      <AnalysisAndHistorySection companyId={company.id} hasDocuments={documentsCount > 0} />
    </SectionShell>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
          render={<Link href="/companies" />}
          nativeButton={false}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Empresas
        </Button>

        <PageHeader
          eyebrow="Empresa"
          title={company.razao_social}
          description={company.nome_fantasia ?? undefined}
          meta={
            <>
              <CompanyStatusBadge status={company.status} />
              <span className="num">CNPJ {formatCnpj(company.cnpj)}</span>
              <span aria-hidden="true">·</span>
              <span>
                {latestAnalysis
                  ? `Última análise em ${formatDateTime(latestAnalysis.generatedAt)}`
                  : "Nenhuma análise executada"}
              </span>
              <span aria-hidden="true">·</span>
              <span className="num">
                {documentsCount} documento{documentsCount === 1 ? "" : "s"}
              </span>
            </>
          }
          actions={
            <>
              {/* Mission 208 — os relatórios executivos desta empresa (um por análise concluída). */}
              {executionsCount > 0 && (
                <Button variant="outline" size="sm" render={<Link href={`/reports?empresa=${company.id}`} />} nativeButton={false}>
                  Relatórios
                </Button>
              )}
              <CompanyFormSheet company={company} trigger={<Button variant="outline" size="sm">Editar</Button>} />
              <ArchiveCompanyButton companyId={company.id} status={company.status} />
              <DeleteCompanyButton companyId={company.id} companyName={company.razao_social} />
            </>
          }
        />
      </div>

      <CompanyWorkspaceNav companyId={company.id} items={navItems} active={view} />

      {(view === "visao-geral" || view === "documentos") && (
        <ActivationGuidanceCard
          state={activation.state}
          description={activation.description}
          primaryAction={activation.primaryAction}
        />
      )}

      <div className="pt-2">
        {view === "visao-geral" && (
          <CompanyOverview
            companyId={company.id}
            situation={buildExecutiveSituation(situationHistory)}
            decisions={decisionSummary}
            hasDiagnosis={diagnoses.length > 0}
            fullTimeline={rawSearchParams.linha === "completa"}
          />
        )}
        {view === "analise" && analysisSection}
        {view === "decisoes" && <ExecutiveDiagnosisSection companyId={company.id} />}
        {view === "cenarios" && <ScenarioLab companyId={company.id} />}
        {view === "conversa" && <ExecutiveChatSection companyId={company.id} />}
        {view === "conhecimento" && (
          <SectionShell
            id="conhecimento"
            eyebrow="Memória financeira"
            title="Conhecimento"
            description="O que a NEXO aprendeu com as decisões desta empresa e seus resultados — de onde veio, quando se formou e quanto se confirmou."
          >
            <KnowledgeSection companyId={company.id} />
          </SectionShell>
        )}
        {view === "documentos" && documentsSection}
        {view === "cadastro" && (
          <SectionShell
            id="cadastro"
            eyebrow="Cadastro"
            title="Dados cadastrais"
            description="Identificação da empresa na NEXO. Editar não altera nenhuma análise já feita."
          >
            <dl className="grid grid-cols-1 gap-x-10 gap-y-5 border-y border-border py-6 sm:grid-cols-2 lg:grid-cols-4">
              {fields.map((field) => (
                <div key={field.label} className="flex flex-col gap-1">
                  <dt className="type-meta">{field.label}</dt>
                  <dd className="text-sm text-foreground">{field.value}</dd>
                </div>
              ))}
            </dl>
            {company.observacoes && (
              <div className="flex flex-col gap-1">
                <p className="type-meta">Observações</p>
                <p className="type-body text-foreground">{company.observacoes}</p>
              </div>
            )}
          </SectionShell>
        )}
      </div>
    </div>
  );
}
