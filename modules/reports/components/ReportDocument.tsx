import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { KindMarker } from "@/components/shared/KindMarker";
import { UnavailableValue } from "@/components/shared/UnavailableValue";
import { Button } from "@/components/ui/button";
import { formatPeriod } from "@/modules/analysis/lib/executive-language";
import { formatDateTime } from "@/modules/dashboard/lib/format";
import { DiagnosisBasis, ExecutiveDiagnosisView } from "@/modules/decisions/components/ExecutiveDiagnosisView";
import { companyWorkspaceHref } from "@/modules/companies/lib/workspace-views";
import { formatCnpj } from "@/modules/companies/utils/cnpj";
import { ScenarioImpactTable } from "@/modules/scenarios/components/ScenarioImpactTable";

import { capitalize, describeComparison, describeSignals, describeVersion } from "../lib/report-language";
import type { FormalResult, ReportReading, UnknownKind } from "../lib/report-reading";

import { ReportAnnex } from "./ReportAnnex";
import { ReportPrintButton } from "./ReportPrintButton";
import { Basis, DocBlock, DocItem, DocList, DocSection } from "./report-primitives";

/**
 * Mission 208 — o relatório executivo como documento (D-133).
 *
 * Ordem de leitura: situação → movimento → indicadores em foco →
 * evidências → interpretação do EFOS → leitura da IA → recomendações →
 * cenários → decisões → resultados → aprendizados → o que não se sabe →
 * anexo. Cada seção só existe quando o objeto canônico que a sustenta
 * existe — nenhuma seção vazia para "completar" a estrutura. Os números
 * chegam formatados das funções canônicas; aqui nada é calculado.
 */

export const REPORT_DOCUMENT_ID = "relatorio-executivo";

interface ReportCompany {
  readonly id: string;
  readonly razao_social: string;
  readonly cnpj: string;
}

interface SectionSpec {
  readonly id: string;
  readonly title: string;
  readonly render: (number: number) => ReactNode;
}

const UNKNOWN_KIND_LABELS: Readonly<Record<UnknownKind, string>> = {
  indicator: "Indicador",
  comparison: "Comparação",
  stage: "Análise",
  ai: "Executive AI",
  result: "Resultado",
};

