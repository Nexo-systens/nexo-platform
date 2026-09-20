"use client";

import { useMemo, useState } from "react";

import type { ExecutiveReport, ExecutiveReportSection } from "@/efos/application/report";
import type { NormalizedFinancialRecord } from "@/efos/engines/data";
import type { Evidence, Indicator, ResourceType } from "@/efos/domain";
import {
  buildEvidenceSourceDetails,
  buildIndicatorSourceDetails,
  type SourceDetails,
} from "@/modules/analysis/lib/sourceDetails";

import { derivePeriodLabel } from "@/modules/analysis/lib/report-view";

import { FinancialRecordsTable } from "./FinancialRecordsTable";
import { IndicatorsGrid } from "./IndicatorsGrid";
import { InsightList, type InsightItem } from "./InsightList";
import { SourceDetailsSheet } from "./SourceDetailsSheet";

interface ExecutiveReportViewProps {
  report: ExecutiveReport;
}

/**
 * Conjunto de `ResourceType` que a convenção D-004 (`docs/DECISIONS.md`,
 * já reaproveitada por `DefaultBalanceSheetBuilder`, Mission 054)
 * reconhece como Ativo/Passivo — os únicos registros que representam
 * de fato uma posição patrimonial, nunca uma movimentação. O Builder
 * nunca descarta um registro não classificado (preserva-o no grupo
 * residual "unclassified", para rastreabilidade) — mas exibi-lo sob o
 * título "Balanço Patrimonial" apresentaria transações (`kind:
 * "event"`, sempre residuais aqui) como se fossem contas patrimoniais
 * reais, o que um extrato bancário sem nenhuma conta declarada nunca
 * fornece (Mission 097, Etapa 7, D-051). Os mesmos registros continuam
 * visíveis, sem nenhuma perda, na seção "Fluxo de Caixa".
 */
const BALANCE_SHEET_RESOURCE_TYPES: ReadonlySet<ResourceType> = new Set([
  "cash",
  "client",
  "inventory",
  "asset",
  "investment",
  "supplier",
  "loan",
]);

function isBalanceSheetRecord(record: NormalizedFinancialRecord): boolean {
  return (
    record.kind === "resource" &&
    record.resourceType !== undefined &&
    BALANCE_SHEET_RESOURCE_TYPES.has(record.resourceType)
  );
}

/**
 * Dados de rastreabilidade coletados de `report.sections` (Mission 109
 * — Source Traceability Experience): união (sem duplicar por
 * `recordId`) dos registros de `balanceSheet`/`incomeStatement`/
 * `cashFlow` e de todas as Evidences já expostas em `evidence`. Nunca
 * busca nada fora de `report.sections` — a UI só rastreia até onde o
 * `ExecutiveReport` já leva (nenhum acesso a `FinancialModelAggregate`
 * cru, que a Mission 081 deliberadamente não expõe).
 */
function collectTraceabilityData(sections: readonly ExecutiveReportSection[]) {
  const recordsById = new Map<string, NormalizedFinancialRecord>();
  const evidences: Evidence[] = [];

  for (const section of sections) {
    switch (section.type) {
      case "balanceSheet":
        for (const record of section.balanceSheet) recordsById.set(record.recordId, record);
        break;
      case "incomeStatement":
        for (const record of section.incomeStatement) recordsById.set(record.recordId, record);
        break;
      case "cashFlow":
        for (const record of section.cashFlow) recordsById.set(record.recordId, record);
        break;
      case "evidence":
        evidences.push(...section.evidence.evidences);
        break;
      default:
        break;
    }
  }

  return { records: [...recordsById.values()], evidences };
}

