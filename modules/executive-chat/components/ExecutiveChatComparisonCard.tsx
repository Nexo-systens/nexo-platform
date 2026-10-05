"use client";

import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ExecutiveChatResolvedAction } from "@/efos/application/executive-chat";
import type { ExecutiveScenarioComparison } from "@/efos/application/scenario-simulation";
import { formatIndicatorValue } from "@/lib/format-indicator";
import { cn } from "@/lib/utils";
import { compareScenariosAction, type ScenarioRequest } from "@/modules/scenarios/actions/scenario-simulation.actions";
import { ScenarioDecisionForm } from "@/modules/scenarios/components/ScenarioDecisionForm";
import { SCENARIO_IMPACT_TONE_CLASSNAME, formatScenarioMetricDelta } from "@/modules/scenarios/lib/scenario-language";
import type { ScenarioBaselineIdentity } from "@/modules/scenarios/lib/scenarioBaselineIdentity";

import { describeChatComparisonAction } from "../lib/chatActionPresentation";
import { toScenarioRequest } from "../lib/toScenarioRequest";
import { ChatDecisionRecorded, ChatProposalWithoutBaseline } from "./ChatDecisionNotes";

import { companyWorkspaceHref } from "@/modules/companies/lib/workspace-views";

/**
 * Mission 190 — Conversational Scenario Comparison.
 *
 * Renderiza uma ação `PREPARE_SCENARIO_COMPARISON` já resolvida/validada
 * (`ExecutiveChatActionCard` delega aqui). Mesma disciplina de
 * confirmação de `ExecutiveChatActionCard` (Seção 12): exibe as DUAS
 * alternativas estruturadas exatas (Seção 12/45 — nunca a prosa do
 * modelo) e só executa após um clique explícito.
 *
 * **Invariante do mesmo baseline (Seção 9), garantido por construção**:
 * uma ÚNICA chamada a `compareScenariosAction()` (Mission 183) — nunca
 * duas chamadas independentes a `simulateScenarioAction()` — porque
 * `compareScenariosAction()` já resolve `resolveScenarioBaseline()`
 * EXATAMENTE UMA VEZ internamente e repassa o MESMO `financialModel`/
 * `period` para as duas simulações (ver `scenario-simulation.actions.ts`,
 * Mission 183, inalterado). Este componente nunca resolve baseline ele
 * mesmo, nunca chama o simulador diretamente — apenas monta os dois
 * `ScenarioRequest` (via `toScenarioRequest()`, o MESMO conversor de
 * `PREPARE_OPERATING_COST_SCENARIO`/`PREPARE_COLLECTION_PERIOD_SCENARIO`,
 * Mission 189 — nunca duplicado) e delega tudo mais ao servidor.
 *
 * A ordem A/B exibida é sempre a MESMA ordem já resolvida/confirmada
 * (Seção 20/32) — nunca reordenada por "qualidade percebida".
 *
 * Nenhum vencedor/pontuação em lugar algum (Seção 11/16) — apenas a
 * apresentação já canônica de `ExecutiveScenarioComparison.metrics`
 * (união causal, Mission 183), nunca uma segunda lógica de comparação.
 *
 * Mission 210 (D-135): a comparação leva a âncora financeira da resposta
 * (recusa se a análise mudou). Depois de comparar, a pessoa pode levar A ou
 * B para decisão — a mesma escolha explícita do Scenario Lab, pelo mesmo
 * `ScenarioDecisionForm`, com a outra alternativa guardada só como
 * contexto e `proposedBy: "executive-chat"`. Nenhum vencedor sugerido.
 */
