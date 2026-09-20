import { getCompanyCounts } from "@/modules/companies/services/company.service";

export interface DashboardActivityItem {
  id: string;
  title: string;
  description: string;
  occurredAt: string;
}

export interface DashboardSummary {
  companiesCount: number;
  activeCompaniesCount: number;
  archivedCompaniesCount: number;
  diagnosticsCount: number;
  documentsCount: number;
  reportsCount: number;
  recentActivity: DashboardActivityItem[];
}

/**
 * Empresas ja e um modulo real (Missao 4) — os tres contadores de empresa
 * vem de uma consulta real via company.service.ts. Diagnosticos, Documentos
 * e Relatorios ainda nao existem como modulo de negocio (docs/10_ROADMAP.md)
 * e permanecem como placeholder explicito ate as sprints correspondentes;
 * o Dashboard (StatCard) marca esses cards com "Em breve" para nao serem
 * confundidos com dado real.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const companyCounts = await getCompanyCounts();

  return {
    companiesCount: companyCounts.total,
    activeCompaniesCount: companyCounts.active,
    archivedCompaniesCount: companyCounts.archived,
    diagnosticsCount: 0,
    documentsCount: 0,
    reportsCount: 0,
    recentActivity: [],
  };
}
