import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ChangeIndicator } from "@/components/shared/ChangeIndicator";
import { KindMarker } from "@/components/shared/KindMarker";
import { SemanticBadge } from "@/components/shared/SemanticBadge";
import { UnavailableValue } from "@/components/shared/UnavailableValue";
import { cn } from "@/lib/utils";
import type { ExecutiveSituation } from "@/modules/analysis/lib/executive-situation";
import { comparisonUnavailableText } from "@/modules/analysis/lib/temporal-comparison-language";
import { companyWorkspaceHref } from "@/modules/companies/lib/workspace-views";
import type { DecisionCenterSummary } from "@/modules/decisions/services/decision-center.service";
import { RECOMMENDATION_CATEGORY_LABELS } from "@/modules/decisions/lib/governanceLabels";
import { CompanyTimeline } from "@/modules/timeline/components/CompanyTimeline";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Frase de situação montada só de contagens que o EFOS produziu — nenhuma avaliação nova. */
function situationSentence(situation: ExecutiveSituation): string {
  const parts: string[] = [];
  if (situation.movement && situation.previousPeriod) {
    const { improved, worsened } = situation.movement;
    parts.push(
      improved + worsened === 0
        ? `Nenhuma métrica acompanhada pelo EFOS mudou de direção desde ${situation.previousPeriod.long}.`
        : improved === 0
          ? `Desde ${situation.previousPeriod.long}, ${plural(worsened, "métrica piorou", "métricas pioraram")} e nenhuma melhorou.`
          : worsened === 0
            ? `Desde ${situation.previousPeriod.long}, ${plural(improved, "métrica melhorou", "métricas melhoraram")} e nenhuma piorou.`
            : `Desde ${situation.previousPeriod.long}, ${plural(worsened, "métrica piorou", "métricas pioraram")} e ${plural(improved, "melhorou", "melhoraram")}.`
    );
  }
  const adverse = situation.signals.filter((signal) => !signal.favorable).length;
  parts.push(
    situation.signalsTotal === 0
      ? "O EFOS não identificou sinais nesta análise."
      : adverse === situation.signalsTotal
        ? `O EFOS identificou ${plural(adverse, "sinal de atenção", "sinais de atenção")}.`
        : `O EFOS identificou ${plural(situation.signalsTotal, "sinal", "sinais")}${adverse > 0 ? `, ${adverse} de atenção` : ""}.`
  );
  return parts.join(" ");
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="type-eyebrow">{children}</p>;
}

