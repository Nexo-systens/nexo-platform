import { Check } from "lucide-react";

import { ChangeIndicator } from "@/components/shared/ChangeIndicator";
import { KindMarker } from "@/components/shared/KindMarker";
import { SemanticBadge } from "@/components/shared/SemanticBadge";
import { cn } from "@/lib/utils";
import { formatIndicatorValue } from "@/lib/format-indicator";
import { describeMetricChange, formatMetricValue } from "@/modules/analysis/lib/metric-change";
import { ScenarioImpactTable } from "@/modules/scenarios/components/ScenarioImpactTable";
import { formatScenarioMetricDelta } from "@/modules/scenarios/lib/scenario-language";
import { ProductFrame } from "@/modules/site/components/SitePrimitives";
import {
  DEMO_COMPANY,
  DEMO_HEADLINE,
  DEMO_PENDING_DECISIONS,
  DEMO_PERIOD,
  DEMO_PORTFOLIO,
  DEMO_SCENARIO,
  DEMO_SCENARIO_ASSUMPTION,
  DEMO_SCENARIO_KEYS,
  DEMO_SIGNALS,
  DEMO_TRAJECTORY,
} from "@/modules/site/lib/demo-company";

/**
 * Mission 205 — recortes das telas reais da NEXO, com os mesmos
 * componentes do produto (`ChangeIndicator`, `KindMarker`,
 * `SemanticBadge`, `ScenarioImpactTable`) e dados fictícios. Server
 * Components: nenhum JavaScript vai ao navegador por causa deles.
 */

function FrameEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="type-eyebrow">{children}</p>;
}

/** Visão geral da empresa: situação do período, métricas de manchete e o que pede decisão. */
export function SituationFrame({ className }: { className?: string }) {
  return (
    <ProductFrame
      context={`${DEMO_COMPANY} · Visão geral`}
      label="Visão geral de uma empresa na NEXO:"
      description="situação do período comparada ao anterior, quatro métricas com variação, o sinal mais grave e as decisões pendentes."
      className={className}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <FrameEyebrow>
            Situação · {DEMO_PERIOD.long} · comparada com {DEMO_PERIOD.previousLong}
          </FrameEyebrow>
          <p className="text-[1.0625rem] leading-snug font-semibold tracking-tight text-balance text-foreground sm:text-[1.1875rem]">
            Desde {DEMO_PERIOD.previousLong}, 7 métricas pioraram e nenhuma melhorou. O EFOS identificou 5 sinais de atenção.
          </p>
        </div>

        <dl className="grid grid-cols-2 border-y border-border">
          {DEMO_HEADLINE.map((metric, index) => {
            const change = describeMetricChange(metric);
            return (
              <div
                key={metric.metricName}
                className={cn(
                  "flex flex-col gap-1.5 py-3.5",
                  index % 2 === 1 ? "border-l border-border pl-4" : "pr-4",
                  index >= 2 && "border-t border-border"
                )}
              >
                <dt className="type-meta">{metric.metricName}</dt>
                <dd className="flex flex-col gap-1">
                  <span className="num text-[1.375rem] leading-none font-semibold tracking-tight text-foreground sm:text-[1.5rem]">
                    {change.currentText}
                  </span>
                  <ChangeIndicator change={change} className="text-[0.75rem]" />
                </dd>
              </div>
            );
          })}
        </dl>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <KindMarker kind="evidence" />
            <p className="text-sm font-medium text-foreground">{DEMO_SIGNALS[0].title}</p>
            <SemanticBadge tone={DEMO_SIGNALS[0].severity.tone} className="w-fit">
              {DEMO_SIGNALS[0].severity.label}
            </SemanticBadge>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5 rounded-lg bg-surface-subtle px-4 py-3 sm:w-52">
            <KindMarker kind="decision" />
            <p className="flex items-baseline gap-2">
              <span className="num text-[1.625rem] leading-none font-semibold text-foreground">{DEMO_PENDING_DECISIONS}</span>
              <span className="text-[0.75rem] text-foreground-secondary">itens aguardam sua decisão</span>
            </p>
          </div>
        </div>
      </div>
    </ProductFrame>
  );
}

