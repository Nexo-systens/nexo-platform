"use client";

import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ExecutiveChatResolvedAction } from "@/efos/application/executive-chat";
import type { ScenarioProjection } from "@/efos/application/scenario-simulation";
import { INDICATOR_DEFINITIONS } from "@/efos/engines/indicators";
import { cn } from "@/lib/utils";
import { simulateScenarioAction, type ScenarioRequest } from "@/modules/scenarios/actions/scenario-simulation.actions";
import { ScenarioDecisionForm } from "@/modules/scenarios/components/ScenarioDecisionForm";
import { PRIMARY_SCENARIO_METRIC_KEYS, SCENARIO_IMPACT_TONE_CLASSNAME, formatScenarioMetricDelta } from "@/modules/scenarios/lib/scenario-language";
import type { ScenarioBaselineIdentity } from "@/modules/scenarios/lib/scenarioBaselineIdentity";

import { EXECUTIVE_CHAT_NAVIGATION_VIEWS, EXECUTIVE_CHAT_NAVIGATION_TITLES, describeChatScenarioAction } from "../lib/chatActionPresentation";
import { toScenarioRequest } from "../lib/toScenarioRequest";
import { ChatDecisionRecorded, ChatProposalWithoutBaseline } from "./ChatDecisionNotes";
import { ExecutiveChatComparisonCard } from "./ExecutiveChatComparisonCard";

import { companyWorkspaceHref } from "@/modules/companies/lib/workspace-views";

/**
 * Missions 189/190 — Governed Executive Chat Actions / Conversational
 * Scenario Comparison.
 *
 * Renderiza UMA `ExecutiveChatResolvedAction` — sempre visualmente
 * separada do texto da resposta (Seção 40), nunca renderizada como se
 * já tivesse ocorrido (Seção 11: vocabulário sempre "Simular"/"Abrir"/
 * "Comparar", nunca "Executado"/"Criado"). Ações de comparação
 * (`kind: "comparison"`) delegam para `ExecutiveChatComparisonCard`
 * (Mission 190), mesma disciplina de confirmação explícita.
 *
 * **Ação de navegação**: um clique apenas move o foco para a âncora já
 * existente na mesma página (`#scenario-lab`/`#decision-center`/
 * `#knowledge`) — nunca uma mutação, nunca uma chamada de servidor.
 *
 * **Ação computacional (cenário)**: exibe a hipótese estruturada exata
 * que será executada (Seção 45 — `describeChatScenarioAction()`, texto
 * determinístico, nunca a prosa do modelo) e exige um segundo clique
 * explícito ("Simular") antes de qualquer chamada — nenhuma execução ao
 * renderizar (Seção 12). O clique chama `simulateScenarioAction()`
 * (Mission 180/182) SEM NENHUMA MODIFICAÇÃO — a mesma Server Action que
 * o Scenario Lab já usa, que resolve a verdade financeira canônica
 * ATUAL do zero a cada chamada (Seção 43 — nunca reaproveita nenhum
 * baseline "visto" no momento em que o Chat respondeu). `companyId`
 * vem exclusivamente do prop desta árvore (a mesma empresa da
 * conversa) — nunca de um campo da própria ação (Seção 9/33).
 *
 * **Mission 210 (D-135) — da proposta à decisão da empresa.** A simulação
 * leva a âncora financeira da resposta (`baselineIdentity`, calculada pelo
 * servidor) como reivindicação: se a verdade financeira mudou desde a
 * resposta, o servidor recusa e pede uma nova pergunta — a proposta nunca
 * roda sobre uma análise que não conheceu. Depois de simular, "Levar para
 * decisão" abre o MESMO `ScenarioDecisionForm` do Scenario Lab, com
 * `proposedBy: "executive-chat"`: a decisão passa pela mesma ação de
 * servidor (`createScenarioDecisionAction()`), que reverifica a âncora,
 * recomputa o cenário e grava a origem. Registrada a decisão, esta proposta
 * não oferece outra — uma proposta, no máximo uma decisão por este cartão.
 */