export function CompanyOverview({
  companyId,
  situation,
  decisions,
  hasDiagnosis,
  fullTimeline = false,
}: {
  companyId: string;
  situation: ExecutiveSituation | undefined;
  decisions: DecisionCenterSummary | null;
  hasDiagnosis: boolean;
  /** Linha do tempo completa em vez dos 6 eventos mais recentes. */
  fullTimeline?: boolean;
}) {
  const analysisHref = companyWorkspaceHref(companyId, "analise");
  const decisionsHref = companyWorkspaceHref(companyId, "decisoes");

  return (
    <div className="flex flex-col gap-10">
      {situation ? (
        <section aria-labelledby="situacao-titulo" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label>
              Situação{situation.period ? ` · ${situation.period.long}` : ""}
              {situation.previousPeriod
                ? ` · comparada com ${situation.previousPeriod.long}`
                : ` · ${(comparisonUnavailableText(situation.comparisonState) ?? "").toLowerCase()}`}
            </Label>
            <h2 id="situacao-titulo" className="max-w-3xl text-[1.3125rem] leading-snug font-semibold tracking-tight text-balance text-foreground">
              {situationSentence(situation)}
            </h2>
          </div>

          {situation.headline.length > 0 && (
            <dl className="grid grid-cols-2 border-y border-border lg:grid-cols-4">
              {situation.headline.map((metric, index) => (
                <div
                  key={metric.name}
                  className={cn(
                    "flex flex-col gap-2 py-5 pr-4",
                    index > 0 && "lg:border-l lg:border-border lg:pl-6",
                    index % 2 === 1 && "border-l border-border pl-4 lg:pl-6",
                    index >= 2 && "border-t border-border lg:border-t-0"
                  )}
                >
                  <dt className="type-meta">{metric.name}</dt>
                  <dd className="flex flex-col gap-1.5">
                    {metric.valueText ? (
                      <span className="num text-[1.75rem] leading-none font-semibold tracking-tight text-foreground">
                        {metric.valueText}
                      </span>
                    ) : (
                      <UnavailableValue reason="Dados insuficientes nesta análise." />
                    )}
                    {/* Mission 209: sem período anterior comparável, o cabeçalho já diz — aqui só a falta pontual de um indicador. */}
                    {metric.change ? (
                      <ChangeIndicator change={metric.change} />
                    ) : situation.comparisonState === "resolved" ? (
                      <span className="type-meta">Sem valor comparável no período anterior</span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {situation && (
          <section aria-labelledby="sinais-titulo" className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <KindMarker kind="evidence" />
                <h2 id="sinais-titulo" className="type-section-title">
                  O que os dados mostram
                </h2>
              </div>
              <Link href={analysisHref} className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary underline-offset-4 hover:underline">
                Análise completa <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
            {situation.signals.length === 0 ? (
              <p className="type-body">Nenhuma evidência determinística nesta análise.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border border-y border-border">
                {situation.signals.slice(0, 4).map((signal) => (
                  <li key={signal.id} className="flex items-start justify-between gap-4 py-3.5">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="text-sm font-medium text-foreground">{signal.title}</p>
                      <p className="type-meta line-clamp-1">{signal.description}</p>
                    </div>
                    <SemanticBadge tone={signal.favorable ? "positive" : signal.tag.tone}>
                      {signal.favorable ? "Favorável" : signal.tag.label}
                    </SemanticBadge>
                  </li>
                ))}
              </ul>
            )}
            {situation.signals.length > 4 && (
              <p className="type-meta">
                E mais {plural(situation.signals.length - 4, "sinal", "sinais")} na análise completa.
              </p>
            )}

            {situation.recommendations.length > 0 && (
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <KindMarker kind="recommendation" />
                  <h3 className="type-subsection-title">O que o EFOS recomenda</h3>
                </div>
                {situation.recommendations.slice(0, 2).map((recommendation) => (
                  <div key={recommendation.id} className="flex flex-col gap-1 border-l-2 border-dotted border-kind-recommendation pl-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{recommendation.title}</p>
                      <SemanticBadge tone={recommendation.tag.tone}>{recommendation.tag.label}</SemanticBadge>
                    </div>
                    {recommendation.expectedImpact && <p className="type-meta">{recommendation.expectedImpact}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <aside aria-labelledby="decisoes-resumo-titulo" className="flex h-fit flex-col gap-4 rounded-xl bg-surface-subtle p-5">
          <div className="flex flex-col gap-1">
            <KindMarker kind="decision" />
            <h2 id="decisoes-resumo-titulo" className="type-section-title">
              Decisões
            </h2>
          </div>
          {decisions && decisions.pending > 0 ? (
            <>
              <p className="flex items-baseline gap-2">
                <span className="num text-[2rem] leading-none font-semibold tracking-tight text-foreground">{decisions.pending}</span>
                <span className="type-body">{decisions.pending === 1 ? "item aguarda sua decisão" : "itens aguardam sua decisão"}</span>
              </p>
              <ul className="flex flex-col gap-2">
                {decisions.pendingItems.slice(0, 3).map((item) => (
                  <li key={item.recommendationId} className="flex flex-col gap-0.5">
                    <span className="type-eyebrow text-[0.625rem]">{RECOMMENDATION_CATEGORY_LABELS[item.category]}</span>
                    <span className="line-clamp-2 text-[0.8125rem] text-foreground">{item.statement}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : decisions ? (
            <p className="type-body">Nenhum item aguarda decisão agora.</p>
          ) : (
            <p className="type-body">
              {hasDiagnosis
                ? "Nenhuma decisão registrada ainda."
                : "Gere o diagnóstico executivo para transformar a análise em propostas para decidir."}
            </p>
          )}
          {decisions && (decisions.decided > 0 || decisions.concluded > 0) && (
            <p className="type-meta num">
              {plural(decisions.decided, "em execução", "em execução")} · {plural(decisions.concluded, "concluída", "concluídas")}
              {decisions.knowledgeCount > 0 ? ` · ${plural(decisions.knowledgeCount, "conhecimento formado", "conhecimentos formados")}` : ""}
            </p>
          )}
          <Link
            href={decisionsHref}
            className="inline-flex w-fit items-center gap-1 text-[0.8125rem] font-medium text-primary underline-offset-4 hover:underline"
          >
            {hasDiagnosis ? "Abrir Central de Decisões" : "Gerar diagnóstico"} <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </aside>
      </div>

      <section aria-labelledby="atividade-titulo" className="flex flex-col gap-4">
        <h2 id="atividade-titulo" className="type-section-title">
          {fullTimeline ? "Linha do tempo" : "Atividade recente"}
        </h2>
        <CompanyTimeline companyId={companyId} limit={fullTimeline ? undefined : 6} moreHref={`${companyWorkspaceHref(companyId, "visao-geral")}&linha=completa`} />
      </section>
    </div>
  );
}