/** Visão executiva do portfólio: como cada empresa se moveu. */
export function PortfolioFrame({ className }: { className?: string }) {
  return (
    <ProductFrame
      context="Visão executiva"
      label="Visão executiva do portfólio na NEXO:"
      description="para cada empresa, o período analisado, a margem líquida com variação, a tendência, as decisões pendentes e o próximo passo."
      className={className}
    >
      <div className="flex flex-col gap-4">
        <p className="text-[0.9375rem] leading-snug font-semibold text-balance text-foreground">
          Das 3 empresas ativas, 1 piorou e 1 melhorou desde a análise anterior. 1 ainda não tem análise. 6 itens aguardam sua decisão.
        </p>
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {DEMO_PORTFOLIO.map((row) => {
            const change = row.netMargin ? describeMetricChange(row.netMargin) : undefined;
            return (
              <li key={row.company} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-foreground">{row.company}</span>
                  <span className="type-meta">
                    {row.stage}
                    {row.period ? ` · ${row.period}` : ""}
                  </span>
                </div>
                <div className="order-3 col-span-2 flex items-center gap-3 sm:order-none sm:col-span-1 sm:flex-col sm:items-end sm:gap-0.5">
                  {change ? (
                    <>
                      <span className="num text-sm font-semibold text-foreground">{change.currentText}</span>
                      <ChangeIndicator change={change} showWord={false} className="text-[0.75rem]" />
                    </>
                  ) : (
                    <span className="type-meta">Margem líquida —</span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <SemanticBadge tone={row.trend.tone}>{row.trend.label}</SemanticBadge>
                  <span className="text-[0.75rem] font-medium text-primary">
                    {row.next}
                    {row.pending ? ` · ${row.pending}` : ""}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </ProductFrame>
  );
}

const TRAJECTORY_TONE = { negative: "negative", neutral: "neutral" } as const;

/** Análise: trajetória por métrica e uma evidência com origem. */
export function EvidenceFrame({ className }: { className?: string }) {
  return (
    <ProductFrame
      context={`${DEMO_COMPANY} · Análise`}
      label="Análise financeira na NEXO:"
      description="trajetória de cada métrica ao longo dos períodos e uma evidência determinística com origem rastreável."
      className={className}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <FrameEyebrow>O que está mudando · trajetória financeira</FrameEyebrow>
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {DEMO_TRAJECTORY.map((row) => (
              <li key={row.metric} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-foreground">{row.metric}</span>
                  <span className="type-meta">{row.range}</span>
                </div>
                <SemanticBadge tone={TRAJECTORY_TONE[row.tone]} className="w-fit">
                  {row.state}
                </SemanticBadge>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1.5 border-l-2 border-kind-evidence pl-4">
          <KindMarker kind="evidence" />
          <p className="text-sm font-medium text-foreground">{DEMO_SIGNALS[0].title}</p>
          <p className="type-meta">{DEMO_SIGNALS[0].detail}</p>
          <span className="w-fit text-[0.75rem] font-medium text-primary underline underline-offset-4">Ver origem</span>
        </div>
      </div>
    </ProductFrame>
  );
}

/** Scenario Lab: a tabela real base × cenário × diferença. */
export function ScenarioFrame({ className }: { className?: string }) {
  return (
    <ProductFrame
      context={`${DEMO_COMPANY} · Scenario Lab`}
      label="Scenario Lab da NEXO:"
      description="simulação de redução de despesas operacionais com base atual, valor no cenário e diferença para EBITDA, EBIT, margem operacional e margem líquida."
      className={className}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FrameEyebrow>O que você está assumindo</FrameEyebrow>
          <p className="text-sm leading-relaxed text-foreground">{DEMO_SCENARIO_ASSUMPTION}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <FrameEyebrow>O que muda</FrameEyebrow>
          <div className="hidden sm:block">
            <ScenarioImpactTable metricKeys={DEMO_SCENARIO_KEYS} comparison={DEMO_SCENARIO} caption="Base atual, cenário e diferença" />
          </div>
          {/* Em telas estreitas, a mesma comparação em lista: a tabela do produto pede 32rem. */}
          <ul className="flex flex-col divide-y divide-border border-y border-border sm:hidden">
            {DEMO_SCENARIO_KEYS.map((key) => {
              const entry = DEMO_SCENARIO[key];
              if (entry.status !== "compared") return null;
              return (
                <li key={key} className="flex flex-col gap-1 py-2.5">
                  <span className="text-sm font-medium text-foreground">{entry.label}</span>
                  <span className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem]">
                    <span className="num text-muted-foreground">{formatIndicatorValue(entry.baselineValue, entry.unit)}</span>
                    <span aria-hidden="true" className="text-muted-foreground">→</span>
                    <span className="sr-only">com o cenário</span>
                    <span className="num font-semibold text-foreground">{formatIndicatorValue(entry.projectedValue, entry.unit)}</span>
                    <span className="num font-medium text-positive-soft-foreground">
                      {formatScenarioMetricDelta(entry.delta, entry.unit)} · melhora
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <SemanticBadge tone="warning" className="w-fit">
          Cenário hipotético — não é uma previsão
        </SemanticBadge>
      </div>
    </ProductFrame>
  );
}

const LIFECYCLE = ["Decidida", "Em execução", "Concluída", "Resultado", "Aprendizado"] as const;

/** Decision Center: uma decisão como objeto, da origem à execução. */
export function DecisionFrame({ className }: { className?: string }) {
  const current = 1;
  return (
    <ProductFrame
      context={`${DEMO_COMPANY} · Decisões`}
      label="Central de Decisões da NEXO:"
      description="uma decisão registrada pela empresa a partir de uma recomendação, com justificativa, responsável e a trilha decidida, em execução, concluída, resultado e aprendizado."
      className={className}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[0.9375rem] font-semibold text-foreground">Revisar a estrutura de custos operacionais</p>
            <SemanticBadge tone="info">Em execução</SemanticBadge>
          </div>
          <p className="type-meta">A partir da recomendação “Revisar a estrutura de custos operacionais” · leitura da IA aceita parcialmente</p>
        </div>

        <ol className="grid grid-cols-5 gap-1.5" aria-label="Trilha da decisão">
          {LIFECYCLE.map((step, index) => (
            <li key={step} className="flex flex-col gap-1.5">
              <span className={cn("h-1 rounded-full", index <= current ? "bg-primary" : "bg-surface-sunken")} />
              <span className={cn("text-[0.625rem] leading-tight sm:text-[0.6875rem]", index <= current ? "font-medium text-foreground" : "text-muted-foreground")}>
                {step}
              </span>
            </li>
          ))}
        </ol>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-[0.8125rem] sm:grid-cols-3">
          <div>
            <dt className="type-eyebrow">Responsável</dt>
            <dd className="text-foreground">Diretoria financeira</dd>
          </div>
          <div>
            <dt className="type-eyebrow">Iniciada em</dt>
            <dd className="num text-foreground">02/09/2026</dd>
          </div>
          <div>
            <dt className="type-eyebrow">Prazo alvo</dt>
            <dd className="num text-foreground">30/09/2026</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-1 border-l-2 border-kind-decision pl-4">
          <FrameEyebrow>Justificativa da empresa</FrameEyebrow>
          <p className="text-[0.8125rem] leading-relaxed text-foreground-secondary">
            Despesas administrativas cresceram acima da receita por três períodos seguidos.
          </p>
        </div>
      </div>
    </ProductFrame>
  );
}

/** Resultado e aprendizado: o que aconteceu depois e o conhecimento formado. */
export function LearningFrame({ className }: { className?: string }) {
  const before = formatMetricValue(21, "days");
  const after = formatMetricValue(33, "days");
  return (
    <ProductFrame
      context={`${DEMO_COMPANY} · Conhecimento`}
      label="Resultado e aprendizado na NEXO:"
      description="resultado observado de uma decisão concluída, o efeito nos números antes e depois e o conhecimento formado a partir de decisões independentes."
      className={className}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <FrameEyebrow>Resultado observado</FrameEyebrow>
            <SemanticBadge tone="positive">Positivo</SemanticBadge>
          </div>
          <p className="text-sm leading-relaxed text-foreground">
            Prazo médio de pagamento subiu para 33 dias e o caixa operacional voltou a ficar positivo.
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg bg-surface-subtle px-4 py-3 text-[0.8125rem]">
            <span className="text-foreground-secondary">Prazo Médio de Pagamento</span>
            <span className="num text-muted-foreground">{before}</span>
            <span aria-hidden="true" className="text-muted-foreground">→</span>
            <span className="sr-only">depois</span>
            <span className="num font-semibold text-foreground">{after}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <FrameEyebrow>Conhecimento formado</FrameEyebrow>
            <SemanticBadge tone="info">Evidência favorável</SemanticBadge>
            <SemanticBadge>Confiança média</SemanticBadge>
          </div>
          <p className="text-sm leading-relaxed text-foreground">
            2 decisões independentes desta empresa foram avaliadas como resultado positivo — padrão histórico recorrente, nunca prova de que uma
            decisão futura terá o mesmo resultado.
          </p>
        </div>
      </div>
    </ProductFrame>
  );
}

/** Executive Chat: uma consulta e a resposta em camadas. */
export function InquiryFrame({ className }: { className?: string }) {
  return (
    <ProductFrame
      context={`${DEMO_COMPANY} · Executive Chat`}
      label="Executive Chat da NEXO:"
      description="uma pergunta executiva e a resposta separada em fatos considerados, interpretação e hipótese a validar, com a indicação de que está fundamentada no contexto atual."
      className={className}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <FrameEyebrow>Consulta</FrameEyebrow>
          <p className="text-[1.0625rem] font-semibold text-foreground">O que mais piorou recentemente?</p>
        </div>
        <div className="flex flex-col gap-4 border-l-2 border-dotted border-kind-interpretation pl-4">
          <SemanticBadge tone="positive" className="w-fit">
            Fundamentado no contexto atual
          </SemanticBadge>
          <p className="text-sm leading-relaxed text-foreground">
            A Margem Líquida caiu 5,69 p.p. desde {DEMO_PERIOD.previousLong} e ficou negativa em -4,26%. A queda se sustenta há 4 períodos e é o sinal mais
            grave desta análise.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <KindMarker kind="evidence" />
              <p className="text-[0.8125rem] leading-relaxed text-foreground-secondary">
                Margem Líquida: -4,26% (antes 1,43%). Margem Bruta: 27,35% (antes 31,20%).
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <KindMarker kind="hypothesis" />
                <SemanticBadge>Confiança baixa</SemanticBadge>
              </div>
              <p className="text-[0.8125rem] leading-relaxed text-foreground-secondary">
                Se as condições operacionais se mantiverem, a queda pode continuar. Validar com o próximo fechamento.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-surface-subtle px-4 py-2.5 text-[0.75rem] text-foreground-secondary">
          <Check className="size-3.5 shrink-0 text-positive" aria-hidden="true" />
          Ações sugeridas só acontecem com a sua confirmação.
        </div>
      </div>
    </ProductFrame>
  );
}