export function ExecutiveChatActionCard({
  companyId,
  action,
  baselineIdentity,
}: {
  companyId: string;
  action: ExecutiveChatResolvedAction;
  baselineIdentity?: ScenarioBaselineIdentity;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [projection, setProjection] = useState<ScenarioProjection | undefined>();
  const [simulatedRequest, setSimulatedRequest] = useState<ScenarioRequest | undefined>();
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [decided, setDecided] = useState(false);

  if (action.kind === "navigation") {
    const view = EXECUTIVE_CHAT_NAVIGATION_VIEWS[action.type];
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">{action.reason}</p>
        <Button
          variant="outline"
          size="sm"
          className="w-fit gap-1.5"
          render={<Link href={companyWorkspaceHref(companyId, view)} />}
          nativeButton={false}
        >
          {EXECUTIVE_CHAT_NAVIGATION_TITLES[action.type]}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  if (action.kind === "comparison") {
    return <ExecutiveChatComparisonCard companyId={companyId} action={action} baselineIdentity={baselineIdentity} />;
  }

  // TypeScript não propaga o estreitamento de `action.kind` para dentro
  // de `handleConfirm()` (closure aninhada) — capturado explicitamente
  // aqui como `const` para que `scenarioAction.assumption` permaneça
  // tipado corretamente dentro do closure.
  const scenarioAction = action;
  const { title, assumptionDescription } = describeChatScenarioAction(scenarioAction);

  async function handleConfirm() {
    if (submitting || !baselineIdentity) return;
    setSubmitting(true);
    setError(undefined);
    setProjection(undefined);

    try {
      const request = toScenarioRequest(scenarioAction.assumption);
      const result = await simulateScenarioAction({ companyId, ...request, expectedBaselineIdentity: baselineIdentity });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setProjection(result.projection);
      setSimulatedRequest(request);
    } catch {
      setError("Erro inesperado ao simular o cenário. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
      <span className="text-xs font-medium text-foreground">{title}</span>
      <p className="text-xs text-muted-foreground">{action.reason}</p>
      <div className="flex items-center gap-2 text-sm text-foreground">
        <Badge variant="outline">{assumptionDescription}</Badge>
      </div>

      {!projection && !baselineIdentity && <ChatProposalWithoutBaseline />}

      {!projection && baselineIdentity && (
        <Button variant="outline" size="sm" className="w-fit gap-1.5" onClick={handleConfirm} disabled={submitting}>
          {submitting && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          {submitting ? "Simulando..." : "Simular"}
        </Button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {projection && (
        <div className="flex flex-col gap-2 border-t border-border pt-2">
          {PRIMARY_SCENARIO_METRIC_KEYS.map((key) => {
            const entry = projection.comparison.find((item) => item.metricKey === key);
            const label = INDICATOR_DEFINITIONS[key as keyof typeof INDICATOR_DEFINITIONS]?.name ?? key;
            if (!entry || entry.status === "unavailable") {
              return (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{label}</span>
                  <span className="text-muted-foreground">Indisponível</span>
                </div>
              );
            }
            return (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{label}</span>
                <span className={cn("font-medium tabular-nums", SCENARIO_IMPACT_TONE_CLASSNAME[entry.impact])}>
                  {formatScenarioMetricDelta(entry.delta, entry.unit)}
                </span>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">{projection.disclaimer}</p>

          {decided ? (
            <ChatDecisionRecorded companyId={companyId} />
          ) : showDecisionForm && simulatedRequest && baselineIdentity ? (
            <ScenarioDecisionForm
              companyId={companyId}
              evaluatedBaselineIdentity={baselineIdentity}
              request={simulatedRequest}
              assumptionDescription={assumptionDescription}
              proposedBy="executive-chat"
              onCreated={() => {
                setShowDecisionForm(false);
                setDecided(true);
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="w-fit" onClick={() => setShowDecisionForm(true)}>
                Levar para decisão
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
