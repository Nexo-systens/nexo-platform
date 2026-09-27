import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { SemanticBadge } from "@/components/shared/SemanticBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CompanyOverview } from "@/modules/dashboard/lib/executive-overview";
import { formatDateTime } from "@/modules/dashboard/lib/format";

const CHAIN = ["Documentos", "Análise", "Diagnóstico", "Decisões"] as const;

/** Até onde a empresa percorreu a cadeia EFOS — só a partir de contagens reais. */
function chainProgress(company: CompanyOverview): number {
  if (company.decisionsCount > 0) return 4;
  if (company.stage === "diagnosis_available") return 3;
  if (company.stage === "analysis_available") return 2;
  if (company.documentsCount > 0) return 1;
  return 0;
}

function Signal({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="num text-lg font-semibold text-foreground">{value}</span>
      <span className="type-meta">{label}</span>
    </div>
  );
}

export function CompanyOverviewCard({ company }: { company: CompanyOverview }) {
  const progress = chainProgress(company);

  return (
    <article className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 shadow-xs">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            href={company.href}
            className="type-subsection-title truncate underline-offset-4 hover:underline"
          >
            {company.name}
          </Link>
          <p className="type-meta">
            {company.lastAnalysisAt
              ? `Última análise em ${formatDateTime(company.lastAnalysisAt)}`
              : "Nenhuma análise executada"}
          </p>
        </div>
        <SemanticBadge tone={company.stageTone}>{company.stageLabel}</SemanticBadge>
      </header>

      <ol aria-label="Cadeia EFOS percorrida" className="grid grid-cols-4 gap-1.5">
        {CHAIN.map((step, index) => {
          const done = index < progress;
          return (
            <li key={step} className="flex flex-col gap-1.5">
              <span
                aria-hidden="true"
                className={cn("h-1 rounded-full", done ? "bg-primary" : "bg-surface-sunken")}
              />
              <span className={cn("text-[0.6875rem]", done ? "text-foreground-secondary" : "text-muted-foreground")}>
                {step}
                <span className="sr-only">{done ? " — concluído" : " — pendente"}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="rounded-lg bg-surface-subtle px-4 py-3">
        {company.signals.status === "available" ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Signal label="Evidências" value={company.signals.evidence} />
            <Signal label="Interpretações" value={company.signals.interpretations} />
            <Signal label="Recomendações" value={company.signals.recommendations} />
            <Signal label="Propostas de decisão" value={company.signals.proposals} />
          </div>
        ) : company.signals.status === "unavailable" ? (
          <p className="type-meta">
            Resumo da última análise indisponível — execute a análise novamente para atualizá-lo.
          </p>
        ) : (
          <p className="type-meta">A leitura executiva aparece aqui depois da primeira análise.</p>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3">
        <span className="type-meta num">
          {company.documentsCount} {company.documentsCount === 1 ? "documento" : "documentos"} ·{" "}
          {company.decisionsCount} {company.decisionsCount === 1 ? "decisão registrada" : "decisões registradas"}
        </span>
        <Button size="sm" render={<Link href={company.nextStep.href} />} nativeButton={false}>
          {company.nextStep.label}
          <ArrowRight aria-hidden="true" />
        </Button>
      </footer>
    </article>
  );
}