function FormalResultTable({ result, caption }: { result: FormalResult; caption: string }) {
  return (
    <div className="report-block flex flex-col gap-2">
      <KindMarker kind="outcome" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border-strong text-left">
              <th scope="col" className="py-2 pr-4 type-meta font-medium">Indicador</th>
              <th scope="col" className="py-2 pr-4 text-right type-meta font-medium">Esperado</th>
              <th scope="col" className="py-2 pr-4 text-right type-meta font-medium">
                Observado{result.observedPeriod ? ` (${result.observedPeriod.short})` : ""}
              </th>
              <th scope="col" className="py-2 text-right type-meta font-medium">Leitura</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {result.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="py-2.5 pr-4 text-left font-medium text-foreground">{row.label}</th>
                {row.expectedText && row.observedText ? (
                  <>
                    <td className="num whitespace-nowrap py-2.5 pr-4 text-right text-foreground-secondary">{row.expectedText}</td>
                    <td className="num whitespace-nowrap py-2.5 pr-4 text-right font-semibold text-foreground">{row.observedText}</td>
                    <td className="py-2.5 text-right text-foreground-secondary">{row.alignmentLabel}</td>
                  </>
                ) : (
                  <td colSpan={3} className="py-2.5 text-right">
                    <UnavailableValue compact />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="type-meta max-w-3xl text-pretty">{result.disclaimer}</p>
    </div>
  );
}

export function ReportDocument({ company, reading }: { company: ReportCompany; reading: ReportReading }) {
  // Período de um único dia (só Balanço, D-111): é uma posição na data-base, não um intervalo.
  const singleDay = reading.period !== undefined && reading.period.startDate.slice(0, 10) === reading.period.endDate.slice(0, 10);
  const periodTitle = !reading.periodLabel
    ? "Período não determinado"
    : singleDay
      ? `Posição em ${reading.periodLabel.long}`
      : capitalize(reading.periodLabel.long);
  const comparisonShort = reading.comparisonLabel?.short;
  const situation = reading.situation;
  const aiSummary = reading.aiReading?.diagnosis.diagnosis.executiveSummary;
  const hasEngineInference = reading.interpretations.length + reading.hypotheses.length > 0;
  const hasRecommendations =
    reading.recommendations.length + reading.proposals.length + reading.governedRecommendations.length > 0;
  const stateAsOf = formatDateTime(reading.stateAsOf);

  const specs: SectionSpec[] = [];

  specs.push({
    id: "situacao",
    title: "Situação executiva",
    render: (number) => (
      <DocSection id="situacao" number={number} title="Situação executiva" lead={describeSignals(reading)}>
        {situation && situation.headline.length > 0 && (
          <DocBlock kind="indicator">
            <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {situation.headline.map((metric) => (
                <div key={metric.name} className="report-block flex flex-col gap-1.5 bg-surface p-4">
                  <dt className="type-meta">{metric.name}</dt>
                  <dd className="flex flex-col gap-1">
                    {metric.valueText ? (
                      <span className="type-metric num">{metric.valueText}</span>
                    ) : (
                      <UnavailableValue compact />
                    )}
                    {metric.change && (metric.change.deltaText || metric.change.symbol) ? (
                      <span className="type-meta num">
                        <span aria-hidden="true">{metric.change.symbol} </span>
                        {metric.change.deltaText ?? metric.change.directionLabel}
                        {comparisonShort ? ` desde ${comparisonShort}` : ""}
                        {metric.change.desirabilityLabel ? ` · ${metric.change.desirabilityLabel}` : ""}
                      </span>
                    ) : metric.change ? (
                      <span className="type-meta">{capitalize(metric.change.directionLabel)}</span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </DocBlock>
        )}
        {aiSummary && reading.aiReading && (
          <DocBlock
            kind="interpretation"
            aside={`Leitura da Executive AI · gerada em ${formatDateTime(reading.aiReading.diagnosis.createdAt)}`}
          >
            <blockquote className="max-w-3xl border-l-2 border-dotted border-kind-interpretation pl-4 text-[1.0625rem] leading-relaxed text-pretty text-foreground">
              {aiSummary.statement}
            </blockquote>
            <DiagnosisBasis basis={aiSummary.basis} references={reading.aiReading.references} />
            <p className="type-meta">Interpretação gerada por IA sobre os números acima — não é fato contábil.</p>
          </DocBlock>
        )}
      </DocSection>
    ),
  });

  if (reading.comparison.outcome === "resolved" && reading.movement.length + reading.unchangedMetrics.length + reading.availabilityChanges.length > 0) {
    const previous = reading.comparisonLabel;
    specs.push({
      id: "movimento",
      title: "Movimento financeiro",
      render: (number) => (
        <DocSection
          id="movimento"
          number={number}
          title="Movimento financeiro"
          lead={`O que mudou de ${previous?.long ?? "período anterior"} para ${reading.periodLabel?.long ?? "este período"}, nos indicadores calculados pelo EFOS. Melhora e piora aparecem só para indicadores com direção definida; os demais ficam sem juízo.`}
        >
          {reading.movement.length > 0 && (
            <DocBlock kind="indicator">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-sm">
                  <caption className="sr-only">
                    Variação dos indicadores entre {previous?.long} e {reading.periodLabel?.long}
                  </caption>
                  <thead>
                    <tr className="border-b border-border-strong text-left">
                      <th scope="col" className="py-2 pr-4 type-meta font-medium">Indicador</th>
                      <th scope="col" className="py-2 pr-4 text-right type-meta font-medium">{previous?.short ?? "Antes"}</th>
                      <th scope="col" className="py-2 pr-4 text-right type-meta font-medium">{reading.periodLabel?.short ?? "Agora"}</th>
                      <th scope="col" className="py-2 pr-4 text-right type-meta font-medium">Variação</th>
                      <th scope="col" className="py-2 text-right type-meta font-medium">Leitura</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reading.movement.map((change) => (
                      <tr key={change.metricName}>
                        <th scope="row" className="py-2.5 pr-4 text-left font-medium text-foreground">{change.metricName}</th>
                        <td className="num whitespace-nowrap py-2.5 pr-4 text-right text-foreground-secondary">{change.previousText}</td>
                        <td className="num whitespace-nowrap py-2.5 pr-4 text-right font-semibold text-foreground">{change.currentText}</td>
                        <td className="num whitespace-nowrap py-2.5 pr-4 text-right text-foreground">
                          <span aria-hidden="true">{change.symbol} </span>
                          {change.deltaText ?? change.directionLabel}
                          <span className="sr-only"> ({change.directionLabel})</span>
                        </td>
                        <td className="py-2.5 text-right text-foreground-secondary">{change.desirabilityLabel ?? "Sem juízo"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DocBlock>
          )}
          {(reading.unchangedMetrics.length > 0 || reading.availabilityChanges.length > 0) && (
            <div className="flex flex-col gap-1.5">
              {reading.unchangedMetrics.length > 0 && (
                <p className="type-meta text-pretty">
                  <span className="font-medium text-foreground-secondary">Sem variação: </span>
                  {reading.unchangedMetrics.join(", ")}.
                </p>
              )}
              {reading.availabilityChanges.map((change) => (
                <p key={change.metricName} className="type-meta text-pretty">
                  <span className="font-medium text-foreground-secondary">{change.metricName}: </span>
                  {change.directionLabel}.
                </p>
              ))}
            </div>
          )}
        </DocSection>
      ),
    });
  }

  if (reading.focusIndicators.length > 0) {
    specs.push({
      id: "indicadores",
      title: "Indicadores em foco",
      render: (number) => (
        <DocSection
          id="indicadores"
          number={number}
          title="Indicadores em foco"
          lead="Os indicadores que sustentam as evidências deste período. O catálogo completo está no anexo."
        >
          <DocList>
            {reading.focusIndicators.map((focus) => (
              <li key={focus.indicator.id} className="report-item grid gap-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">{focus.indicator.name}</p>
                  <Basis label="Citado em" items={focus.citedBy} />
                </div>
                <div className="flex flex-col gap-0.5 sm:items-end">
                  {focus.valueText ? (
                    <span className="num text-lg font-semibold tracking-tight text-foreground">{focus.valueText}</span>
                  ) : (
                    <UnavailableValue compact />
                  )}
                  {focus.change?.deltaText && (
                    <span className="type-meta num">
                      <span aria-hidden="true">{focus.change.symbol} </span>
                      {focus.change.deltaText}
                      {comparisonShort ? ` desde ${comparisonShort}` : ""}
                      {focus.change.desirabilityLabel ? ` · ${focus.change.desirabilityLabel}` : ""}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </DocList>
        </DocSection>
      ),
    });
  }

  const evidenceGroups = [
    { key: "attention", title: "Sinais de atenção", items: reading.evidence.attention },
    { key: "favorable", title: "Sinais favoráveis", items: reading.evidence.favorable },
    { key: "information", title: "Informações", items: reading.evidence.information },
  ].filter((group) => group.items.length > 0);
  if (evidenceGroups.length > 0) {
    specs.push({
      id: "evidencias",
      title: "Evidências",
      render: (number) => (
        <DocSection
          id="evidencias"
          number={number}
          title="Evidências"
          lead="Fatos identificados por regras determinísticas sobre os números do período, cada um com origem rastreável."
        >
          {evidenceGroups.map((group) => (
            <DocBlock key={group.key} kind="evidence" title={`${group.title} · ${group.items.length}`}>
              <DocList>
                {group.items.map((item) => (
                  <DocItem
                    key={item.id}
                    title={item.title}
                    meta={[
                      item.severityLabel,
                      item.confidenceLabel,
                      item.indicatorName && `Indicador: ${item.indicatorName}`,
                      item.observedPeriod && `Período observado: ${item.observedPeriod.long}`,
                    ]}
                  >
                    <p className="type-body text-pretty">{item.description}</p>
                  </DocItem>
                ))}
              </DocList>
            </DocBlock>
          ))}
        </DocSection>
      ),
    });
  }

  if (hasEngineInference) {
    specs.push({
      id: "interpretacao",
      title: "Interpretação do EFOS",
      render: (number) => (
        <DocSection
          id="interpretacao"
          number={number}
          title="Interpretação do EFOS"
          lead="Leituras determinísticas que agrupam as evidências em situações e conclusões prováveis. Apoio à decisão — não são fatos contábeis."
        >
          {reading.interpretations.length > 0 && (
            <DocBlock kind="interpretation">
              <DocList>
                {reading.interpretations.map((item) => (
                  <DocItem key={item.id} title={item.title} meta={item.qualifiers}>
                    <p className="type-body text-pretty">{item.description}</p>
                    <Basis items={item.basis} />
                  </DocItem>
                ))}
              </DocList>
            </DocBlock>
          )}
          {reading.hypotheses.length > 0 && (
            <DocBlock kind="hypothesis">
              <DocList>
                {reading.hypotheses.map((item) => (
                  <DocItem key={item.id} title={item.title} meta={item.qualifiers}>
                    <p className="type-body text-pretty">{item.description}</p>
                    <Basis items={item.basis} />
                  </DocItem>
                ))}
              </DocList>
            </DocBlock>
          )}
        </DocSection>
      ),
    });
  }

  if (reading.aiReading) {
    const ai = reading.aiReading;
    specs.push({
      id: "leitura-ia",
      title: "Leitura da Executive AI",
      render: (number) => (
        <DocSection
          id="leitura-ia"
          number={number}
          title="Leitura da Executive AI"
          lead={`Gerada em ${formatDateTime(ai.diagnosis.createdAt)} sobre esta análise e guardada como foi validada — o relatório não a refaz.${
            ai.readingsCount > 1 ? ` Há ${ai.readingsCount} leituras para esta análise; esta é a mais recente.` : ""
          }`}
        >
          <ExecutiveDiagnosisView diagnosis={ai.diagnosis.diagnosis} references={ai.references} embedded />
        </DocSection>
      ),
    });
  }

  if (hasRecommendations) {
    specs.push({
      id: "recomendacoes",
      title: "Recomendações e encaminhamento",
      render: (number) => (
        <DocSection
          id="recomendacoes"
          number={number}
          title="Recomendações e encaminhamento"
          lead="O que o EFOS sugere avaliar e em que pé está cada prioridade apontada pela leitura da IA. Sugestão não é decisão: a decisão é sempre da empresa."
        >
          {reading.recommendations.length > 0 && (
            <DocBlock kind="recommendation" title="Recomendações do EFOS">
              <DocList>
                {reading.recommendations.map((item) => (
                  <DocItem key={item.id} title={item.title} meta={item.qualifiers}>
                    <p className="type-body text-pretty">{item.description}</p>
                    <p className="text-sm text-pretty text-foreground-secondary">
                      <span className="text-muted-foreground">Impacto esperado: </span>
                      {item.expectedImpact}
                    </p>
                    <Basis items={item.basis} />
                  </DocItem>
                ))}
              </DocList>
            </DocBlock>
          )}
          {reading.proposals.length > 0 && (
            <DocBlock kind="decision" title="Priorização proposta pelo EFOS" aside="Proposta — não é uma decisão da empresa">
              <DocList>
                {reading.proposals.map((item) => (
                  <DocItem key={item.id} title={item.title} meta={item.qualifiers}>
                    <p className="type-body text-pretty">{item.description}</p>
                  </DocItem>
                ))}
              </DocList>
            </DocBlock>
          )}
          {reading.governedRecommendations.length > 0 && (
            <DocBlock kind="recommendation" title="Encaminhamento das prioridades da leitura da IA" aside={`Estado em ${stateAsOf}`}>
              <DocList>
                {reading.governedRecommendations.map((item) => (
                  <DocItem
                    key={item.recommendationId}
                    title={item.rank !== undefined ? `${item.rank}. ${item.statement}` : item.statement}
                    meta={[item.categoryLabel, item.stateLabel]}
                  />
                ))}
              </DocList>
            </DocBlock>
          )}
        </DocSection>
      ),
    });
  }

  if (reading.scenarios.length > 0) {
    specs.push({
      id: "cenarios",
      title: "Cenários avaliados",
      render: (number) => (
        <DocSection
          id="cenarios"
          number={number}
          title="Cenários avaliados"
          lead="Hipóteses simuladas no Scenario Lab sobre os números deste período e que viraram decisão. Cenário não é previsão: mostra o efeito da hipótese sobre a base, nada mais."
        >
          {reading.scenarios.map((scenario) => (
            <DocBlock key={scenario.decisionId} kind="hypothesis" title={scenario.assumption} aside={`Base: ${scenario.period.long}`}>
              <p className="type-meta">
                Decisão registrada a partir deste cenário: <span className="text-foreground-secondary">{scenario.decisionTitle}</span>
                {scenario.alternative ? ` · Alternativa considerada e não escolhida: ${scenario.alternative}` : ""}
              </p>
              <ScenarioImpactTable
                metricKeys={scenario.metricKeys}
                comparison={scenario.comparison}
                caption={`Efeito do cenário "${scenario.assumption}" sobre os indicadores de ${scenario.period.long}`}
                baselineLabel="Base do período"
              />
            </DocBlock>
          ))}
        </DocSection>
      ),
    });
  }

  if (reading.decisions.length > 0) {
    specs.push({
      id: "decisoes",
      title: "Decisões",
      render: (number) => (
        <DocSection
          id="decisoes"
          number={number}
          title="Decisões"
          lead={`Decisões da empresa que nasceram desta análise — da leitura da IA ou de um cenário avaliado sobre este período. Execução e resultados no estado de ${stateAsOf}.`}
        >
          <ol className="flex flex-col gap-8">
            {reading.decisions.map((decision) => (
              <li key={decision.id} className="report-block flex flex-col gap-3 border-l-2 border-kind-decision pl-5">
                <div className="flex flex-col gap-1">
                  <KindMarker kind="companyDecision" />
                  <h3 className="type-subsection-title text-pretty">{decision.title}</h3>
                  <p className="type-meta text-pretty">{decision.originLabel}</p>
                </div>
                <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
                  <div className="flex flex-col gap-0.5">
                    <dt className="type-meta">Decidida em</dt>
                    <dd className="text-foreground">{formatDateTime(decision.decidedAt)}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="type-meta">Prioridade</dt>
                    <dd className="text-foreground">{decision.priorityLabel}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="type-meta">Execução</dt>
                    <dd className="text-foreground">
                      {decision.statusLabel}
                      {decision.completedAt
                        ? ` em ${formatDateTime(decision.completedAt)}`
                        : decision.startedAt
                          ? ` desde ${formatDateTime(decision.startedAt)}`
                          : ""}
                    </dd>
                  </div>
                </dl>
                {decision.rationale && (
                  <p className="type-body max-w-3xl text-pretty">
                    <span className="text-muted-foreground">Justificativa: </span>
                    {decision.rationale}
                  </p>
                )}
                {decision.outcomes.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <KindMarker kind="outcome" />
                    <ul className="flex flex-col gap-2">
                      {decision.outcomes.map((outcome) => (
                        <li key={outcome.id} className="report-item text-sm text-pretty text-foreground">
                          <span className="font-medium">{outcome.statusLabel}</span>
                          <span className="text-muted-foreground"> · registrado em {formatDateTime(outcome.observedAt)} — </span>
                          {outcome.description}
                          {outcome.expectedResult && (
                            <span className="text-muted-foreground"> (esperado: {outcome.expectedResult})</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {decision.formalResult && (
                  <FormalResultTable result={decision.formalResult} caption={`Esperado e observado para a decisão "${decision.title}"`} />
                )}
                {decision.outcomes.length === 0 && !decision.formalResult && (
                  <p className="type-meta">Nenhum resultado registrado até {stateAsOf}.</p>
                )}
              </li>
            ))}
          </ol>
        </DocSection>
      ),
    });
  }

  if (reading.outcomesInPeriod.length > 0) {
    specs.push({
      id: "resultados",
      title: "Resultados observados neste período",
      render: (number) => (
        <DocSection
          id="resultados"
          number={number}
          title="Resultados observados neste período"
          lead="Resultados de decisões anteriores medidos com os números deste período. É associação no tempo: não prova que a decisão causou a variação."
        >
          {reading.outcomesInPeriod.map((entry) => (
            <DocBlock
              key={entry.observationId}
              kind="outcome"
              title={entry.decisionTitle}
              aside={[
                entry.decidedAt && `Decidida em ${formatDateTime(entry.decidedAt)}`,
                entry.baselinePeriod && entry.observationPeriod && `${entry.baselinePeriod.short} → ${entry.observationPeriod.short}`,
              ]
                .filter(Boolean)
                .join(" · ")}
              className="report-block"
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] border-collapse text-sm">
                  <caption className="sr-only">{`Antes e depois da decisão "${entry.decisionTitle}"`}</caption>
                  <thead>
                    <tr className="border-b border-border-strong text-left">
                      <th scope="col" className="py-2 pr-4 type-meta font-medium">Indicador</th>
                      <th scope="col" className="py-2 pr-4 text-right type-meta font-medium">Antes</th>
                      <th scope="col" className="py-2 pr-4 text-right type-meta font-medium">Depois</th>
                      <th scope="col" className="py-2 text-right type-meta font-medium">Variação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {entry.metrics.map((metric) => (
                      <tr key={metric.name}>
                        <th scope="row" className="py-2.5 pr-4 text-left font-medium text-foreground">{metric.name}</th>
                        <td className="num whitespace-nowrap py-2.5 pr-4 text-right text-foreground-secondary">{metric.beforeText}</td>
                        <td className="num whitespace-nowrap py-2.5 pr-4 text-right font-semibold text-foreground">{metric.afterText}</td>
                        <td className="num whitespace-nowrap py-2.5 text-right text-foreground">
                          <span aria-hidden="true">{metric.change.symbol} </span>
                          {metric.change.deltaText ?? metric.change.directionLabel}
                          {metric.change.desirabilityLabel ? ` · ${metric.change.desirabilityLabel}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {entry.formalResult && (
                <FormalResultTable result={entry.formalResult} caption={`Esperado e observado para a decisão "${entry.decisionTitle}"`} />
              )}
            </DocBlock>
          ))}
        </DocSection>
      ),
    });
  }

  if (reading.knowledge.length > 0) {
    specs.push({
      id: "aprendizados",
      title: "Aprendizados",
      render: (number) => (
        <DocSection
          id="aprendizados"
          number={number}
          title="Aprendizados"
          lead="Conhecimento governado que a empresa já formou a partir das decisões deste relatório e de seus resultados. O relatório não cria conhecimento."
        >
          <DocBlock kind="learning">
            <DocList>
              {reading.knowledge.map((item) => (
                <DocItem
                  key={item.id}
                  title={item.statement}
                  meta={[item.categoryLabel, `Formado em ${formatDateTime(item.formedAt)}`]}
                >
                  <Basis label="A partir de" items={item.originDecisions} />
                </DocItem>
              ))}
            </DocList>
          </DocBlock>
        </DocSection>
      ),
    });
  }

  if (reading.unknowns.length > 0) {
    specs.push({
      id: "nao-se-sabe",
      title: "O que ainda não se sabe",
      render: (number) => (
        <DocSection
          id="nao-se-sabe"
          number={number}
          title="O que ainda não se sabe"
          lead="Ausências reais deste relatório. Nada aqui foi preenchido com zero ou estimativa."
        >
          <DocList>
            {reading.unknowns.map((item) => (
              <li key={item.id} className="report-item grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
                <span className="type-eyebrow pt-0.5">{UNKNOWN_KIND_LABELS[item.kind]}</span>
                <p className="text-sm text-pretty text-foreground">{item.text}</p>
              </li>
            ))}
          </DocList>
        </DocSection>
      ),
    });
  }

  return (
    <article id={REPORT_DOCUMENT_ID} aria-labelledby="relatorio-titulo" className="report-document mx-auto flex w-full max-w-[60rem] flex-col gap-12">
      <header className="report-keep flex flex-col gap-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="type-eyebrow">Relatório executivo</p>
            <h1 id="relatorio-titulo" className="type-page-title text-balance">
              {company.razao_social}
            </h1>
            <p className="text-[1.375rem] leading-tight font-medium tracking-tight text-foreground-secondary">{periodTitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <ReportPrintButton documentId={REPORT_DOCUMENT_ID} />
            <Button variant="ghost" size="sm" render={<Link href={companyWorkspaceHref(company.id, "visao-geral")} />} nativeButton={false}>
              Abrir empresa
            </Button>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <dt className="type-meta">Período analisado</dt>
            <dd className="text-sm text-foreground">
              {!reading.periodLabel ? "Não determinado" : singleDay ? `Data-base ${reading.periodLabel.long}` : capitalize(reading.periodLabel.long)}
              {reading.period && !singleDay && (
                <span className="num block text-[0.75rem] text-muted-foreground">{formatPeriod(reading.period)}</span>
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="type-meta">Comparado com</dt>
            <dd className="text-sm text-foreground">{capitalize(describeComparison(reading.comparison, reading.comparisonLabel))}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="type-meta">Gerado em</dt>
            <dd className="num text-sm text-foreground">{formatDateTime(reading.generatedAt)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="type-meta">Versão</dt>
            <dd className="text-sm text-foreground">
              {describeVersion(reading.version, formatDateTime)}
              {reading.version.state === "earlier" && (
                <Link
                  href={`/reports/${reading.version.latestExecutionId}`}
                  className="block text-[0.75rem] text-primary underline-offset-4 hover:underline print:hidden"
                >
                  Abrir a versão mais recente
                </Link>
              )}
            </dd>
          </div>
        </dl>

        <p className="type-meta max-w-3xl text-pretty">
          <span className="font-medium text-foreground-secondary">{company.razao_social}</span>
          <span className="num"> · CNPJ {formatCnpj(company.cnpj)}</span>. Registro imutável da análise deste período: o que o EFOS
          sabia quando ela foi executada. Uma nova análise gera um novo relatório; este não muda. Decisões, resultados e aprendizados
          ligados a ele mostram o estado em {stateAsOf}.
        </p>

        {specs.length > 1 && (
          <nav aria-label="Seções do relatório" className="print:hidden">
            <ol className="flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem]">
              {specs.map((spec, index) => (
                <li key={spec.id}>
                  <a href={`#${spec.id}`} className="text-foreground-secondary underline-offset-4 hover:text-primary hover:underline">
                    <span className="num text-muted-foreground">{String(index + 1).padStart(2, "0")}</span> {spec.title}
                  </a>
                </li>
              ))}
              <li>
                <a href="#anexo" className="text-foreground-secondary underline-offset-4 hover:text-primary hover:underline">
                  Anexo
                </a>
              </li>
            </ol>
          </nav>
        )}
      </header>

      {specs.map((spec, index) => (
        <Fragment key={spec.id}>{spec.render(index + 1)}</Fragment>
      ))}

      <ReportAnnex reading={reading} />
    </article>
  );
}
