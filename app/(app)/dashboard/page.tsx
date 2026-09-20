import type { Metadata } from "next";
import {
  Archive,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
} from "lucide-react";

import { RecentActivity } from "@/modules/dashboard/components/RecentActivity";
import { StatCard } from "@/modules/dashboard/components/StatCard";
import { getDashboardSummary } from "@/modules/dashboard/services/dashboard.service";

export const metadata: Metadata = { title: "Dashboard — NEXO" };

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão consolidada da saúde financeira das suas empresas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Empresas"
          value={summary.companiesCount}
          icon={Building2}
          href="/companies"
        />
        <StatCard
          label="Empresas ativas"
          value={summary.activeCompaniesCount}
          icon={CheckCircle2}
          href="/companies?status=active"
        />
        <StatCard
          label="Empresas arquivadas"
          value={summary.archivedCompaniesCount}
          icon={Archive}
          href="/companies?status=archived"
        />
        <StatCard
          label="Diagnósticos"
          value={summary.diagnosticsCount}
          icon={ClipboardList}
          href="/diagnostics"
          placeholder
        />
        <StatCard
          label="Documentos"
          value={summary.documentsCount}
          icon={FileText}
          href="/documents"
          placeholder
        />
        <StatCard
          label="Relatórios"
          value={summary.reportsCount}
          icon={BarChart3}
          href="/reports"
          placeholder
        />
      </div>

      <RecentActivity items={summary.recentActivity} />
    </div>
  );
}
