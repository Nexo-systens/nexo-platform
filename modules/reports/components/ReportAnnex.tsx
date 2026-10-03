import { ChevronRight } from "lucide-react";

import { UnavailableValue } from "@/components/shared/UnavailableValue";
import { FinancialRecordsTable } from "@/modules/analysis/components/FinancialRecordsTable";
import { formatDateTime } from "@/modules/dashboard/lib/format";
import { formatIndicatorValue } from "@/lib/format-indicator";

import type { ReportReading } from "../lib/report-reading";

/**
 * Mission 208 — anexo do relatório: o catálogo completo de indicadores e as
 * demonstrações exatamente como estão no `ExecutiveReport` (mesmos
 * registros, mesma separação por demonstração de D-118), e a proveniência
 * do documento. Na tela as demonstrações ficam recolhidas; na impressão
 * abrem (`ReportPrintButton`).
 */
export function ReportAnnex({ reading }: { reading: ReportReading }) {
  const { indicators } = reading.annex;
  const statements = reading.annex.statements.filter((statement) => statement.records.length > 0);
  const emptyStatements = reading.annex.statements.filter((statement) => statement.records.length === 0);

  return (
    <section id="anexo" aria-labelledby="anexo-titulo" className="report-annex flex scroll-mt-24 flex-col gap-8">
      <header className="report-keep flex flex-col gap-2 border-t border-border-strong pt-5">
        <p className="type-eyebrow" aria-hidden="true">
          Anexo
        </p>
        <h2 id="anexo-titulo" className="type-section-title">
          Base do relatório
        </h2>
        <p className="type-body max-w-3xl text-pretty">
          Os números completos de onde as seções acima partem, como o EFOS os calculou e leu dos documentos.
        </p>
      </header>

      {indicators.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="type-subsection-title">Indicadores calculados · {indicators.length}</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] border-collapse text-sm">
              <caption className="sr-only">Todos os indicadores calculados nesta análise</caption>
              <thead>
                <tr className="border-b border-border-strong text-left">
                  <th scope="col" className="py-2 pr-4 type-meta font-medium">Indicador</th>
                  <th scope="col" className="py-2 text-right type-meta font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {indicators.map((indicator) => (
                  <tr key={indicator.id}>
                    <th scope="row" className="py-2 pr-4 text-left font-normal text-foreground">{indicator.name}</th>
                    <td className="num whitespace-nowrap py-2 text-right text-foreground">
                      {indicator.result.status === "available" ? (
                        formatIndicatorValue(indicator.result.value, indicator.unit)
                      ) : (
                        <UnavailableValue compact />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reading.annex.statements.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="type-subsection-title">Demonstrações</h3>
          {emptyStatements.length > 0 && (
            <p className="type-meta text-pretty">
              Sem lançamentos nesta análise: {emptyStatements.map((statement) => statement.title).join(", ")}.
            </p>
          )}
          <div className="flex flex-col">
            {statements.map((statement) => (
              <details key={statement.type} className="group border-b border-border py-3">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 select-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-3">
                    <ChevronRight
                      className="size-4 text-muted-foreground transition-transform duration-150 group-open:rotate-90 print:hidden"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium text-foreground">{statement.title}</span>
                  </span>
                  <span className="type-meta num">
                    {statement.records.length} {statement.records.length === 1 ? "lançamento" : "lançamentos"}
                    {statement.periodLabel ? ` · ${statement.periodLabel}` : ""}
                  </span>
                </summary>
                <div className="pt-4">
                  <FinancialRecordsTable records={statement.records} caption={`${statement.title} — lançamentos desta análise`} />
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="type-subsection-title">Proveniência</h3>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <dt className="type-meta">Análise executada em</dt>
            <dd className="num text-foreground">{formatDateTime(reading.executedAt)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="type-meta">Relatório gerado em</dt>
            <dd className="num text-foreground">{formatDateTime(reading.generatedAt)} · registro imutável</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="type-meta">Leitura da Executive AI</dt>
            <dd className="text-foreground">
              {reading.aiReading
                ? `Gerada em ${formatDateTime(reading.aiReading.diagnosis.createdAt)} · guardada como foi validada`
                : "Nenhuma gerada para esta análise"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="type-meta">Decisões, resultados e aprendizados</dt>
            <dd className="text-foreground">Estado em {formatDateTime(reading.stateAsOf)} · derivado dos registros da empresa</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:col-span-2">
            <dt className="type-meta">Identificador da análise</dt>
            <dd className="font-mono text-[0.75rem] break-all text-muted-foreground">{reading.executionId}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
