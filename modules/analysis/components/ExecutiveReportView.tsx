"use client";

import { ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import type { ExecutiveReport, ExecutiveReportSection } from "@/efos/application/report";
import type { NormalizedFinancialRecord } from "@/efos/engines/data";
import type { Evidence, Indicator, ResourceType } from "@/efos/domain";
import {
  buildEvidenceSourceDetails,
  buildIndicatorSourceDetails,
  type SourceDetails,
} from "@/modules/analysis/lib/sourceDetails";

import { KindMarker } from "@/components/shared/KindMarker";
import {
  confidenceTag,
  INSIGHT_LAYER_LABELS,
  priorityTag,
  sectionKind,
  sectionLayer,
  severityTag,
  type InsightLayer,
} from "@/modules/analysis/lib/insight-semantics";
import { formatEngineText } from "@/modules/analysis/lib/engine-text";
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
        title: formatEngineText(evidence.title),
        description: formatEngineText(evidence.description),
        tags: [severityTag(evidence.severity), confidenceTag(evidence.confidence)],
        onViewSource: () => onViewEvidenceSource(evidence),
      }));
      return (
        <InsightList kind="evidence" items={items} emptyMessage="Nenhuma evidência nesta seção." />
      );
    }
    case "context": {
      const items: InsightItem[] = section.context.contexts.map((context) => ({
        id: context.id,
        title: formatEngineText(context.title),
        description: formatEngineText(context.description),
        tags: [severityTag(context.severity), confidenceTag(context.confidence)],
      }));
      return (
        <InsightList kind="interpretation" items={items} emptyMessage="Nenhuma interpretação nesta seção." />
      );
    }
    case "reasoning": {
      const items: InsightItem[] = section.reasoning.reasonings.map((reasoning) => ({
        id: reasoning.id,
        title: formatEngineText(reasoning.title),
        description: formatEngineText(reasoning.description),
        tags: [confidenceTag(reasoning.confidence)],
      }));
      return (
        <InsightList kind="hypothesis" items={items} emptyMessage="Nenhuma hipótese nesta seção." />
      );
    }
    case "recommendation": {
      const items: InsightItem[] = section.recommendation.recommendations.map(
        (recommendation) => ({
          id: recommendation.id,
          title: formatEngineText(recommendation.title),
          description: formatEngineText(`${recommendation.description} ${recommendation.expectedImpact}`),
          tags: [priorityTag(recommendation.priority), confidenceTag(recommendation.confidence)],
        })
      );
      return (
        <InsightList
          kind="recommendation"
          items={items}
          emptyMessage="Nenhuma recomendação nesta seção."
        />
      );
    }
    case "decision": {
      const items: InsightItem[] = section.decision.decisions.map((decision) => ({
        id: decision.id,
        title: formatEngineText(decision.title),
        description: formatEngineText(`${decision.description} ${decision.rationale}`),
        tags: [priorityTag(decision.priority), confidenceTag(decision.confidence)],
      }));
      return (
        <InsightList kind="decision" items={items} emptyMessage="Nenhuma proposta de decisão nesta seção." />
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

const INDICATOR_SECTIONS = new Set<ExecutiveReportSection["type"]>(["financialHealth", "financialRisk", "kpi", "indicators"]);
const STATEMENT_SECTIONS = new Set<ExecutiveReportSection["type"]>(["balanceSheet", "incomeStatement", "cashFlow"]);

function sectionItemCount(section: ExecutiveReportSection): string {
  const count =
    section.type === "financialHealth"
      ? section.financialHealth.length
      : section.type === "financialRisk"
        ? section.financialRisk.length
        : section.type === "kpi"
          ? section.kpi.length
          : section.type === "indicators"
            ? section.indicators.indicators.length
            : section.type === "balanceSheet"
              ? section.balanceSheet.filter(isBalanceSheetRecord).length
              : section.type === "incomeStatement"
                ? section.incomeStatement.length
                : section.type === "cashFlow"
                  ? section.cashFlow.length
                  : 0;
  const noun = INDICATOR_SECTIONS.has(section.type) ? ["indicador", "indicadores"] : ["lançamento", "lançamentos"];
  return `${count} ${count === 1 ? noun[0] : noun[1]}`;
}

function insightCount(section: ExecutiveReportSection): number | undefined {
  switch (section.type) {
    case "context":
      return section.context.contexts.length;
    case "reasoning":
      return section.reasoning.reasonings.length;
    case "recommendation":
      return section.recommendation.recommendations.length;
    case "decision":
      return section.decision.decisions.length;
    default:
      return undefined;
  }
}

/** Divisor entre o que é sabido e o que é inferido (Mission 203). */
function LayerDivider({ layer }: { layer: InsightLayer }) {
  const meta = INSIGHT_LAYER_LABELS[layer];
  return (
    <div className="flex flex-col gap-1 border-t border-border-strong pt-4">
      <p className="type-section-title">{meta.title}</p>
      <p className="type-meta">{meta.description}</p>
    </div>
  );
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
    <div className="flex flex-col gap-7">
      {report.sections.map((section, index) => {
        const periodLabel = sectionPeriodLabel(section);
        const layer = sectionLayer(section.type);
        // Mission 203: a ordem continua exatamente a de `report.sections`
        // (Mission 065, já monotônica: fatos → inferências); só um
        // divisor aparece quando a natureza da informação muda.
        const startsLayer = index === 0 || sectionLayer(report.sections[index - 1].type) !== layer;
        // Mission 204 — seção inferida sem itens vira uma linha discreta,
        // no mesmo lugar da ordem (nunca some): nada de título + lista vazia.
        if (layer === "inferred" && insightCount(section) === 0) {
          return (
            <Fragment key={`${section.type}-${index}`}>
              {startsLayer && <LayerDivider layer={layer} />}
              <p className="flex items-center gap-3 border-b border-border pb-3 type-meta">
                <KindMarker kind={sectionKind(section.type)} />
                <span>Nenhum item nesta análise.</span>
              </p>
            </Fragment>
          );
        }
        const firstIndicatorIndex = report.sections.findIndex((candidate) => INDICATOR_SECTIONS.has(candidate.type));
        const collapsible =
          (INDICATOR_SECTIONS.has(section.type) && index !== firstIndicatorIndex) || STATEMENT_SECTIONS.has(section.type);
        if (collapsible) {
          return (
            <Fragment key={`${section.type}-${index}`}>
              {startsLayer && <LayerDivider layer={layer} />}
              <details className="group border-b border-border pb-3">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 select-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-3">
                    <ChevronRight className="size-4 text-muted-foreground transition-transform duration-150 group-open:rotate-90" aria-hidden="true" />
                    <span className="type-subsection-title">{section.title}</span>
                    <KindMarker kind={sectionKind(section.type)} />
                  </span>
                  <span className="type-meta num">
                    {sectionItemCount(section)}
                    {periodLabel ? ` · ${periodLabel}` : ""}
                  </span>
                </summary>
                <div className="pt-4">{renderSection(section, handleViewIndicatorSource, handleViewEvidenceSource)}</div>
              </details>
            </Fragment>
          );
        }
        return (
          <Fragment key={`${section.type}-${index}`}>
            {startsLayer && <LayerDivider layer={layer} />}
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                <div className="flex flex-col gap-1">
                  <KindMarker kind={sectionKind(section.type)} />
                  <h3 className="type-subsection-title">{section.title}</h3>
                </div>
                {periodLabel && <span className="type-meta num">{periodLabel}</span>}
              </div>
              {renderSection(section, handleViewIndicatorSource, handleViewEvidenceSource)}
            </div>
          </Fragment>
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