export function ExecutiveChatComparisonCard({
  companyId,
  action,
  baselineIdentity,
}: {
  companyId: string;
  action: Extract<ExecutiveChatResolvedAction, { kind: "comparison" }>;
  baselineIdentity?: ScenarioBaselineIdentity;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [comparison, setComparison] = useState<ExecutiveScenarioComparison | undefined>();
  const [comparedRequests, setComparedRequests] = useState<readonly [ScenarioRequest, ScenarioRequest] | undefined>();
  const [decisionSlot, setDecisionSlot] = useState<"A" | "B" | undefined>();
  const [decided, setDecided] = useState(false);

  const { title, alternativeADescription, alternativeBDescription } = describeChatComparisonAction(action);

  async function handleConfirm() {
    if (submitting || !baselineIdentity) return;
    setSubmitting(true);
    setError(undefined);
    setComparison(undefined);

    try {
      const requestA = toScenarioRequest(action.alternativeA);
      const requestB = toScenarioRequest(action.alternativeB);
      const result = await compareScenariosAction({
        companyId,
        scenarios: [requestA, requestB],
        expectedBaselineIdentity: baselineIdentity,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setComparison(result.comparison);
      setComparedRequests([requestA, requestB]);
    } catch {
      setError("Erro inesperado ao comparar os cenários. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
      <span className="text-xs font-medium text-foreground">{title}</span>
      <p className="text-xs text-muted-foreground">{action.reason}</p>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5 rounded-md border border-border p-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">A</span>
          <span className="text-sm text-foreground">{alternativeADescription}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-md border border-border p-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">B</span>
          <span className="text-sm text-foreground">{alternativeBDescription}</span>
        </div>
      </div>

      {!comparison && !baselineIdentity && <ChatProposalWithoutBaseline />}

      {!comparison && baselineIdentity && (
        <Button variant="outline" size="sm" className="w-fit gap-1.5" onClick={handleConfirm} disabled={submitting}>
          {submitting && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          {submitting ? "Comparando..." : "Comparar cenários"}
        </Button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {comparison && (
        <div className="flex flex-col gap-2 border-t border-border pt-2">
          {comparison.metrics.map((metric) => {
            const [entryA, entryB] = metric.perScenario;
            return (
              <div key={metric.metricKey} className="rounded-md border border-border p-2">
                <span className="text-xs font-medium text-foreground">{metric.label}</span>
                <div className="mt-1 grid gap-1 sm:grid-cols-2">
                  {[entryA, entryB].map((entry, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{index === 0 ? "A" : "B"}</span>
                      {!entry || entry.status === "unavailable" ? (
                        <span className="text-muted-foreground">Indisponível</span>
                      ) : (
                        <span className={cn("font-medium tabular-nums", SCENARIO_IMPACT_TONE_CLASSNAME[entry.impact])}>
                          {formatIndicatorValue(entry.projectedValue, metric.unit)} ({formatScenarioMetricDelta(entry.delta, metric.unit)})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <Badge variant="outline" className="w-fit border-warning/30 bg-warning/10 text-warning">
            Comparação hipotética — nenhum vencedor é escolhido automaticamente
          </Badge>
          <p className="text-xs text-muted-foreground">{comparison.disclaimer}</p>

          {decided ? (
            <ChatDecisionRecorded companyId={companyId} />
          ) : decisionSlot && comparedRequests && baselineIdentity ? (
            <ScenarioDecisionForm
              companyId={companyId}
              evaluatedBaselineIdentity={baselineIdentity}
              request={decisionSlot === "A" ? comparedRequests[0] : comparedRequests[1]}
              alternative={decisionSlot === "A" ? comparedRequests[1] : comparedRequests[0]}
              assumptionDescription={decisionSlot === "A" ? alternativeADescription : alternativeBDescription}
              alternativeDescription={decisionSlot === "A" ? alternativeBDescription : alternativeADescription}
              proposedBy="executive-chat"
              onCreated={() => {
                setDecisionSlot(undefined);
                setDecided(true);
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="w-fit" onClick={() => setDecisionSlot("A")}>
                Levar A para decisão
              </Button>
              <Button variant="outline" size="sm" className="w-fit" onClick={() => setDecisionSlot("B")}>
                Levar B para decisão
              </Button>
              <Button variant="ghost" size="sm" className="w-fit gap-1" render={<Link href={companyWorkspaceHref(companyId, "cenarios")} />} nativeButton={false}>
                Ver no Scenario Lab completo
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
