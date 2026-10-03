import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ReportDocument } from "@/modules/reports/components/ReportDocument";
import { capitalize } from "@/modules/reports/lib/report-language";
import { loadReport } from "@/modules/reports/services/report.service";

import "@/modules/reports/components/report-document.css";

type Params = Promise<{ executionId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { executionId } = await params;
  const loaded = await loadReport(executionId);
  if (!loaded) return { title: "Relatório — NEXO" };
  const period = loaded.reading.periodLabel ? ` — ${capitalize(loaded.reading.periodLabel.long)}` : "";
  return { title: `${loaded.company.razao_social}${period} — NEXO` };
}

/**
 * Mission 208 — leitura de um relatório executivo. O relatório é o
 * `ExecutiveReport` gravado pela análise (imutável); a página organiza a
 * leitura (`buildReportReading`) e liga o ciclo de decisão por linhagem
 * (D-133). Relatório inexistente, de outra empresa (RLS), de empresa
 * encerrada ou com id malformado: 404, sem distinguir.
 */
export default async function ReportPage({ params }: { params: Params }) {
  const { executionId } = await params;
  const loaded = await loadReport(executionId);
  if (!loaded) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground print:hidden"
        render={<Link href={`/reports?empresa=${loaded.company.id}`} />}
        nativeButton={false}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Relatórios
      </Button>
      <ReportDocument company={loaded.company} reading={loaded.reading} />
    </div>
  );
}
