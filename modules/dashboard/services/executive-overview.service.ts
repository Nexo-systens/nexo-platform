import { buildExecutiveSituation } from "@/modules/analysis/lib/executive-situation";
import { getLatestAnalysisSummary, countExecutionsByCompany } from "@/modules/analysis/services/analysis.service";
import { getExecutiveHistory } from "@/modules/analysis/services/executive-history.service";
import { buildPortfolioCommand, type CompanyCommandInput, type PortfolioCommand } from "@/modules/dashboard/lib/portfolio-command";
import { getDecisionCenterSummary } from "@/modules/decisions/services/decision-center.service";
import {
  getCompanyCounts,
  listClosedCompanies,
  listCompanies,
} from "@/modules/companies/services/company.service";
import {
  buildExecutiveOverview,
  type CompanyOverviewInput,
  type ExecutiveOverview,
} from "@/modules/dashboard/lib/executive-overview";
import { getDecisionsByCompany } from "@/modules/decisions/services/decision-persistence.service";
import { getExecutiveDiagnosesByCompany } from "@/modules/decisions/services/executive-diagnosis-persistence.service";
import {
  countDocumentsByCompany,
  listAnalyzableDocumentsByCompany,
} from "@/modules/documents/services/document.service";

/**
 * Mission 203 — dados da Visão executiva. Só leituras já existentes
 * (mesmas consultas da página da empresa, sob o mesmo RLS) + o
 * `summary` da última análise. Limitado às primeiras empresas ativas:
 * a Visão executiva é um ponto de partida, não um relatório de
 * portfólio — o resto da lista fica em Empresas.
 */
export const OVERVIEW_COMPANY_LIMIT = 6;

async function loadCompany(company: { id: string; razao_social: string }): Promise<CompanyOverviewInput> {
  const [documentsCount, analyzable, executionsCount, diagnoses, decisions, latestAnalysis] = await Promise.all([
    countDocumentsByCompany(company.id),
    listAnalyzableDocumentsByCompany(company.id),
    countExecutionsByCompany(company.id),
    getExecutiveDiagnosesByCompany(company.id),
    getDecisionsByCompany(company.id),
    getLatestAnalysisSummary(company.id),
  ]);

  return {
    id: company.id,
    name: company.razao_social,
    documentsCount,
    analyzableDocumentsCount: analyzable.length,
    executionsCount,
    diagnosesCount: diagnoses.length,
    decisionsCount: decisions.length,
    latestAnalysis,
  };
}

/**
 * Mission 204 — além da visão por empresa, carrega a situação da última
 * análise (histórico canônico) e a fila de decisões de cada empresa
 * exibida, para a superfície de comando. Só para empresas que já têm
 * análise/diagnóstico — nenhuma leitura inútil para as demais.
 */
export async function getExecutiveCommand(): Promise<{ overview: ExecutiveOverview; command: PortfolioCommand }> {
  const overview = await getExecutiveOverview();
  const inputs: CompanyCommandInput[] = await Promise.all(
    overview.companies.map(async (company) => {
      const [history, decisions] = await Promise.all([
        company.lastAnalysisAt ? getExecutiveHistory(company.id) : Promise.resolve([]),
        company.stage === "diagnosis_available" || company.decisionsCount > 0
          ? getDecisionCenterSummary(company.id)
          : Promise.resolve(null),
      ]);
      return { company, situation: buildExecutiveSituation(history), decisions };
    })
  );
  return { overview, command: buildPortfolioCommand(inputs, overview.portfolio.activeCount) };
}

export async function getExecutiveOverview(): Promise<ExecutiveOverview> {
  const [counts, closed, active] = await Promise.all([
    getCompanyCounts(),
    listClosedCompanies(),
    listCompanies({ status: "active", sort: "razao_social", order: "asc", page: 1 }),
  ]);

  const shown = active.companies.slice(0, OVERVIEW_COMPANY_LIMIT);
  const inputs = await Promise.all(shown.map(loadCompany));

  return buildExecutiveOverview(
    { activeCount: counts.active, archivedCount: counts.archived, closedCount: closed.length },
    inputs
  );
}