function renderSection(
  section: ExecutiveReportSection,
  onViewIndicatorSource: (indicator: Indicator) => void,
  onViewEvidenceSource: (evidence: Evidence) => void
) {
  switch (section.type) {
    case "financialHealth":
      return (
        <IndicatorsGrid
          indicators={section.financialHealth}
          onViewSource={onViewIndicatorSource}
        />
      );
    case "financialRisk":
      return (
        <IndicatorsGrid
          indicators={section.financialRisk}
          onViewSource={onViewIndicatorSource}
        />
      );
    case "kpi":
      return <IndicatorsGrid indicators={section.kpi} onViewSource={onViewIndicatorSource} />;
    case "indicators":
      return (
        <IndicatorsGrid
          indicators={section.indicators.indicators}
          onViewSource={onViewIndicatorSource}
        />
      );
    case "balanceSheet":
      return (
        <FinancialRecordsTable
          records={section.balanceSheet.filter(isBalanceSheetRecord)}
        />
      );
    case "incomeStatement":
      return <FinancialRecordsTable records={section.incomeStatement} />;
    case "cashFlow":
      return <FinancialRecordsTable records={section.cashFlow} />;
    case "evidence": {
      const items: InsightItem[] = section.evidence.evidences.map((evidence) => ({
        id: evidence.id,
        title: evidence.title,
        description: evidence.description,
        badges: [evidence.severity, evidence.confidence],
        onViewSource: () => onViewEvidenceSource(evidence),
      }));
      return (
        <InsightList items={items} emptyMessage="Nenhuma evidência nesta seção." />
      );
    }
    case "context": {
      const items: InsightItem[] = section.context.contexts.map((context) => ({
        id: context.id,
        title: context.title,
        description: context.description,
        badges: [context.severity, context.confidence],
      }));
      return (
        <InsightList items={items} emptyMessage="Nenhum contexto nesta seção." />
      );
    }
    case "reasoning": {
      const items: InsightItem[] = section.reasoning.reasonings.map((reasoning) => ({
        id: reasoning.id,
        title: reasoning.title,
        description: reasoning.description,
        badges: [reasoning.confidence],
      }));
      return (
        <InsightList items={items} emptyMessage="Nenhum raciocínio nesta seção." />
      );
    }
    case "recommendation": {
      const items: InsightItem[] = section.recommendation.recommendations.map(
        (recommendation) => ({
          id: recommendation.id,
          title: recommendation.title,
          description: `${recommendation.description} ${recommendation.expectedImpact}`,
          badges: [recommendation.priority, recommendation.confidence],
        })
      );
      return (
        <InsightList
          items={items}
          emptyMessage="Nenhuma recomendação nesta seção."
        />
      );
    }
    case "decision": {
      const items: InsightItem[] = section.decision.decisions.map((decision) => ({
        id: decision.id,
        title: decision.title,
        description: `${decision.description} ${decision.rationale}`,
        badges: [decision.priority, decision.confidence],
      }));
      return (
        <InsightList items={items} emptyMessage="Nenhuma decisão nesta seção." />
      );
    }
  }
}

/**
 * Mission 194, Seção 33. Rótulo de período exibido ao lado do título de
 * cada demonstração financeira — apenas Balanço/DRE têm um período/
 * data-base genuíno por linha (`derivePeriodLabel()`); Fluxo de Caixa
 * (transações datadas individualmente, cada uma com seu próprio
 * `occurredAt`) não tem um único período a resumir, então nunca recebe
 * este rótulo.
 */
function sectionPeriodLabel(section: ExecutiveReportSection): string | undefined {
  switch (section.type) {
    case "balanceSheet":
      return derivePeriodLabel(section.balanceSheet);
    case "incomeStatement":
      return derivePeriodLabel(section.incomeStatement);
    default:
      return undefined;
  }
}

/**
 * Renderizador executivo do `ExecutiveReport` (Mission 081 — NEXO
 * Executive Analysis Consumption). Puramente apresentacional: itera
 * `report.sections` exatamente na ordem em que já chegam — a ordem
 * executiva determinística da Mission 065 — nunca reordena, nunca
 * insere uma seção ausente, nunca calcula/reclassifica nada. Mesmo
 * princípio já estabelecido por `DefaultExecutiveReportRenderer`
 * (Mission 078), agora em React em vez de Markdown.
 *
 * "Ver origem" (Mission 109) é a única exceção a "nenhum cálculo
 * novo": `buildIndicatorSourceDetails`/`buildEvidenceSourceDetails`
 * (modules/analysis/lib/sourceDetails.ts) apenas resolvem `id`s já
 * existentes (`EvidenceSource`, `recordId`) contra dados já presentes
 * em `report.sections` — nenhum valor numérico é recalculado, nenhuma
 * origem é inventada quando a cadeia não existe.
 */
export function ExecutiveReportView({ report }: ExecutiveReportViewProps) {
  const [activeTitle, setActiveTitle] = useState("");
  const [activeSource, setActiveSource] = useState<SourceDetails | null>(null);
  const traceability = useMemo(
    () => collectTraceabilityData(report.sections),
    [report.sections]
  );

  function handleViewIndicatorSource(indicator: Indicator) {
    setActiveTitle(indicator.name);
    setActiveSource(
      buildIndicatorSourceDetails(indicator, traceability.evidences, traceability.records)
    );
  }

  function handleViewEvidenceSource(evidence: Evidence) {
    setActiveTitle(evidence.title);
    setActiveSource(buildEvidenceSourceDetails(evidence, traceability.records));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end text-xs text-muted-foreground">
        <span>
          Análise executada em{" "}
          {new Date(report.metadata.generatedAt).toLocaleString("pt-BR")}
        </span>
      </div>

      {report.sections.map((section, index) => {
        const periodLabel = sectionPeriodLabel(section);
        return (
          <div key={`${section.type}-${index}`} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                {section.title}
              </h3>
              {periodLabel && (
                <span className="text-xs text-muted-foreground">{periodLabel}</span>
              )}
            </div>
            {renderSection(section, handleViewIndicatorSource, handleViewEvidenceSource)}
          </div>
        );
      })}

      <SourceDetailsSheet
        title={activeTitle}
        details={activeSource}
        onOpenChange={(open) => {
          if (!open) setActiveSource(null);
        }}
      />
    </div>
  );
}
